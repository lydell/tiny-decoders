import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { Codec, fieldsUnion, Infer, number, tag } from "../";

test("using different tags in JSON and in TypeScript", () => {
  // There’s nothing stopping you from using different keys and values in JSON
  // and TypeScript. For example, `"type": "Ring"` → `tag: "Circle"`.

  // On this line we specify the TypeScript common field name:
  const codec = fieldsUnion("tag", [
    {
      // Here we specify the common field name used in JSON ("type").
      // Unfortunately you need to specify it on every variant (and it has to be
      // the same for all of them).
      tag: tag("Square", { renameFieldFrom: "type" }),
      size: number,
    },
    {
      // Here we also translate the "Ring" JSON tag name to "Circle" in TypeScript.
      tag: tag("Circle", { renameTagFrom: "Ring", renameFieldFrom: "type" }),
      radius: number,
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

  // Here’s a test for using `renameTagFrom` without `renameTagFrom`.
  const codec2 = fieldsUnion("tag", [
    {
      tag: tag("Rectangle", { renameTagFrom: "rectangle" }),
      width: number,
      height: number,
    },
  ]);
  expectType<
    TypeEqual<
      typeof codec2,
      Codec<
        {
          tag: "Rectangle";
          width: number;
          height: number;
        },
        {
          tag: "rectangle";
          width: number;
          height: number;
        }
      >
    >
  >(true);
});
