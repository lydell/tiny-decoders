// @flow strict

import {
  type Decoder,
  autoRecord,
  fields,
  map,
  number,
  pair,
  string,
  triple,
} from "../src";

test("decoding tuples", () => {
  type PointTuple = [number, number];

  const data: mixed = [50, 325];

  // If you want a quick way to decode the above into `[number, number]`, use `pair`.
  const pointTupleDecoder1: Decoder<PointTuple> = pair(number, number);
  expect((pointTupleDecoder1(data): PointTuple)).toMatchInlineSnapshot(`
    Array [
      50,
      325,
    ]
  `);

  // If you’d rather produce an object like the following, use `fields`.
  type Point = {
    x: number,
    y: number,
  };
  const pointDecoder1: Decoder<Point> = fields((field) => ({
    x: field(0, number),
    y: field(1, number),
  }));
  expect((pointDecoder1(data): Point)).toMatchInlineSnapshot(`
    Object {
      "x": 50,
      "y": 325,
    }
  `);

  // Or use `pair` with `map`.
  const pointDecoder2: Decoder<Point> = map(pair(number, number), ([x, y]) => ({
    x,
    y,
  }));
  expect(pointDecoder2(data)).toEqual(pointDecoder1(data));

  // There’s `triple` for quickly decoding a tuple with three values:
  expect(triple(number, number, number)([1, 2, 3])).toMatchInlineSnapshot(`
    Array [
      1,
      2,
      3,
    ]
  `);

  // For longer tuples, you need to use `fields`.
  const longTupleDecoder1 = fields((field) => [
    field(0, string),
    field(1, string),
    field(2, number),
    field(3, string),
  ]);
  expect(longTupleDecoder1(["John", "Doe", 30, "Likes swimming."]))
    .toMatchInlineSnapshot(`
      Array [
        "John",
        "Doe",
        30,
        "Likes swimming.",
      ]
    `);

  // But in such cases it’s probably nicer to switch to an object:
  const longTupleDecoder2 = fields((field) => ({
    firstName: field(0, string),
    lastName: field(1, string),
    age: field(2, number),
    description: field(3, string),
  }));
  expect(longTupleDecoder2(["John", "Doe", 30, "Likes swimming."]))
    .toMatchInlineSnapshot(`
      Object {
        "age": 30,
        "description": "Likes swimming.",
        "firstName": "John",
        "lastName": "Doe",
      }
    `);

  // Finally, you can of course decode an object to a tuple as well:
  const obj: mixed = { x: 1, y: 2 };
  const pointTupleDecoder2: Decoder<PointTuple> = fields((field) => [
    field("x", number),
    field("y", number),
  ]);
  expect(pointTupleDecoder2(obj)).toMatchInlineSnapshot(`
    Array [
      1,
      2,
    ]
  `);

  // Or with `autoRecord` and `map`:
  const pointTupleDecoder3: Decoder<PointTuple> = map(
    autoRecord({
      x: number,
      y: number,
    }),
    ({ x, y }) => [x, y]
  );
  expect(pointTupleDecoder3(obj)).toEqual(pointTupleDecoder2(obj));
});
