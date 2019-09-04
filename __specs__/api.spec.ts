import * as results from './__fixtures__';

test('API', async () => {
  const {
    Student,
    r6,
    r7,
    r9,
    r10,
    r13,
    r14,
    r15,
    r16,
    r17,
    ...rest
  } = results;
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "r1": 10,
      "r11": "Jane",
      "r2": 11,
      "r3": 23,
      "r4": "Hello: 31",
      "r5": "Hello: 31",
      "r8": 11,
    }
  `);
  expect([r9(10), r9(8), r9(1)]).toMatchInlineSnapshot(`
    Array [
      13,
      12,
      5,
    ]
  `);
  const result = await Promise.all([r6, r7, r10, r13].map(r => r() as any));
  expect(result).toMatchInlineSnapshot(`
    Array [
      "Hello: 31",
      31,
      4,
      true,
    ]
  `);
  expect(r14(1)).toMatchInlineSnapshot(`1`);
  expect(r15(1)).toMatchInlineSnapshot(`2`);
  expect(await r16(1)).toMatchInlineSnapshot(`4`);
  expect(await r17(new Student({ id: 1 }))).toMatchInlineSnapshot(`true`);
});
