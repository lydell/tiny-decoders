import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { Decoder, DecoderError, fieldsUnion, Infer, number, tag } from "../";

test("fieldsUnion with fallback for unknown tags", () => {
  // Here’s a helper function that takes a decoder – which is supposed to be a
  // `fieldsUnion` decoder – and makes it return `undefined` if the tag is unknown.
  function handleUnknownTag<T>(decoder: Decoder<T>): Decoder<T | undefined> {
    return (value) => {
      try {
        return decoder(value);
      } catch (error) {
        const newError = DecoderError.at(error);
        if (
          newError.path.length === 1 && // Don’t match on nested `fieldsUnion`.
          newError.variant.tag === "unknown fieldsUnion tag"
        ) {
          return undefined;
        }
        throw newError;
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

  expect(decoder({ tag: "One" })).toStrictEqual({ tag: "One" });
  expect(decoderWithFallback({ tag: "One" })).toStrictEqual({ tag: "One" });

  // The original decoder fails on unknown tags, while the other one returns `undefined`.
  expect(() => decoder({ tag: "Three" })).toThrowErrorMatchingInlineSnapshot(`
    "Expected one of these tags:
      \\"One\\",
      \\"Two\\"
    Got: string
    (Actual values are hidden in sensitive mode.)

    For better error messages, see https://github.com/lydell/tiny-decoders#error-messages"
  `);
  expect(decoderWithFallback({ tag: "Three" })).toBeUndefined();

  // A nested `fieldsUnion` still fails on unknown tags:
  expect(() => decoderWithFallback({ tag: "Two", value: { tag: "Rectangle" } }))
    .toThrowErrorMatchingInlineSnapshot(`
    "Expected one of these tags:
      \\"Circle\\",
      \\"Square\\"
    Got: string
    (Actual values are hidden in sensitive mode.)

    For better error messages, see https://github.com/lydell/tiny-decoders#error-messages"
  `);
});
