import { expect, test } from "vitest";

import { Codec, fields, map, number, tuple } from "../";

test("decoding tuples", () => {
  type PointTuple = [number, number];

  const data: unknown = [50, 325];

  // If you want a quick way to decode the above into `[number, number]`, use `tuple`.
  const pointTupleCodec1: Codec<PointTuple> = tuple([number, number]);
  expect(pointTupleCodec1.decoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": [
        50,
        325,
      ],
    }
  `);

  // If you’d rather produce an object like the following, use `tuple` with `map`.
  type Point = {
    x: number;
    y: number;
  };
  const pointCodec: Codec<Point> = map(tuple([number, number]), {
    decoder: ([x, y]) => ({
      x,
      y,
    }),
    encoder: ({ x, y }) => [x, y] as const,
  });
  expect(pointCodec.decoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "x": 50,
        "y": 325,
      },
    }
  `);
  expect(pointCodec.encoder({ x: 50, y: 325 })).toMatchInlineSnapshot(`
    [
      50,
      325,
    ]
  `);

  // `tuple` works with any number of values. Here’s an example with four values:
  expect(tuple([number, number, number, number]).decoder([1, 2, 3, 4]))
    .toMatchInlineSnapshot(`
      {
        "tag": "Valid",
        "value": [
          1,
          2,
          3,
          4,
        ],
      }
    `);

  // You can of course decode an object to a tuple as well:
  const obj: unknown = { x: 1, y: 2 };
  const pointTupleCodec: Codec<PointTuple> = map(
    fields({
      x: number,
      y: number,
    }),
    {
      decoder: ({ x, y }) => [x, y],
      encoder: ([x, y]) => ({ x, y }),
    },
  );
  expect(pointTupleCodec.decoder(obj)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": [
        1,
        2,
      ],
    }
  `);
  expect(pointTupleCodec.encoder([1, 2])).toMatchInlineSnapshot(`
    {
      "x": 1,
      "y": 2,
    }
  `);
});
