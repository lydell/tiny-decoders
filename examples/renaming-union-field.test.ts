import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { fieldsAuto, fieldsUnion, number } from "../";

test("using different tags in JSON and in TypeScript", () => {
  // There’s nothing stopping you from using different keys and values in JSON
  // and TypeScript. For example, `"type": "circle"` → `tag: "Circle"`.
  const decoder = fieldsUnion("type", {
    circle: fieldsAuto({
      tag: () => "Circle" as const,
      radius: number,
    }),
    square: fieldsAuto({
      tag: () => "Square" as const,
      size: number,
    }),
  });

  type InferredType = ReturnType<typeof decoder>;
  type ExpectedType =
    | { tag: "Circle"; radius: number }
    | { tag: "Square"; size: number };
  expectType<TypeEqual<InferredType, ExpectedType>>(true);

  expect(decoder({ type: "circle", radius: 5 })).toMatchInlineSnapshot(`
    {
      "radius": 5,
      "tag": "Circle",
    }
  `);
});
