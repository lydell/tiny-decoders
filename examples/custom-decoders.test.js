// @flow strict

import { map, number, record, repr, string } from "../src";

test("custom decoders", () => {
  function finite(value: number): number {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Expected a finite number, but got: ${repr(value)}`);
    }
    return value;
  }

  // Want `number` but want to disallow `Infinity`, `-Infinity` and `NaN`?
  // Compose `number` with a custom function using `map`. `map` is not only for
  // transforming values, but also for chaining decoders!
  const finiteNumber: mixed => number = map(number, finite);
  expect(finiteNumber(1)).toMatchInlineSnapshot(`1`);
  expect(() => finiteNumber(Infinity)).toThrowErrorMatchingInlineSnapshot(
    `Expected a finite number, but got: Infinity`
  );
  expect(() => finiteNumber("string")).toThrowErrorMatchingInlineSnapshot(
    `Expected a number, but got: "string"`
  );

  type Alignment = "top" | "right" | "bottom" | "left";

  // A common custom decoder is to turn a string into an enum:
  function alignmentDecoder(value: string): Alignment {
    switch (value) {
      case "top":
      case "right":
      case "bottom":
      case "left":
        return value;
      default:
        throw new TypeError(`Expected a Alignment, but got: ${repr(value)}`);
    }
  }

  const shapeDecoder = record({
    width: number,
    height: number,
    // Now `map` comes in handy again to chain decoders!
    align: map(string, alignmentDecoder),
  });
  expect(shapeDecoder({ width: 100, height: 100, align: "left" }))
    .toMatchInlineSnapshot(`
Object {
  "align": "left",
  "height": 100,
  "width": 100,
}
`);

  // There’s also a custom decoder in `examples/missing-values.test.js` that you
  // might be interested in.
});
