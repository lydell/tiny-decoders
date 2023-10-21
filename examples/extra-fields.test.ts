import { expect, test } from "vitest";

import { chain, Decoder, fieldsAuto, number, string } from "..";

test("adding extra fields to records", () => {
  // Want to add an extra field to a record, that doesn’t look at the input at
  // all?
  type Product = {
    name: string;
    price: number;
    version: number;
  };

  const data: unknown = { name: "Comfortable Bed", price: 10e3 };

  // One way is to add a decoder that always succeeds
  // (a function that ignores its input and always returns the same value).
  const productDecoder: Decoder<Product> = fieldsAuto({
    name: string,
    price: number,
    version: () => 1,
  });

  expect(productDecoder(data)).toMatchInlineSnapshot(`
    {
      "name": "Comfortable Bed",
      "price": 10000,
      "version": 1,
    }
  `);

  // If you like, you can define this helper function:
  const always =
    <T>(value: T) =>
    (): T =>
      value;

  const productDecoder2: Decoder<Product> = fieldsAuto({
    name: string,
    price: number,
    version: always(1),
  });

  expect(productDecoder2(data)).toEqual(productDecoder(data));

  // Finally, you can do it with `chain`.
  const productDecoder3: Decoder<Product> = chain(
    fieldsAuto({
      name: string,
      price: number,
    }),
    (props) => ({ ...props, version: 1 }),
  );

  expect(productDecoder3(data)).toEqual(productDecoder2(data));
});
