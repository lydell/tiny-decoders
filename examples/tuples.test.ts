import { expect, test } from "vitest";

import { chain, Codec, fields, number, string, tuple } from "../";

test("decoding tuples", () => {
  type PointTuple = [number, number];

  const data: unknown = [50, 325];

  // If you want a quick way to decode the above into `[number, number]`, use `tuple`.
  const pointTupleCodec1: Codec<PointTuple> = tuple([number, number]);
  expect(pointTupleCodec1.decoder(data)).toMatchInlineSnapshot(`
    [
      50,
      325,
    ]
  `);

  // If you’d rather produce an object like the following, use `tuple` with `chain`.
  type Point = {
    x: number;
    y: number;
  };

  const pointCodec = chain(tuple([number, number]), {
    decoder: ([x, y]) => ({ x, y }),
    encoder: ({ x, y }) => [x, y],
  });
  const expected: Point = {
    x: 50,
    y: 325,
  };
  expect(pointCodec.decoder(data)).toStrictEqual(expected);
  expect(pointCodec.encoder(expected)).toStrictEqual(data);

  // `tuple` works with any number of values. Here’s an example with four values:
  expect(tuple([number, number, number, number])([1, 2, 3, 4]))
    .toMatchInlineSnapshot(`
      [
        1,
        2,
        3,
        4,
      ]
    `);

  // But in such cases it’s probably nicer to switch to an object:
  const longTupleDecoder = fields(
    (field) => ({
      firstName: field("0", string),
      lastName: field("1", string),
      age: field("2", number),
      description: field("3", string),
    }),
    { allow: "array" },
  );
  expect(longTupleDecoder(["John", "Doe", 30, "Likes swimming."]))
    .toMatchInlineSnapshot(`
      {
        "age": 30,
        "description": "Likes swimming.",
        "firstName": "John",
        "lastName": "Doe",
      }
    `);

  // Finally, you can of course decode an object to a tuple as well:
  const obj: unknown = { x: 1, y: 2 };
  const pointTupleDecoder2 = fields(
    (field): PointTuple => [field("x", number), field("y", number)],
  );
  expect(pointTupleDecoder2(obj)).toMatchInlineSnapshot(`
    [
      1,
      2,
    ]
  `);

  // Or with `fieldsAuto` and `chain`:
  const pointTupleDecoder3: Decoder<PointTuple> = chain(
    fieldsAuto({
      x: number,
      y: number,
    }),
    ({ x, y }) => [x, y],
  );
  expect(pointTupleDecoder3(obj)).toEqual(pointTupleDecoder2(obj));
});
