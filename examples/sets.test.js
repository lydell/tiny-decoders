// @flow strict

import { array, map, number, record, string } from "../src";

test("decoding to a Set", () => {
  // Want to turn this into a Set of numbers?
  const data: mixed = [1, 2, 1, 3, 2];

  // First decode into an array, then turn that into a set! Remember that
  // decoders are just regular functions, so you can work with their return
  // values.
  expect(new Set(array(number)(data))).toMatchInlineSnapshot(`
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

  // In the above example we made a decoder (`array(number)`) and immediately
  // called it on some data (`array(number)(data)`). But `record` expects the
  // values to be decoders themselves and calls them for you. So how do we do it now?
  // Using `map`! It lets you transform the result of a decoder, but still
  // returns a decoder so it fits with `record`! In this case, the return value
  // of the `map` call is a function that looks like this: `mixed =>
  // Set<number>`.
  const objDecoder = record({
    id: string,
    numbers: map(array(number), arr => new Set(arr)),
  });
  expect(objDecoder(obj)).toMatchInlineSnapshot(`
Object {
  "id": "123",
  "numbers": Set {
    1,
    2,
    3,
  },
}
`);

  // With `map`, you don’t _have_ to change the type, though. For example, you
  // could use it to round numbers.
  const decoder: mixed => number = map(number, Math.round);
  expect(decoder(4.9)).toMatchInlineSnapshot(`5`);
});
