import { expect, test } from "vitest";

import { array, chain, fields, number, string } from "..";

test("decoding to a Set", () => {
  // Want to turn this into a Set of numbers?
  const data: unknown = [1, 2, 1, 3, 2];

  // First decode into an array, then turn that into a set! Remember that
  // decoders are just regular functions, so you can work with their return
  // values.
  expect(new Set(array(number).decoder(data))).toMatchInlineSnapshot(`
    Set {
      1,
      2,
      3,
    }
  `);

  // But what if that’s part of a larger structure?
  const obj = {
    id: "123",
    numbers: data,
  };

  // Use `chain`!
  const objCodec = fields({
    id: string,
    numbers: chain(array(number), {
      decoder: (arr) => new Set(arr),
      encoder: Array.from,
    }),
  });

  const expected = {
    id: "123",
    numbers: new Set([1, 2, 3]),
  };
  expect(objCodec.decoder(obj)).toStrictEqual(expected);
  expect(objCodec.encoder(expected)).toStrictEqual(obj);

  // With `chain`, you don’t _have_ to change the type, though. For example, you
  // could use it to round numbers.
  const codec = chain(number, {
    decoder: Math.round,
    encoder: Math.round,
  });
  expect(codec.decoder(4.9)).toMatchInlineSnapshot(`5`);
  expect(codec.encoder(4.9)).toMatchInlineSnapshot(`5`);
});
