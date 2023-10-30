import { expect, test } from "vitest";

import { Codec, fields, map, number, string } from "..";
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
  const productCodec: Codec<Product> = map(
    fields({
      name: string,
      price: number,
    }),
    {
      decoder: (props) => ({ ...props, version: 1 }),
      encoder: ({ version: _version, ...props }) => props,
    },
  );

  expect(productCodec.decoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "name": "Comfortable Bed",
        "price": 10000,
        "version": 1,
      },
    }
  `);

  expect(
    productCodec.encoder({
      name: "Comfortable Bed",
      price: 10000,
      version: 1,
    }),
  ).toMatchInlineSnapshot(`
    {
      "name": "Comfortable Bed",
      "price": 10000,
    }
  `);

  // In previous versions of tiny-decoders, another way of doing this was to add
  // a decoder that always succeeds (a function that ignores its input and
  // always returns the same value).
  const productCodecBroken: Codec<Product> = fields({
    name: string,
    price: number,
    version: {
      decoder: () => ({ tag: "Valid", value: 1 }),
      encoder: () => undefined,
    },
  });

  // It no longer works, because all the fields you mentioned are expected to exist.
  expect(run(productCodecBroken, data)).toMatchInlineSnapshot(`
    At root:
    Expected an object with a field called: "version"
    Got: {
      "name": "Comfortable Bed",
      "price": 10000
    }
  `);
});
