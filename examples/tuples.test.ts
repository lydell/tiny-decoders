import { expect, test } from "vitest";

import { Decoder, fieldsAuto, map, number, tuple } from "../";

test("decoding tuples", () => {
  type PointTuple = [number, number];

  const data: unknown = [50, 325];

  // If you want a quick way to decode the above into `[number, number]`, use `tuple`.
  const pointTupleDecoder1 = tuple<PointTuple>([number, number]);
  expect(pointTupleDecoder1(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": [
        50,
        325,
      ],
    }
  `);

  // If you’d rather produce an object like the following, use `tuple` with `chain`.
  type Point = {
    x: number;
    y: number;
  };
  const pointDecoder: Decoder<Point> = map(
    tuple([number, number]),
    ([x, y]) => ({
      x,
      y,
    }),
  );
  expect(pointDecoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "x": 50,
        "y": 325,
      },
    }
  `);

  // `tuple` works with any number of values. Here’s an example with four values:
  expect(tuple([number, number, number, number])([1, 2, 3, 4]))
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
  const pointTupleDecoder: Decoder<PointTuple> = map(
    fieldsAuto({
      x: number,
      y: number,
    }),
    ({ x, y }) => [x, y],
  );
  expect(pointTupleDecoder(obj)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": [
        1,
        2,
      ],
    }
  `);
});
