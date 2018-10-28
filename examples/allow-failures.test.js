// @flow strict

import { either, field, fieldDeep, number, optional } from "../src";

test("allowing decoders, such as fieldDeep, to fail", () => {
  const decoder = fieldDeep(
    ["store", "products", 0, "accessories", 0, "price"],
    number
  );

  const data = { store: { products: [{ accessories: [{ price: 123 }] }] } };
  const incompleteData = { store: { products: [{ accessories: [] }] } };

  // `fieldDeep` lets you reach into deeply nested structures. But on the way
  // down, there’s lots that can go wrong. What if you’ like to provide a
  // default value in such cases?
  expect(decoder(data)).toMatchInlineSnapshot(`123`);
  expect(() => decoder(incompleteData)).toThrowErrorMatchingInlineSnapshot(`
object["store"]["products"][0]["accessories"][0]: Expected an object, but got: undefined
at 0 (out of bounds) in []
at "accessories" in {"accessories": Array(0)}
at 0 in [(index 0) Object(1)]
at "products" in {"products": Array(1)}
at "store" in {"store": Object(1)}
`);

  // By combining the decoder with another decoder that always succeeds (a
  // function that ignores its input and always returns the same value) you can
  // provide a default value.
  expect(either(decoder, () => 0)(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(either(decoder, () => null)(incompleteData)).toMatchInlineSnapshot(
    `null`
  );

  // If you like, you can define one of these helper functions:
  const always = value => () => value;
  const hardcoded = value => () => value;
  expect(either(decoder, always(0))(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(
    either(decoder, hardcoded(null))(incompleteData)
  ).toMatchInlineSnapshot(`null`);

  // Note that `optional` doesn’t help in this case:
  expect(() => optional(decoder)(incompleteData))
    .toThrowErrorMatchingInlineSnapshot(`
(optional) object["store"]["products"][0]["accessories"][0]: Expected an object, but got: undefined
at 0 (out of bounds) in []
at "accessories" in {"accessories": Array(0)}
at 0 in [(index 0) Object(1)]
at "products" in {"products": Array(1)}
at "store" in {"store": Object(1)}
`);
  // `optional` only does its job if the toplevel value is missing.
  expect(optional(decoder, 0)(undefined)).toMatchInlineSnapshot(`0`);

  // Btw, curious how `fieldDeep` works? The decoder we made at the start of
  // this example is equivalent to:
  const decoder2 = field(
    "store",
    field(
      "products",
      field(0, field("accessories", field(0, field("price", number))))
    )
  );
  expect(decoder2(data)).toMatchInlineSnapshot(`123`);
});
