import { expectType, TypeEqual } from "ts-expect";

import {
  Decoder,
  DecoderError,
  DecoderErrorVariant,
  fields,
  nullable,
  optional,
  repr,
  ReprOptions,
  string,
  tuple,
} from "..";

expect.addSnapshotSerializer({
  test: (value: unknown): boolean => typeof value === "string",
  print: String,
});

function thrownError<T>(decoder: Decoder<T>, value: unknown): DecoderError {
  try {
    decoder(value);
  } catch (error) {
    if (error instanceof DecoderError) {
      return error;
    }
    throw new Error(
      `Expected the decoder to throw a DecoderError, but it threw something else: ${repr(
        error
      )}`
    );
  }
  throw new Error(`Expected the decoder to throw an error, but it didn’t`);
}

describe("constructor", () => {
  expectType<TypeEqual<DecoderError["variant"], DecoderErrorVariant>>(true);

  test("custom error", () => {
    const error = new DecoderError({
      message: "Expected a valid regex",
      value: "+",
    });
    const error2 = new DecoderError({
      tag: "custom",
      message: "Expected a valid regex",
      got: "+",
    });

    // `.message` is sensitive.
    expect(error.message).toMatchInlineSnapshot(`
          Expected a valid regex
          Got: string
      `);
    expect(error2.message).toBe(error.message);

    expect(error.variant).toStrictEqual({
      tag: "custom",
      message: "Expected a valid regex",
      got: "+",
    });
    expect(error2.variant).toStrictEqual(error.variant);

    expect(error.path).toStrictEqual([]);
    expect(error2.path).toStrictEqual(error.path);

    expect(error.format()).toMatchInlineSnapshot(`
          At root:
          Expected a valid regex
          Got: "+"
      `);
    expect(error2.format()).toStrictEqual(error.format());
  });

  test("custom error with key", () => {
    const error = new DecoderError({
      message: "Expected a valid regex",
      value: "+",
      key: "test-key",
    });
    const error2 = new DecoderError({
      tag: "custom",
      message: "Expected a valid regex",
      got: "+",
      key: "test-key",
    });

    // `.message` is sensitive.
    expect(error.message).toMatchInlineSnapshot(`
          Expected a valid regex
          Got: string
      `);
    expect(error2.message).toBe(error.message);

    expect(error.variant).toStrictEqual({
      tag: "custom",
      message: "Expected a valid regex",
      got: "+",
    });
    expect(error2.variant).toStrictEqual(error.variant);

    expect(error.path).toStrictEqual(["test-key"]);
    expect(error2.path).toStrictEqual(error.path);

    expect(error.format()).toMatchInlineSnapshot(`
          At root["test-key"]:
          Expected a valid regex
          Got: "+"
      `);
    expect(error2.format()).toStrictEqual(error.format());
  });

  test("built-in error", () => {
    const error = new DecoderError({ tag: "string", got: 5 });
    expect(error.format()).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 5
    `);
  });
});

describe("static at", () => {
  DecoderError.at(1, 1);
  DecoderError.at(1);

  test("mutates DecoderError", () => {
    const error = new DecoderError({ tag: "array", got: null });
    expect(error.path).toStrictEqual([]);
    const returned = DecoderError.at(error, "test-key");
    expect(returned).toBe(error);
    expect(error.path).toStrictEqual(["test-key"]);
    DecoderError.at(error, 0);
    expect(error.path).toStrictEqual([0, "test-key"]);
  });

  test("wraps other errors", () => {
    const error = new Error("something broke");
    const error2 = DecoderError.at(error, 0);
    expect(error2).not.toBe(error);
    expect(error2).toBeInstanceOf(DecoderError);
    expect(error2.message).toMatchInlineSnapshot(`something broke`);
    expect(error2.path).toStrictEqual([0]);
    expect(error2.variant).toStrictEqual({
      tag: "custom",
      message: "something broke",
      got: DecoderError.MISSING_VALUE,
    });
    expect(error2.format()).toMatchInlineSnapshot(`
      At root[0]:
      something broke
    `);
  });

  test("handles thrown non-errors", () => {
    const error = ["text", 5];
    const error2 = DecoderError.at(error, 0);
    expect(error2).not.toBe(error);
    expect(error2).toBeInstanceOf(DecoderError);
    expect(error2.message).toMatchInlineSnapshot(`text,5`);
    expect(error2.path).toStrictEqual([0]);
    expect(error2.variant).toStrictEqual({
      tag: "custom",
      message: "text,5",
      got: DecoderError.MISSING_VALUE,
    });
    expect(error2.format()).toMatchInlineSnapshot(`
      At root[0]:
      text,5
    `);
  });
});

describe("format", () => {
  expectType<
    TypeEqual<Parameters<DecoderError["format"]>[0], ReprOptions | undefined>
  >(true);

  test("keys are properly stringified", () => {
    const error = new DecoderError({ tag: "string", got: 5 });
    DecoderError.at(error, `"quoted"`);
    DecoderError.at(error, 2e50);
    DecoderError.at(error, `with\nwhite space\t`);
    expect(error.format()).toMatchInlineSnapshot(`
      At root["with\\nwhite space\\t"][2e+50]["\\"quoted\\""]:
      Expected a string
      Got: 5
    `);
  });

  test("options", () => {
    const error = new DecoderError({
      tag: "string",
      got: ["abc", { a: 2 }, 2],
    });
    expect(error.format()).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: ["abc", Object(1), 2]
    `);
    expect(error.format({ sensitive: true, maxArrayChildren: 2 }))
      .toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: [string, Object(1), (1 more)]
    `);
  });
});
