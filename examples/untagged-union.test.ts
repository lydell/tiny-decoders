import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  array,
  Codec,
  field,
  fields,
  Infer,
  InferEncoded,
  number,
  string,
  tag,
  taggedUnion,
  unknown,
} from "../";
import { run } from "../tests/helpers";

test("untagged union", () => {
  type User = {
    name: string;
    followers: number;
  };

  type Failure = {
    error: string;
    errorCode: number;
  };

  type UserResult = Failure | User;

  const userCodec = fields({
    name: string,
    followers: number,
  });

  const failureCodec = fields({
    error: string,
    errorCode: number,
  });

  const userResultCodec: Codec<UserResult> = {
    decoder: (value) =>
      // This is a bit annoying to do. Prefer a tagged union and use `fields`.
      // But when that’s not possible, this is a simple way of “committing” to one
      // of the union variants and choosing a decoder based on that.
      // This approach results in much easier to understand error messages at
      // runtime than an approach of first trying the first decoder, and then
      // the second (because if both fail, you need to display both error messages).
      typeof value === "object" && value !== null && "error" in value
        ? failureCodec.decoder(value)
        : userCodec.decoder(value),
    encoder: (value) =>
      "error" in value ? failureCodec.encoder(value) : userCodec.encoder(value),
  };

  expect(userResultCodec.decoder({ name: "John", followers: 42 }))
    .toMatchInlineSnapshot(`
      {
        "tag": "Valid",
        "value": {
          "followers": 42,
          "name": "John",
        },
      }
    `);

  expect(userResultCodec.encoder({ name: "John", followers: 42 }))
    .toMatchInlineSnapshot(`
    {
      "followers": 42,
      "name": "John",
    }
  `);

  expect(userResultCodec.decoder({ error: "Not found", errorCode: 404 }))
    .toMatchInlineSnapshot(`
      {
        "tag": "Valid",
        "value": {
          "error": "Not found",
          "errorCode": 404,
        },
      }
    `);

  expect(userResultCodec.encoder({ error: "Not found", errorCode: 404 }))
    .toMatchInlineSnapshot(`
    {
      "error": "Not found",
      "errorCode": 404,
    }
  `);
});

test("tagged tuples", () => {
  // A codec that turns `[a, b, c]` into `{ 0: a, 1: b, 2: c }` and back.
  const arrayToObject: Codec<Record<string, unknown>, Array<unknown>> = {
    decoder: (value) => {
      const arrResult = array(unknown).decoder(value);
      if (arrResult.tag === "DecoderError") {
        return arrResult;
      }
      const result: Record<string, unknown> = {};
      for (const [index, item] of arrResult.value.entries()) {
        result[index] = item;
      }
      return { tag: "Valid", value: result };
    },
    encoder: (value) => {
      const result: Array<unknown> = [];
      for (const key in value) {
        const num = Number(key);
        if (Number.isFinite(num)) {
          result[num] = value[key];
        }
      }
      return result;
    },
  };

  // A function that takes a regular `taggedUnion` codec, but makes it work on
  // tagged tuples instead.
  function toArrayUnion<
    Decoded extends Record<string, unknown>,
    Encoded extends Record<string, unknown>,
  >(codec: Codec<Decoded, Encoded>): Codec<Decoded, Array<unknown>> {
    return {
      decoder: (value) => {
        const decoderResult = arrayToObject.decoder(value);
        switch (decoderResult.tag) {
          case "DecoderError":
            return decoderResult;
          case "Valid":
            return codec.decoder(decoderResult.value);
        }
      },
      encoder: (value) => arrayToObject.encoder(codec.encoder(value)),
    };
  }

  type Shape = Infer<typeof Shape>;
  const Shape = toArrayUnion(
    taggedUnion("tag", [
      {
        tag: tag("Circle", { renameFieldFrom: "0" }),
        radius: field(number, { renameFrom: "1" }),
      },
      {
        tag: tag("Rectangle", { renameFieldFrom: "0" }),
        width: field(number, { renameFrom: "1" }),
        height: field(number, { renameFrom: "2" }),
      },
    ]),
  );

  expectType<
    TypeEqual<
      Shape,
      | {
          tag: "Circle";
          radius: number;
        }
      | {
          tag: "Rectangle";
          width: number;
          height: number;
        }
    >
  >(true);

  expectType<TypeEqual<InferEncoded<typeof Shape>, Array<unknown>>>(true);

  expect(run(Shape, ["Circle", 5])).toStrictEqual({ tag: "Circle", radius: 5 });
  expect(run(Shape, ["Rectangle", 5, 6])).toStrictEqual({
    tag: "Rectangle",
    width: 5,
    height: 6,
  });

  expect(Shape.encoder({ tag: "Circle", radius: 5 })).toStrictEqual([
    "Circle",
    5,
  ]);
  expect(
    Shape.encoder({ tag: "Rectangle", width: 5, height: 6 }),
  ).toStrictEqual(["Rectangle", 5, 6]);

  // The error messages aren’t perfect, but still quite understandable.
  expect(run(Shape, ["Square", 5])).toMatchInlineSnapshot(`
    At root["0"]:
    Expected one of these tags:
      "Circle",
      "Rectangle"
    Got: "Square"
  `);

  expect(run(Shape, ["Circle", "5"])).toMatchInlineSnapshot(`
    At root["1"]:
    Expected a number
    Got: "5"
  `);

  expect(run(Shape, ["Circle"])).toMatchInlineSnapshot(`
    At root:
    Expected an object with a field called: "1"
    Got: {
      "0": "Circle"
    }
  `);

  expect(run(Shape, [])).toMatchInlineSnapshot(`
    At root:
    Expected an object with a field called: "0"
    Got: {}
  `);
});
