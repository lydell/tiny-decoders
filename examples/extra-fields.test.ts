import { expect, test } from "vitest";

import { Decoder, fieldsAuto, map, number, string } from "..";
import { run } from "../tests/helpers";

test("adding extra fields to records", () => {
  // Want to add an extra field to a record, that doesn’t look at the input at
  // all?
  type Product = {
    name: string;
    price: number;
    version: number;
  };

  const data: unknown = { name: "Comfortable Bed", price: 10e3 };

  // Use `map` to add it:
  const productDecoder: Decoder<Product> = map(
    fieldsAuto({
      name: string,
      price: number,
    }),
    (props) => ({ ...props, version: 1 }),
  );

  expect(productDecoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "name": "Comfortable Bed",
        "price": 10000,
        "version": 1,
      },
    }
  `);

  // In previous versions of tiny-decoders, another way of doing this was to add
  // a decoder that always succeeds (a function that ignores its input and
  // always returns the same value).
  const productDecoderBroken: Decoder<Product> = fieldsAuto({
    name: string,
    price: number,
    version: () => ({ tag: "Valid", value: 1 }),
  });

  // It no longer works, because all the fields you mentioned are expected to exist.
  expect(run(productDecoderBroken, data)).toMatchInlineSnapshot(`
    At root:
    Expected an object with a field called: "version"
    Got: {
      "name": "Comfortable Bed",
      "price": 10000
    }
  `);
});
