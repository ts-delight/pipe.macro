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
    exports.r17 = exports.r16 = exports.r15 = exports.r14 = exports.r13 = exports.r11 = exports.Student = exports.r10 = exports.r9 = exports.r8 = exports.r7 = exports.r6 = exports.r5 = exports.r4 = exports.r3 = exports.r2 = exports.r1 = void 0;
    const r1 = 10;
    exports.r1 = r1;

    const r2 = (i => i + 1)(10);

    exports.r2 = r2;

    const r3 = ((i, j) => i + j)(((i, j) => i + j)(20, 1), 2);

    exports.r3 = r3;

    const r4 = ((i, msg) => \`\${msg}: \${i}\`)((i => i + 1)(30), \\"Hello\\");

    exports.r4 = r4;

    const r5 = function () {
      const _result_upto_tap$L = 30;

      (i => {
        console.log('i: ', i);
      })(_result_upto_tap$L);

      const _result_upto_tap$L2 = (i => i + 1)(_result_upto_tap$L);

      (j => {
        console.log('j: ', j);
      })(_result_upto_tap$L2);

      return ((msg, i) => \`\${msg}: \${i}\`)(\\"Hello\\", _result_upto_tap$L2);
    }();

    exports.r5 = r5;

    const r6 = async () => await async function () {
      const _result_upto_tap$L3 = 30;

      (i => {
        console.log('i: ', i);
      })(_result_upto_tap$L3);

      const _result_upto_tap$L4 = await ((async i => i + 1)(_result_upto_tap$L3));

      await (j => {
        console.log('j: ', j);
      })(_result_upto_tap$L4);
      return async function transform(msg, i) {
        return \`\${msg}: \${i}\`;
      }(\\"Hello\\", _result_upto_tap$L4);
    }();

    exports.r6 = r6;

    const r7 = async () => await async function () {
      const _result_upto_tap$L5 = 30;

      (i => {
        console.log('i: ', i);
      })(_result_upto_tap$L5);

      return await ((async i => i + 1)(_result_upto_tap$L5));
    }();

    exports.r7 = r7;

    const r8 = function () {
      let _pipe_expr_temp;

      let _pipe_expr_temp2;

      let _pipe_result_before_bail;

      _pipe_expr_temp = (i => i + 1)(10);

      _pipe_expr_temp2 = (i => i === 11)(_pipe_expr_temp);

      if (!_pipe_expr_temp2) {
        _pipe_result_before_bail = (i => i + 2)(_pipe_expr_temp);
      }

      return _pipe_expr_temp2 ? _pipe_expr_temp : _pipe_result_before_bail;
    }();

    exports.r8 = r8;

    const increment = i => i + 1;

    const r9 = i => function () {
      let _pipe_expr_temp3;

      let _pipe_expr_temp4;

      let _pipe_expr_temp5;

      let _pipe_expr_temp6;

      let _pipe_result_before_bail2;

      _pipe_expr_temp3 = increment(i);

      _pipe_expr_temp4 = (i => i === 11)(_pipe_expr_temp3);

      if (!_pipe_expr_temp4) {
        _pipe_expr_temp5 = increment(_pipe_expr_temp3);

        _pipe_expr_temp6 = (i => (i => i === 10)(i))(_pipe_expr_temp5);

        if (!_pipe_expr_temp6) {
          _pipe_result_before_bail2 = _pipe_expr_temp5;
        }
      }

      return increment((i => i + 1)(_pipe_expr_temp6 ? _pipe_expr_temp5 : _pipe_expr_temp4 ? _pipe_expr_temp3 : _pipe_result_before_bail2));
    }();

    exports.r9 = r9;

    const r10 = async () => (j => j + 2)((await ((async i => i + 1)(1))));

    exports.r10 = r10;

    class User {
      constructor() {
        this.first = \\"Jane\\";
        this.last = \\"Doe\\";
      }

      getFirst() {
        return this.first;
      }

      getLast() {
        return this.last;
      }

      getName(count) {
        switch (count) {
          case \\"first\\":
            return this.getFirst();

          case \\"last\\":
            return this.getLast();

          case \\"full\\":
            return this.getFirst() + \\" \\" + this.getLast();
        }
      }

    }

    const r11 = function () {
      const _result_upto_tap$L6 = new User();

      _result_upto_tap$L6.getFirst();

      _result_upto_tap$L6.getLast();

      const _result_upto_thru$L = _result_upto_tap$L6;

      const _result_upto_thru$L2 = typeof _result_upto_thru$L.getFirst === \\"function\\" ? _result_upto_thru$L.getFirst() : _result_upto_thru$L.getFirst;

      return typeof _result_upto_thru$L2.trim === \\"function\\" ? _result_upto_thru$L2.trim() : _result_upto_thru$L2.trim;
    }();

    exports.r11 = r11;

    class Enrollment {
      async assignCourses() {
        return Promise.resolve(true);
      }

    }

    class Student {
      constructor(params) {
        this.id = params.id;
      }

      async register() {
        return this;
      }

      enroll() {
        return Promise.resolve(new Enrollment());
      }

    }

    exports.Student = Student;

    const r13 = async () => await async function () {
      const _result_upto_tap$L7 = new Student({
        id: 1
      });

      await _result_upto_tap$L7.register();
      const _result_upto_thru$L3 = _result_upto_tap$L7;

      const _result_upto_thru$L4 = await (typeof _result_upto_thru$L3.enroll === \\"function\\" ? _result_upto_thru$L3.enroll() : _result_upto_thru$L3.enroll);

      return typeof _result_upto_thru$L4.assignCourses === \\"function\\" ? _result_upto_thru$L4.assignCourses() : _result_upto_thru$L4.assignCourses;
    }();

    exports.r13 = r13;

    const r14 = function (_pipe_arg) {
      return _pipe_arg;
    };

    exports.r14 = r14;

    const r15 = function (_pipe_arg2) {
      return (i => i + 1)(_pipe_arg2);
    };

    exports.r15 = r15;

    const r16 = async function (_pipe_arg3) {
      return (j => j + 2)((await ((async i => i + 1)(_pipe_arg3))));
    };

    exports.r16 = r16;

    const r17 = async function (_pipe_arg4) {
      const _result_upto_tap$L8 = _pipe_arg4;
      await _result_upto_tap$L8.register();
      const _result_upto_thru$L5 = _result_upto_tap$L8;

      const _result_upto_thru$L6 = await (typeof _result_upto_thru$L5.enroll === \\"function\\" ? _result_upto_thru$L5.enroll() : _result_upto_thru$L5.enroll);

      return typeof _result_upto_thru$L6.assignCourses === \\"function\\" ? _result_upto_thru$L6.assignCourses() : _result_upto_thru$L6.assignCourses;
    };

    exports.r17 = r17;"
  `);
});
