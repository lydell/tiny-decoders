// @flow strict

import { field, group, map, number } from "../src";

test("decoding tuples", () => {
  type Point = {|
    x: number,
    y: number,
  |};

  type PointTuple = [number, number];

  const data: mixed = [50, 325];

  // If you want to pick out items at certain indexes of an array, treating it
  // is a tuple, use `field` and save the results in a `group`.
  const pointDecoder: mixed => Point = group({
    x: field(0, number),
    y: field(1, number),
  });
  expect((pointDecoder(data): Point)).toMatchInlineSnapshot(`
Object {
  "x": 50,
  "y": 325,
}
`);

  // If you the decoded value to be a tuple rather than a record, `map` the values:
  const pointDecoder2: mixed => PointTuple = map(pointDecoder, ({ x, y }) => [
    x,
    y,
  ]);
  expect((pointDecoder2(data): PointTuple)).toMatchInlineSnapshot(`
Array [
  50,
  325,
]
`);
});
