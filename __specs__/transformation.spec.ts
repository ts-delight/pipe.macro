import * as path from 'path';
import { transformFileSync, transformSync } from '@babel/core';

const catchError = (fn: () => void): Error => {
  try {
    fn();
    throw new Error('Exception not encountered');
  } catch (e) {
    return e;
  }
};

const transformSnippet = (src: string, addImport = true) => {
  if (addImport) src = `import Pipe from '../../pipe.macro';\n${src}`;
  return transformSync(src, {
    filename: path.join(__dirname, '__fixures__/index.ts'),
  });
};

test('Transformations', () => {
  expect(transformFileSync(path.join(__dirname, '__fixtures__/index.ts'))!.code)
    .toMatchInlineSnapshot(`
    "\\"use strict\\";

    Object.defineProperty(exports, \\"__esModule\\", {
      value: true
    });
    exports.r10 = exports.r9 = exports.r8 = exports.r7 = exports.r6 = exports.r5 = exports.r4 = exports.r3 = exports.r2 = exports.r1 = void 0;
    const r1 = 10;
    exports.r1 = r1;

    const r2 = (i => i + 1)(10);

    exports.r2 = r2;

    const r3 = ((i, j) => i + j)(((i, j) => i + j)(20, 1), 2);

    exports.r3 = r3;

    const r4 = ((i, msg) => \`\${msg}: \${i}\`)((i => i + 1)(30), \\"Hello\\");

    exports.r4 = r4;

    const r5 = ((msg, i) => \`\${msg}: \${i}\`)(\\"Hello\\", function () {
      const _result2 = (i => i + 1)(function () {
        const _result = 30;

        (i => {
          console.log('i: ', i);
        })(_result);

        return _result;
      }());

      (j => {
        console.log('j: ', j);
      })(_result2);

      return _result2;
    }());

    exports.r5 = r5;

    const r6 = async () => async function transform(msg, i) {
      return \`\${msg}: \${i}\`;
    }(\\"Hello\\", (await (await async function () {
      const _result4 = await ((async i => i + 1)(function () {
        const _result3 = 30;

        (i => {
          console.log('i: ', i);
        })(_result3);

        return _result3;
      }()));

      (j => {
        console.log('j: ', j);
      })(_result4);

      return _result4;
    }())));

    exports.r6 = r6;

    const r7 = async () => await ((async i => i + 1)(function () {
      const _result5 = 30;

      (i => {
        console.log('i: ', i);
      })(_result5);

      return _result5;
    }()));

    exports.r7 = r7;

    const r8 = function () {
      let _pipe_expr_temp;

      let _pipe_expr_temp2;

      let _pipe_expr_temp3;

      _pipe_expr_temp = (i => i + 1)(10);

      _pipe_expr_temp2 = (i => i === 11)(_pipe_expr_temp);

      if (!_pipe_expr_temp2) {
        _pipe_expr_temp3 = (i => i + 2)(_pipe_expr_temp);
      }

      return _pipe_expr_temp2 ? _pipe_expr_temp : _pipe_expr_temp3;
    }();

    exports.r8 = r8;

    const increment = i => i + 1;

    const r9 = i => function () {
      let _pipe_expr_temp4;

      let _pipe_expr_temp5;

      let _pipe_expr_temp6;

      let _pipe_expr_temp7;

      let _pipe_expr_temp8;

      _pipe_expr_temp4 = increment(i);

      _pipe_expr_temp5 = (i => i === 11)(_pipe_expr_temp4);

      if (!_pipe_expr_temp5) {
        _pipe_expr_temp6 = increment(_pipe_expr_temp4);

        _pipe_expr_temp7 = (i => (i => i === 10)(i))(_pipe_expr_temp6);

        if (!_pipe_expr_temp7) {
          _pipe_expr_temp8 = _pipe_expr_temp6;
        }
      }

      return increment((i => i + 1)(_pipe_expr_temp7 ? _pipe_expr_temp6 : _pipe_expr_temp5 ? _pipe_expr_temp4 : _pipe_expr_temp8));
    }();

    exports.r9 = r9;

    const r10 = async () => (j => j + 2)((await ((async i => i + 1)(1))));

    exports.r10 = r10;"
  `);
});
