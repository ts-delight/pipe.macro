const { createMacro, MacroError } = require('babel-plugin-macros');
const { codeFrameColumns } = require('@babel/code-frame');
const template = require('@babel/template').default;
const { get } = require('lodash');
const traverse = require('@babel/traverse').default;

const pkgName = 'pipe.macro';
const debug = require('debug')(pkgName);

const PipeExpr = ({ references, state, babel }) => {
  debug('Initial state:', state);

  // Utilities to help with ast construction
  const t = babel.types;
  // Complete source code if file info is available
  const { code } = state.file;
  const refKeys = Object.keys(references);
  const invalidRefKeys = refKeys.filter(key => key !== 'default');

  if (invalidRefKeys.length > 0) {
    throw new MacroError(
      `Invalid import from pipe.macro: ${invalidRefKeys.join(', ')}`
    );
  }

  const processed = new Set();
  const isPending = path => !processed.has(path.node);
  const refs = references.default;

  const processReference = (nodePath, references) => {
    if (!isPending(nodePath)) {
      // This is possible because we process arguments ahead of sequence
      // when processing callee
      return;
    }
    let parentPath = findParent(nodePath);
    if (!t.isCallExpression(parentPath.node)) {
      failWith(1, parentPath.node, 'Expected Pipe to be invoked as a function');
    }
    const args = parentPath.node.arguments;
    ensureArgsProcessed(args, references);
    if (args.length !== 0 && args.length !== 1) {
      failWith(
        2,
        parentPath.node,
        'Expected Pipe to have been invoked with atmost one argument'
      );
    }
    const target = parentPath.node.arguments[0];
    const { topMostPath, resultExpr } = processChain(
      parentPath,
      target,
      references
    );
    topMostPath.replaceWith(resultExpr);
    processed.add(nodePath.node);
  };

  // Find immediate parent
  const findParent = nodePath => nodePath.findParent(() => true);

  // Print well formatted errors
  const failWith = (errCode, node, message) => {
    if (node.loc) console.log(codeFrameColumns(code, node.loc, { message }));
    const error = new Error(`ERR${errCode}: ${message}`);
    error.code = `ERR${errCode}`;
    throw error;
  };

  const processChain = (parentPath, target, references) => {
    let generateFunction = !target;
    target = target || parentPath.scope.generateUidIdentifier('pipe_arg');
    const chain = [];
    while (true) {
      const nextParentPath = findParent(parentPath);
      if (
        t.isMemberExpression(nextParentPath.node) &&
        nextParentPath.node.object === parentPath.node
      ) {
        parentPath = nextParentPath;
        const memberNode = parentPath.node;
        const propName = memberNode.property.name;
        if (
          propName === 'thru' ||
          propName === 'thruEnd' ||
          propName === 'tap' ||
          propName === 'bailIf' ||
          propName === 'reconcile'
        ) {
          let nextParentPath = findParent(parentPath);
          if (
            nextParentPath.isCallExpression() &&
            nextParentPath.node.callee === parentPath.node
          ) {
            parentPath = nextParentPath;
            ensureArgsProcessed(
              parentPath.node.arguments,
              references,
              processed,
              t
            );
            chain.push({
              propName,
              path: parentPath,
              args: parentPath.node.arguments,
            });
            continue;
          }
          if (
            nextParentPath.isMemberExpression() &&
            (propName === 'thru' || propName === 'tap') &&
            nextParentPath.node.object === parentPath.node
          ) {
            const { property } = nextParentPath.node;
            parentPath = nextParentPath;
            nextParentPath = findParent(parentPath);
            if (
              nextParentPath.isCallExpression() &&
              nextParentPath.node.callee === parentPath.node
            ) {
              parentPath = nextParentPath;
              ensureArgsProcessed(
                parentPath.node.arguments,
                references,
                processed,
                t
              );
              chain.push({
                propName,
                accessor: property,
                path: parentPath,
                args: parentPath.node.arguments,
              });
              continue;
            }
          }
          failWith(6, parentPath.node, `Unsupported usage of ${propName}`);
        } else if (propName === 'await') {
          parentPath = findParent(parentPath);
          assertCallExpr(parentPath, propName);
          if (parentPath.node.arguments.length !== 0) {
            failWith(
              5,
              memberNode,
              'Expected await to be invoked without arguments'
            );
          }
          chain.push({ propName, path: parentPath });
        } else {
          failWith(2, memberNode, 'Invocation of unknown member on Pipe-chain');
        }
      } else if (
        t.isCallExpression(nextParentPath.node) &&
        nextParentPath.node.callee === parentPath.node
      ) {
        const { hasAwait, resultExpr } = transformChain(
          target,
          chain,
          nextParentPath,
          generateFunction
        );
        if (hasAwait) {
          const fnParent = nextParentPath.findParent(
            p =>
              t.isArrowFunctionExpression(p) ||
              t.isFunctionExpression(p) ||
              t.isFunctionDeclaration(p)
          );
          if (fnParent && !fnParent.node.async) {
            failWith(
              4,
              fnParent.node,
              `Await must be used inside a async function`
            );
          }
        }
        return {
          topMostPath: nextParentPath,
          resultExpr,
        };
      } else {
        failWith(3, parentPath.node, `Unterminated pipe chain`);
      }
    }
  };

  const transformChain = (target, chain, parentPath, generateFunction) => {
    let resultExpr = target;
    let hasAwait = false;

    const declStatements = [];
    const condStatements = [];
    let enqueuedBailOutcomes = [];

    let statements = condStatements;

    const addDeclaration = (prefix = '__pipe_expr_temp') => {
      const tempId = parentPath.scope.generateUidIdentifier(prefix);
      declStatements.push(
        t.variableDeclaration('let', [t.variableDeclarator(tempId)])
      );
      return tempId;
    };

    const reconcileBailOutcomes = resultExpr => {
      if (enqueuedBailOutcomes.length === 0) return resultExpr;
      const tempId = addDeclaration('__pipe_result_before_bail');
      statements.push(
        template(`%%tempId%% = %%resultExpr%%`)({ tempId, resultExpr })
      );
      // Break out of nested if conditions:
      statements = condStatements;
      const result = enqueuedBailOutcomes.reduce(
        (lastResultId, [bailResultId, resultId]) =>
          t.conditionalExpression(bailResultId, resultId, lastResultId),
        tempId
      );
      enqueuedBailOutcomes = [];
      return result;
    };

    const isFunctionExpression = (node) => 
      node.type.match(/FunctionExpression$/) &&
      node.body &&
      node.body.type.match(/Expression$/)

    const inlineFunctionExpression = (node, member, parentPath) => {
      const substNames = [];
      const idMap = node.params.reduce((result, { name }) => {
        const substName = parentPath.scope.generateUidIdentifier(
          `__${name}_subst`
        );
        substNames.push(substName);
        result[name] = substName;
        return result;
      }, {});
      const fnBodyVisitor = {
        Identifier(idPath) {
          const substitutedId = idMap[idPath.node.name];
          if (substitutedId) {
            idPath.node.name = substitutedId.name;
          }
        },
      };
      let fnBody;
      member.path.traverse({
        FunctionExpression(innerPath) {
          innerPath.traverse(fnBodyVisitor);
          fnBody = innerPath.node.body;
        },
        ArrowFunctionExpression(innerPath) {
          innerPath.traverse(fnBodyVisitor);
          fnBody = innerPath.node.body;
        },
      });
      if (!fnBody) return fnBody;
      statements.push(
        template(`const %%varName%% = %%val%%;`)({
          varName: substNames.shift(),
          val: resultExpr,
        })
      );
      for (const arg of member.args.slice(1)) {
        const varName = substNames.shift();
        if (varName) {
          statements.push(
            template(`const %%varName%% = %%val%%;`)({
              varName,
              val: arg,
            })
          );
        } else throw new Error('Arity mismatch');
      }
      if (substNames.length !== 0) throw new Error('Arity mismatch');
      return fnBody;
    };

    for (let i = 0; i < chain.length; i++) {
      const member = chain[i];
      switch (member.propName) {
        case 'await':
          hasAwait = true;
          resultExpr = t.awaitExpression(t.sequenceExpression([resultExpr]));
          break;
        case 'thru':
          const { accessor } = member;
          if (accessor) {
            if (member.args.length > 0) {
              resultExpr = t.callExpression(
                t.isMemberExpression(resultExpr, accesor),
                member.args
              );
            } else {
              let valIdPrefix = `__result_upto_thru`;
              const lstart = get(member.path.node, ['loc', 'start', 'line']);
              if (lstart) valIdPrefix += `$L${lstart}`;
              const valId = parentPath.scope.generateUidIdentifier(valIdPrefix);
              statements.push(
                template(`const %%valId%% = %%resultExpr%%;`)({
                  valId,
                  resultExpr,
                })
              );
              resultExpr = template(`typeof %%valId%%.%%accessor%% === "function" 
                ? %%valId%%.%%accessor%%() 
                : %%valId%%.%%accessor%%`)({ valId, accessor });
              if (t.isExpressionStatement(resultExpr)) {
                resultExpr = resultExpr.expression;
              }
            }
          } else {
            const arg = member.args[0];
            let didInline = false;
            if (isFunctionExpression(arg)) {
              const fnBody = inlineFunctionExpression(arg, member, parentPath);
              if (fnBody) {
                resultExpr = fnBody;
                didInline = true;
              }
            }
            if (!didInline) {
              resultExpr = t.callExpression(member.args[0], [
                resultExpr,
                ...member.args.slice(1),
              ]);
            }
          }
          break;
        case 'thruEnd':
          resultExpr = t.callExpression(
            member.args[0],
            member.args.slice(1).concat(resultExpr)
          );
          break;
        case 'tap':
          if (i === 0 || chain[i - 1].propName !== 'tap') {
            let valIdPrefix = `__result_upto_tap`;
            const lstart = get(member.path.node, ['loc', 'start', 'line']);
            if (lstart) valIdPrefix += `$L${lstart}`;
            const id = parentPath.scope.generateUidIdentifier(valIdPrefix);
            statements.push(
              t.variableDeclaration('const', [
                t.variableDeclarator(id, resultExpr),
              ])
            );
            resultExpr = id;
          }
          let expr;
          if (member.accessor) {
            expr = t.callExpression(
              t.memberExpression(resultExpr, member.accessor),
              member.args
            );
          } else {
            const node = member.args[0];
            if (isFunctionExpression(node)) {
              expr = inlineFunctionExpression(node, member, parentPath)
            }
            if (!expr) {
              expr = t.callExpression(member.args[0], [resultExpr]);
            }
          }

          // Consume all subsequent await expressions
          for (
            let j = i + 1;
            j < chain.length - 1 && chain[j].propName === 'await';
            j++, i++
          ) {
            if (!t.isAwaitExpression(expr)) {
              expr = t.awaitExpression(expr);
            }
          }
          statements.push(t.expressionStatement(expr));

          break;
        case 'bailIf': {
          const resultId = addDeclaration();
          statements.push(
            t.expressionStatement(
              t.assignmentExpression('=', resultId, resultExpr)
            )
          );
          const bailResultId = addDeclaration();
          enqueuedBailOutcomes.push([bailResultId, resultId]);
          statements.push(
            template(`%%bailResultId%% = %%predicate%%(%%resultId%%);`)({
              bailResultId,
              predicate: member.args[0],
              resultId,
            })
          );
          const innerStatements = [];
          statements.push(
            t.ifStatement(
              t.unaryExpression('!', bailResultId),
              t.blockStatement(innerStatements)
            )
          );
          statements = innerStatements;
          resultExpr = resultId;
          break;
        }
        case 'reconcile': {
          resultExpr = reconcileBailOutcomes(resultExpr);
          if (member.args.length === 1) {
            resultExpr = t.callExpression(member.args[0], [resultExpr]);
          }
          break;
        }
      }
    }

    resultExpr = reconcileBailOutcomes(resultExpr);

    if (
      declStatements.length === 0 &&
      condStatements.length === 0 &&
      !generateFunction
    )
      return { hasAwait, resultExpr };

    const args = generateFunction ? [target] : [];

    resultExpr = t.functionExpression(
      null,
      args,
      t.blockStatement([
        ...declStatements,
        ...condStatements,
        t.returnStatement(resultExpr),
      ]),
      false,
      hasAwait
    );

    if (!generateFunction) {
      resultExpr = t.callExpression(resultExpr, []);

      if (hasAwait) resultExpr = t.awaitExpression(resultExpr);
    }
    return { hasAwait, resultExpr };
  };

  const assertCallExpr = (parentPath, propName) => {
    if (!t.isCallExpression(parentPath.node)) {
      failWith(
        4,
        parentPath.node,
        `Expected member ${propName} to have been invoked as a function`
      );
    }
  };

  const ensureArgsProcessed = (args, references) => {
    for (const arg of args) {
      for (let i = 0; i < references.length; i++) {
        const nodePath = references[i];
        const parent = nodePath.findParent(p => p.node === arg);
        if (!parent) continue;
        processReference(nodePath, references.slice(i + 1));
      }
    }
  };

  // Process all macro references in sequence
  for (let i = 0; i < refs.length; i++) {
    const nodePath = refs[i];
    processReference(nodePath, refs.slice(i + 1));
  }
};

module.exports = createMacro(PipeExpr);
