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

  const t = tuple([number, number]);
  const pointCodec = chain(t, {
    decoder: ([x, y]) => ({ x, y }),
    encoder: ({ x, y }) => [x, y] as const,
  });
  const expected: Point = {
    x: 50,
    y: 325,
  };
  expect(pointCodec.decoder(data)).toStrictEqual(expected);
  expect(pointCodec.encoder(expected)).toStrictEqual(data);

  // `tuple` works with any number of values. Here’s an example with four values:
  expect(tuple([number, number, number, number]).decoder([1, 2, 3, 4]))
    .toMatchInlineSnapshot(`
      [
        1,
        2,
        3,
        4,
      ]
    `);

  // But in such cases it’s probably nicer to switch to an object:
  const longTupleCodec = chain(tuple([string, string, number, string]), {
    decoder: ([firstName, lastName, age, description]) => ({
      firstName,
      lastName,
      age,
      description,
    }),
    encoder: ({ firstName, lastName, age, description }) =>
      [firstName, lastName, age, description] as const,
  });
  expect(longTupleCodec.decoder(["John", "Doe", 30, "Likes swimming."]))
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
  const pointTupleDecoder2: Codec<PointTuple> = chain(
    fields({
      x: number,
      y: number,
    }),
    {
      decoder: ({ x, y }) => [x, y],
      encoder: ([x, y]) => ({ x, y }),
    },
  );

  const expected2: PointTuple = [1, 2];
  expect(pointTupleDecoder2.decoder(obj)).toStrictEqual(expected2);
  expect(pointTupleDecoder2.encoder(expected2)).toStrictEqual(obj);
});
