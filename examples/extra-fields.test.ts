import { expect, test } from "vitest";

import { chain, Codec, fields, number, string } from "..";

test("adding extra fields to records", () => {
  // Want to add an extra field to a record, that doesn’t look at the input at
  // all?
  type Product = {
    name: string;
    price: number;
    version: number;
  };

  const data = { name: "Comfortable Bed", price: 10e3 };

  // Use `chain` to add it when decoding, and remove it when encoding.
  const productCodec: Codec<Product> = chain(
    fields({
      name: string,
      price: number,
    }),
    {
      decoder: (props) => ({ ...props, version: 1 }),
      encoder: ({ version: _version, ...props }) => props,
    },
  );

  const expected: Product = {
    name: "Comfortable Bed",
    price: 10000,
    version: 1,
  };
  expect(productCodec.decoder(data)).toStrictEqual(expected);
  expect(productCodec.encoder(expected)).toStrictEqual(data);
});
