import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { fieldsUnion, Infer, number, tag } from "../";

test("using different tags in JSON and in TypeScript", () => {
  // Here’s how to use different keys and values in JSON and TypeScript.
  // For example, `"type": "circle"` → `tag: "Circle"`.
  const decoder = fieldsUnion("tag", [
    {
      tag: tag("Circle", { renameTagFrom: "circle", renameFieldFrom: "type" }),
      radius: number,
    },
    {
      tag: tag("Square", { renameTagFrom: "square", renameFieldFrom: "type" }),
      size: number,
    },
  ]);

  type InferredType = Infer<typeof decoder>;
  type ExpectedType =
    | { tag: "Circle"; radius: number }
    | { tag: "Square"; size: number };
  expectType<TypeEqual<InferredType, ExpectedType>>(true);

  expect(decoder({ type: "circle", radius: 5 })).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "radius": 5,
        "tag": "Circle",
      },
    }
  `);
});
