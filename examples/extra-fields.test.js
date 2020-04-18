// @flow strict

import { type Decoder, autoRecord, fields, map, number, string } from "../src";

test("adding extra fields to records", () => {
  // Want to add an extra field to a record, that doesn’t look at the input at
  // all?
  type Product = {
    name: string,
    price: number,
    version: number,
  };

  const data: mixed = { name: "Comfortable Bed", price: 10e3 };

  // It’s easy to do with `fields`.
  const productDecoder1: Decoder<Product> = fields((field) => ({
    name: field("name", string),
    price: field("price", number),
    version: 1,
  }));

  expect((productDecoder1(data): Product)).toMatchInlineSnapshot(`
    Object {
      "name": "Comfortable Bed",
      "price": 10000,
      "version": 1,
    }
  `);

  // If you use `autoRecord`, one way is to add a decoder that always succeeds
  // (a function that ignores its input and always returns the same value).
  const productDecoder2: Decoder<Product> = autoRecord({
    name: string,
    price: number,
    version: () => 1,
  });

  expect(productDecoder2(data)).toEqual(productDecoder1(data));

  // If you like, you can define one of these helper functions:
  const hardcoded = (value) => () => value;
  const always = hardcoded;

  const productDecoder3: Decoder<Product> = autoRecord({
    name: string,
    price: number,
    version: always(1),
  });

  expect(productDecoder3(data)).toEqual(productDecoder2(data));

  // Finally, you can do it with `map`.
  const productDecoder4: Decoder<Product> = map(
    autoRecord({
      name: string,
      price: number,
    }),
    (props) => ({ ...props, version: 1 })
  );

  expect(productDecoder4(data)).toEqual(productDecoder3(data));
});
