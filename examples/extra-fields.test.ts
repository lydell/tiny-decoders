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

  // Use `chain` to add it:
  const productDecoder: Decoder<Product> = chain(
    fieldsAuto({
      name: string,
      price: number,
    }),
    (props) => ({ ...props, version: 1 }),
  );

  expect(productDecoder(data)).toMatchInlineSnapshot(`
    {
      "name": "Comfortable Bed",
      "price": 10000,
      "version": 1,
    }
  `);

  // In previous versions of tiny-decoders, another way of doing this was to add
  // a decoder that always succeeds (a function that ignores its input and
  // always returns the same value).
  const productDecoderBroken: Decoder<Product> = fieldsAuto({
    name: string,
    price: number,
    version: () => 1,
  });

  // It no longer works, because all the fields you mentioned are expected to exist.
  expect(() => productDecoderBroken(data)).toThrowErrorMatchingInlineSnapshot(`
    "Expected an object with a field called: \\"version\\"
    Got: {
      \\"name\\": string,
      \\"price\\": number
    }
    (Actual values are hidden in sensitive mode.)

    For better error messages, see https://github.com/lydell/tiny-decoders#error-messages"
  `);
});
