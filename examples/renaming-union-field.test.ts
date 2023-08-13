import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { fieldsUnion, Infer, number } from "../";

test("using different tags in JSON and in TypeScript", () => {
  // There’s nothing stopping you from using different keys and values in JSON
  // and TypeScript. For example, `"type": "circle"` → `tag: "Circle"`.

  // On this line we specify the JSON field name:
  const codec = fieldsUnion("type", (tag) => [
    {
      // But here we create an object with a `tag` field instead.
      tag: tag("Circle", "circle"),
      radius: number,
    },
    {
      // The second argument to the `tag()` function is optional and
      // is the JSON name. If you leave it out, the first argument is used
      // for both the JSON and TypeScript name.
      tag: tag("Square", "square"),
      size: number,
    },
  ]);

  type InferredType = Infer<typeof codec>;
  type ExpectedType =
    | { tag: "Circle"; radius: number }
    | { tag: "Square"; size: number };
  expectType<TypeEqual<InferredType, ExpectedType>>(true);

  const expected: ExpectedType = {
    radius: 5,
    tag: "Circle",
  };
  expect(codec.decoder({ type: "circle", radius: 5 })).toStrictEqual(expected);
  expect(codec.encoder(expected)).toStrictEqual({ type: "circle", radius: 5 });
});
