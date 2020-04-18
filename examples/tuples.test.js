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
  tuple,
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

  // If you’d rather produce an object like the following, use `tuple`.
  type Point = {
    x: number,
    y: number,
  };
  const pointDecoder1: Decoder<Point> = tuple((item) => ({
    x: item(0, number),
    y: item(1, number),
  }));
  expect((pointDecoder1(data): Point)).toMatchInlineSnapshot(`
    Object {
      "x": 50,
      "y": 325,
    }
  `);

  // Or with `pair` with `map`.
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

  // For longer tuples, you need to use `tuple`.
  const longTupleDecoder1 = tuple((item) => [
    item(0, string),
    item(1, string),
    item(2, number),
    item(3, string),
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
  const longTupleDecoder2 = tuple((item) => ({
    firstName: item(0, string),
    lastName: item(1, string),
    age: item(2, number),
    description: item(3, string),
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
