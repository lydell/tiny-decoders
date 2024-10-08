import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import { Codec, Infer, number, tag, taggedUnion } from "../index.js";
import { run } from "../tests/helpers.js";

test("taggedUnion with fallback for unknown tags", () => {
  // Here’s a helper function that takes a codec – which is supposed to be a
  // `taggedUnion` codec – and makes it return `undefined` if the tag is unknown.
  function handleUnknownTag<Decoded, Encoded>(
    codec: Codec<Decoded, Encoded>,
  ): Codec<Decoded | undefined, Encoded | undefined> {
    return {
      decoder: (value) => {
        const decoderResult = codec.decoder(value);
        switch (decoderResult.tag) {
          case "DecoderError":
            return decoderResult.error.path.length === 1 && // Don’t match on nested `taggedUnion`.
              decoderResult.error.tag === "unknown taggedUnion tag"
              ? { tag: "Valid", value: undefined }
              : decoderResult;
          case "Valid":
            return decoderResult;
        }
      },
      encoder: (value) =>
        value === undefined ? undefined : codec.encoder(value),
    };
  }

  const shapeCodec = taggedUnion("tag", [
    { tag: tag("Circle"), radius: number },
    { tag: tag("Square"), side: number },
  ]);

  const codec = taggedUnion("tag", [
    { tag: tag("One") },
    { tag: tag("Two"), value: shapeCodec },
  ]);

  const codecWithFallback = handleUnknownTag(codec);

  expectType<
    TypeEqual<
      Infer<typeof codec>,
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
    TypeEqual<Infer<typeof codec> | undefined, Infer<typeof codecWithFallback>>
  >(true);

  expect(run(codec, { tag: "One" })).toStrictEqual({ tag: "One" });
  expect(run(codecWithFallback, { tag: "One" })).toStrictEqual({
    tag: "One",
  });

  // The original decoder fails on unknown tags, while the other one returns `undefined`.
  expect(run(codec, { tag: "Three" })).toMatchInlineSnapshot(`
    At root["tag"]:
    Expected one of these tags:
      "One",
      "Two"
    Got: "Three"
  `);
  expect(run(codecWithFallback, { tag: "Three" })).toBeUndefined();

  // A nested `taggedUnion` still fails on unknown tags:
  expect(run(codecWithFallback, { tag: "Two", value: { tag: "Rectangle" } }))
    .toMatchInlineSnapshot(`
    At root["value"]["tag"]:
    Expected one of these tags:
      "Circle",
      "Square"
    Got: "Rectangle"
  `);
});
