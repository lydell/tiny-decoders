// @flow strict

import { map, number, record, string } from "../src";

test("adding extra fields to records", () => {
  // Want to add an extra field to the result of `record`, that doesn’t look at
  // the input at all?
  type Product = {|
    name: string,
    price: number,
    version: number,
  |};

  const data: mixed = { name: "Comfortable Bed", price: 10e3 };

  // One way is to do it with `map`.
  const productDecoder1: mixed => Product = map(
    record({
      name: string,
      price: number,
    }),
    props => ({ ...props, version: 1 })
  );
  expect((productDecoder1(data): Product)).toMatchInlineSnapshot(`
Object {
  "name": "Comfortable Bed",
  "price": 10000,
  "version": 1,
}
`);

  // Another way is to add a decoder that always succeeds (a function that
  // ignores its input and always returns the same value).
  const productDecoder2: mixed => Product = record({
    name: string,
    price: number,
    version: () => 1,
  });
  expect((productDecoder2(data): Product)).toMatchInlineSnapshot(`
Object {
  "name": "Comfortable Bed",
  "price": 10000,
  "version": 1,
}
`);

  // If you don’t like that arrow function, you can use `always(1)` or
  // `hardcoded(1)` as mentioned in `examples/allow-failures.test.js`.
});
