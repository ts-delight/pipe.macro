import * as results from './__fixtures__';

test('API', async () => {
  const { r6, r7, r9, r10, ...rest } = results;
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "r1": 10,
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
  const result = await Promise.all([r6, r7, r10].map(r => r() as any));
  expect(result).toMatchInlineSnapshot(`
    Array [
      "Hello: 31",
      31,
      4,
    ]
  `);
});
