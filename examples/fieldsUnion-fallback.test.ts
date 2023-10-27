import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { Decoder, fieldsUnion, Infer, number, tag } from "../";
import { run } from "../tests/helpers";

test("fieldsUnion with fallback for unknown tags", () => {
  // Here’s a helper function that takes a decoder – which is supposed to be a
  // `fieldsUnion` decoder – and makes it return `undefined` if the tag is unknown.
  function handleUnknownTag<T>(decoder: Decoder<T>): Decoder<T | undefined> {
    return (value) => {
      const decoderResult = decoder(value);
      switch (decoderResult.tag) {
        case "DecoderError":
          return decoderResult.error.path.length === 1 && // Don’t match on nested `fieldsUnion`.
            decoderResult.error.tag === "unknown fieldsUnion tag"
            ? { tag: "Valid", value: undefined }
            : decoderResult;
        case "Valid":
          return decoderResult;
      }
    };
  }

  const shapeDecoder = fieldsUnion("tag", [
    { tag: tag("Circle"), radius: number },
    { tag: tag("Square"), side: number },
  ]);

  const decoder = fieldsUnion("tag", [
    { tag: tag("One") },
    { tag: tag("Two"), value: shapeDecoder },
  ]);

  const decoderWithFallback = handleUnknownTag(decoder);

  expectType<
    TypeEqual<
      Infer<typeof decoder>,
      | {
          tag: "One";
        }
      | {
          tag: "Two";
          value:
            | { tag: "Circle"; radius: number }
            | { tag: "Square"; side: number };
        }
    >
  >(true);

  expectType<
    TypeEqual<
      Infer<typeof decoder> | undefined,
      Infer<typeof decoderWithFallback>
    >
  >(true);

  expect(run(decoder, { tag: "One" })).toStrictEqual({ tag: "One" });
  expect(run(decoderWithFallback, { tag: "One" })).toStrictEqual({
    tag: "One",
  });

  // The original decoder fails on unknown tags, while the other one returns `undefined`.
  expect(run(decoder, { tag: "Three" })).toMatchInlineSnapshot(`
    At root["tag"]:
    Expected one of these tags:
      "One",
      "Two"
    Got: "Three"
  `);
  expect(run(decoderWithFallback, { tag: "Three" })).toBeUndefined();

  // A nested `fieldsUnion` still fails on unknown tags:
  expect(run(decoderWithFallback, { tag: "Two", value: { tag: "Rectangle" } }))
    .toMatchInlineSnapshot(`
    At root["value"]["tag"]:
    Expected one of these tags:
      "Circle",
      "Square"
    Got: "Rectangle"
  `);
});
