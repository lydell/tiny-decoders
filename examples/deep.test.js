// @flow strict

import { deep, either, number, optional, record, tuple } from "../src";

test("decoding deeply nested values", () => {
  // `deep` lets you reach into deeply nested structures. But on the way
  // down, there’s lots that can go wrong. What if you’ like to provide a
  // default value in such cases? `either` can be used for this purpose.

  const decoder = deep(
    ["store", "products", 0, "accessories", 0, "price"],
    number
  );

  const data = { store: { products: [{ accessories: [{ price: 123 }] }] } };
  const incompleteData = { store: { products: [{ accessories: [] }] } };

  expect(decoder(data)).toMatchInlineSnapshot(`123`);
  expect(() => decoder(incompleteData)).toThrowErrorMatchingInlineSnapshot(
    `object["store"]["products"][0]["accessories"][0] (out of bounds): Expected an object, but got: undefined`
  );

  // By combining the decoder with another decoder that always succeeds (a
  // function that ignores its input and always returns the same value) you can
  // provide a default value.
  expect(either(decoder, () => 0)(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(either(decoder, () => null)(incompleteData)).toMatchInlineSnapshot(
    `null`
  );

  // If you like, you can define one of these helper functions:
  const always = (value) => () => value;
  const hardcoded = (value) => () => value;
  expect(either(decoder, always(0))(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(
    either(decoder, hardcoded(null))(incompleteData)
  ).toMatchInlineSnapshot(`null`);

  // Note that `optional` doesn’t help in this case:
  expect(() =>
    optional(decoder)(incompleteData)
  ).toThrowErrorMatchingInlineSnapshot(
    `(optional) object["store"]["products"][0]["accessories"][0] (out of bounds): Expected an object, but got: undefined`
  );
  // `optional` only does its job if the toplevel value is missing.
  expect(optional(decoder, 0)(undefined)).toMatchInlineSnapshot(`0`);

  // By the way, are you curious how `deep` works? The decoder we made at the
  // start of this example is equivalent to:
  const decoder2 = record((field1) =>
    field1(
      "store",
      record((field2) =>
        field2(
          "products",
          tuple((item1) =>
            item1(
              0,
              record((field3) =>
                field3(
                  "accessories",
                  tuple((item2) =>
                    item2(
                      0,
                      record((field4) => field4("price", number))
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
  expect(decoder2(data)).toMatchInlineSnapshot(`123`);
});
