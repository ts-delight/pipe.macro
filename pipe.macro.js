const { createMacro, MacroError } = require('babel-plugin-macros');
const { codeFrameColumns } = require('@babel/code-frame');
const template = require('@babel/template').default;
const { get } = require('lodash');

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
    let parentPath = nodePath.parentPath;
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
      const nextParentPath = parentPath.parentPath;
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
          let nextParentPath = parentPath.parentPath;
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
            nextParentPath = parentPath.parentPath;
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
          parentPath = parentPath.parentPath;
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

    const makeId = (prefix = '__pipe_expr_temp') =>
      parentPath.scope.generateUidIdentifier(prefix);

    const makeIdDecl = (mutable = false, id, val) =>
      t.variableDeclaration(mutable ? 'let' : 'const', [
        t.variableDeclarator(id, val),
      ]);

    const addTopLevelIdDecl = prefix => {
      const tempId = makeId(prefix);
      declStatements.push(makeIdDecl(true, tempId));
      return tempId;
    };

    const addDecl = (id, val, mutable = false) => {
      statements.push(makeIdDecl(mutable, id, val));
    };

    const addDeclForResultExpr = (valIdPrefix, node) => {
      const valId = makeId(suffixLinePos(valIdPrefix, node));
      addDecl(valId, resultExpr);
      return valId;
    };

    const addAssignment = (id, val) =>
      statements.push(
        t.expressionStatement(t.assignmentExpression('=', id, val))
      );

    const breakOutOfNesting = () => {
      statements = condStatements;
    };

    const hasPendingBailOutcomes = () => enqueuedBailOutcomes.length > 0;

    const resetBailOutcomes = () => {
      enqueuedBailOutcomes = [];
    };

    const reconcileBailOutcomes = resultExpr => {
      if (!hasPendingBailOutcomes()) return resultExpr;
      const tempId = addTopLevelIdDecl('__pipe_result_before_bail');
      addAssignment(tempId, resultExpr);
      breakOutOfNesting();
      const result = enqueuedBailOutcomes.reduce(
        (lastResultId, [bailResultId, resultId]) =>
          t.conditionalExpression(bailResultId, resultId, lastResultId),
        tempId
      );
      resetBailOutcomes();
      return result;
    };

    const isArrowReturningExpression = node =>
      t.isArrowFunctionExpression(node) && 
      !t.isBlockStatement(node.body);

    const mapToSubstituteIds = params =>
      params.reduce((result, { name }) => {
        const substName = makeId(`__${name}_subst`);
        result[name] = substName;
        return result;
      }, {});

    const substituteIdsInFnBody = (path, idMap) => {
      const fnBodyVisitor = {
        Identifier(idPath) {
          const substitutedId = idMap[idPath.node.name];
          if (substitutedId) {
            idPath.node.name = substitutedId.name;
          }
        },
      };
      path.traverse({
        FunctionExpression(innerPath) {
          innerPath.traverse(fnBodyVisitor);
        },
        ArrowFunctionExpression(innerPath) {
          innerPath.traverse(fnBodyVisitor);
        },
      });
    };

    const inlineFunctionExpression = (callable, path, invocationArgs) => {
      const idMap = mapToSubstituteIds(callable.params);
      const substNames = Object.values(idMap);
      substituteIdsInFnBody(path, idMap);
      if (substNames.length !== invocationArgs.length) {
        failWith(7, path.node, 'Invocation with incorrect arity');
      }
      invocationArgs.forEach((arg, idx) => {
        const varName = substNames[idx];
        addDecl(varName, arg);
      });
      return callable.body;
    };

    const invokeOrInlineFnCall = (callable, path, invocationArgs) => {
      if (isArrowReturningExpression(callable)) {
        return inlineFunctionExpression(callable, path, invocationArgs);
      }
      return t.callExpression(callable, invocationArgs);
    };

    const invokeOrInlineFnCallMember = (member, getArgs) => {
      const callable = member.args[0];
      const extraArgs = member.args.slice(1);
      const invocationArgs = getArgs(resultExpr, extraArgs);
      return invokeOrInlineFnCall(callable, member.path, invocationArgs);
    };

    for (let i = 0; i < chain.length; i++) {
      const member = chain[i];
      const { node } = member.path;
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
              const valId = addDeclForResultExpr(`__result_upto_thru`, node);
              resultExpr = resultExprTpl({ valId, accessor });
              if (t.isExpressionStatement(resultExpr)) {
                resultExpr = resultExpr.expression;
              }
            }
          } else {
            resultExpr = invokeOrInlineFnCallMember(
              member,
              (pipeArg, extraArgs) =>
                pipeArg ? [pipeArg, ...extraArgs] : extraArgs
            );
          }
          break;
        case 'thruEnd':
          resultExpr = invokeOrInlineFnCallMember(
            member,
            (pipeArg, extraArgs) =>
              pipeArg ? extraArgs.concat(pipeArg) : extraArgs
          );
          break;
        case 'tap':
          if (i === 0 || chain[i - 1].propName !== 'tap') {
            const id = addDeclForResultExpr(`__result_upto_tap`, node);
            resultExpr = id;
          }
          let expr;
          if (member.accessor) {
            expr = t.callExpression(
              t.memberExpression(resultExpr, member.accessor),
              member.args
            );
          } else {
            expr = invokeOrInlineFnCallMember(member, pipeArg => [pipeArg]);
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
          const resultId = addTopLevelIdDecl();
          addAssignment(resultId, resultExpr);
          const bailResultId = addTopLevelIdDecl();
          enqueuedBailOutcomes.push([bailResultId, resultId]);
          const expr = invokeOrInlineFnCall(member.args[0], member.path, [
            resultId,
          ]);
          addAssignment(bailResultId, expr);
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

const resultExprTpl = template(`typeof %%valId%%.%%accessor%% === "function" 
  ? %%valId%%.%%accessor%%() 
  : %%valId%%.%%accessor%%`);

const suffixLinePos = (prefix, node) => {
  const lstart = get(node, ['loc', 'start', 'line']);
  if (lstart) return `${prefix}$L${lstart}`;
  return prefix;
};

module.exports = createMacro(PipeExpr);
