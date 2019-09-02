const { createMacro, MacroError } = require('babel-plugin-macros');
const { codeFrameColumns } = require('@babel/code-frame');
const template = require('@babel/template').default;

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
    if (!isPending(nodePath)) return;
    let parentPath = findParent(nodePath);
    if (!t.isCallExpression(parentPath.node)) {
      failWith(1, parentPath.node, 'Expected Pipe to be invoked as a function');
    }
    const args = parentPath.node.arguments;
    ensureArgsProcessed(args, references);
    if (args.length !== 1) {
      failWith(
        2,
        parentPath.node,
        'Expected Pipe to have been invoked with a single argument'
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
          parentPath = findParent(parentPath);
          assertCallExpr(parentPath, propName);
          ensureArgsProcessed(
            parentPath.node.arguments,
            references,
            processed,
            t
          );
          chain.push({ propName, args: parentPath.node.arguments });
        } else if (propName === 'await') {
          parentPath = findParent(parentPath);
          assertCallExpr(parentPath, propName);
          if (parentPath.node.arguments.length !== 0) {
            failWith(5, memberNode, 'Expected await to be invoked without arguments');
          }
          chain.push({ propName: 'await' });
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
          nextParentPath
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

  const transformChain = (target, chain, parentPath) => {
    let resultExpr = target;
    let hasAwait = false;

    const declStatements = [];
    const condStatements = [];
    let enqueuedBailOutcomes = [];

    let statements = condStatements;

    const addDeclaration = () => {
      const tempId = parentPath.scope.generateUidIdentifier('__pipe_expr_temp');
      declStatements.push(
        t.variableDeclaration('let', [t.variableDeclarator(tempId)])
      );
      return tempId;
    };

    const reconcileBailOutcomes = resultExpr => {
      if (enqueuedBailOutcomes.length === 0) return resultExpr;
      const tempId = addDeclaration();
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

    for (const member of chain) {
      switch (member.propName) {
        case 'await':
          hasAwait = true;
          resultExpr = t.awaitExpression(t.sequenceExpression([resultExpr]));
          break;
        case 'thru':
          resultExpr = t.callExpression(member.args[0], [
            resultExpr,
            ...member.args.slice(1),
          ]);
          break;
        case 'thruEnd':
          resultExpr = t.callExpression(
            member.args[0],
            member.args.slice(1).concat(resultExpr)
          );
          break;
        case 'tap':
          const id = parentPath.scope.generateUidIdentifier('__result');
          resultExpr = t.callExpression(
            t.functionExpression(
              null,
              [],
              t.blockStatement([
                t.variableDeclaration('const', [
                  t.variableDeclarator(id, resultExpr),
                ]),
                t.expressionStatement(t.callExpression(member.args[0], [id])),
                t.returnStatement(id),
              ]),
              false,
              hasAwait
            ),
            []
          );
          if (hasAwait) {
            resultExpr = t.awaitExpression(resultExpr);
          }
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
            t.ifStatement(t.unaryExpression('!', bailResultId), t.blockStatement(innerStatements))
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

    if (declStatements.length === 0 && condStatements.length === 0)
      return { hasAwait, resultExpr };

    resultExpr = t.callExpression(
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          ...declStatements,
          ...condStatements,
          t.returnStatement(resultExpr),
        ]),
        false,
        hasAwait
      ),
      []
    );

    if (hasAwait) resultExpr = t.awaitExpression(resultExpr);

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

  for (let i = 0; i < refs.length; i++) {
    const nodePath = refs[i];
    processReference(nodePath, refs.slice(i + 1));
  }
};

module.exports = createMacro(PipeExpr);
