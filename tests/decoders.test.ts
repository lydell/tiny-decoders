import { expectType, TypeEqual } from "ts-expect";
import { describe, expect, test } from "vitest";

import {
  array,
  boolean,
  Decoder,
  DecoderResult,
  field,
  fieldsAuto,
  fieldsUnion,
  flatMap,
  Infer,
  map,
  multi,
  nullable,
  number,
  record,
  recursive,
  string,
  stringUnion,
  tag,
  tuple,
  undefinedOr,
} from "..";
import { run } from "./helpers";

test("boolean", () => {
  expect(run(boolean, true)).toBe(true);
  expect(run(boolean, false)).toBe(false);

  expectType<DecoderResult<boolean>>(boolean(true));
  // @ts-expect-error Expected 1 arguments, but got 2.
  boolean(true, []);

  expect(run(boolean, 0)).toMatchInlineSnapshot(`
    At root:
    Expected a boolean
    Got: 0
  `);
});

test("number", () => {
  expect(run(number, 0)).toBe(0);
  expect(run(number, Math.PI)).toBe(3.141592653589793);
  expect(run(number, NaN)).toBeNaN();
  expect(run(number, Infinity)).toBe(Infinity);
  expect(run(number, -Infinity)).toBe(-Infinity);

  expectType<DecoderResult<number>>(number(0));
  // @ts-expect-error Expected 1 arguments, but got 2.
  number(0, []);

  expect(run(number, undefined)).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: undefined
  `);
});

test("string", () => {
  expect(run(string, "")).toBe("");
  expect(run(string, "string")).toBe("string");

  expectType<DecoderResult<string>>(string(""));
  // @ts-expect-error Expected 1 arguments, but got 2.
  string("", []);

  expect(run(string, Symbol("desc"))).toMatchInlineSnapshot(`
    At root:
    Expected a string
    Got: Symbol(desc)
  `);
});

describe("stringUnion", () => {
  test("basic", () => {
    type Color = Infer<typeof colorDecoder>;
    const colorDecoder = stringUnion(["red", "green", "blue"]);

    expectType<TypeEqual<Color, "blue" | "green" | "red">>(true);

    const red: Color = "red";
    void red;

    // @ts-expect-error Type '"yellow"' is not assignable to type '"red" | "green" | "blue"'.
    const yellow: Color = "yellow";
    void yellow;

    expect(run(colorDecoder, "red")).toBe("red");
    expect(run(colorDecoder, "green")).toBe("green");
    expect(run(colorDecoder, "blue")).toBe("blue");

    expectType<DecoderResult<Color>>(colorDecoder("red"));
    // @ts-expect-error Argument of type '{ one: null; two: null; }' is not assignable to parameter of type 'readonly string[]'.
    stringUnion({ one: null, two: null });

    expect(run(colorDecoder, "Red")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants:
        "red",
        "green",
        "blue"
      Got: "Red"
    `);

    expect(run(colorDecoder, 0)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 0
    `);
  });

  test("empty array is not allowed", () => {
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [string, ...string[]]'.
    //   Source has 0 element(s) but target requires 1.
    const emptyDecoder = stringUnion([]);
    expect(run(emptyDecoder, "test")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: (none)
      Got: "test"
    `);
  });

  test("variants must be strings", () => {
    // @ts-expect-error Type 'number' is not assignable to type 'string'.
    stringUnion([1]);
    const goodDecoder = stringUnion(["1"]);
    expectType<TypeEqual<Infer<typeof goodDecoder>, "1">>(true);
    expect(run(goodDecoder, "1")).toBe("1");
  });

  test("always print the expected tags in full", () => {
    const decoder = stringUnion(["PrettyLongTagName1", "PrettyLongTagName2"]);

    expect(
      run(decoder, "PrettyLongTagNameButWrong", {
        maxLength: 8,
        maxArrayChildren: 1,
        indent: " ".repeat(8),
      }),
    ).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants:
              "PrettyLongTagName1",
              "PrettyLongTagName2"
      Got: "Pre…ong"
    `);
  });
});

describe("array", () => {
  test("basic", () => {
    type Bits = Infer<typeof bitsDecoder>;
    const bitsDecoder = array(stringUnion(["0", "1"]));

    expectType<TypeEqual<Bits, Array<"0" | "1">>>(true);
    expectType<DecoderResult<Bits>>(bitsDecoder([]));

    expect(run(bitsDecoder, [])).toStrictEqual([]);
    expect(run(bitsDecoder, ["0"])).toStrictEqual(["0"]);
    expect(run(bitsDecoder, ["0", "1", "1", "0"])).toStrictEqual([
      "0",
      "1",
      "1",
      "0",
    ]);

    expect(run(bitsDecoder, ["0", "2"])).toMatchInlineSnapshot(`
      At root[1]:
      Expected one of these variants:
        "0",
        "1"
      Got: "2"
    `);

    expect(run(array(number), { length: 0 })).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: {
        "length": 0
      }
    `);
    expect(run(array(number), new Int32Array(2))).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: Int32Array
    `);
  });
});

describe("record", () => {
  test("basic", () => {
    type Registers = Infer<typeof registersDecoder>;
    const registersDecoder = record(stringUnion(["0", "1"]));

    expectType<TypeEqual<Registers, Record<string, "0" | "1">>>(true);
    expectType<DecoderResult<Registers>>(registersDecoder({}));

    expect(run(registersDecoder, {})).toStrictEqual({});
    expect(run(registersDecoder, { a: "0" })).toStrictEqual({ a: "0" });
    expect(
      run(registersDecoder, { a: "0", b: "1", c: "1", d: "0" }),
    ).toStrictEqual({ a: "0", b: "1", c: "1", d: "0" });

    expect(run(registersDecoder, { a: "0", b: "2" })).toMatchInlineSnapshot(`
      At root["b"]:
      Expected one of these variants:
        "0",
        "1"
      Got: "2"
    `);

    expect(run(record(number), [1])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [
        1
      ]
    `);
  });

  test("keys to regex", () => {
    const decoder = flatMap(record(string), (items) => {
      const result: Array<[RegExp, string]> = [];
      for (const [key, value] of Object.entries(items)) {
        try {
          result.push([RegExp(key, "u"), value]);
        } catch (error) {
          return {
            tag: "DecoderError",
            error: {
              tag: "custom",
              message: error instanceof Error ? error.message : String(error),
              got: key,
              path: [key],
            },
          };
        }
      }
      return { tag: "Valid", value: result };
    });

    expectType<TypeEqual<Infer<typeof decoder>, Array<[RegExp, string]>>>(true);

    const good = { "\\d{4}:\\d{2}": "Year/month", ".*": "Rest" };
    const bad = { "\\d{4}:\\d{2": "Year/month", ".*": "Rest" };

    expect(run(decoder, good)).toStrictEqual([
      [/\d{4}:\d{2}/u, "Year/month"],
      [/.*/u, "Rest"],
    ]);

    // To avoid slightly different error messages on different Node.js versions.
    const cleanRegexError = <T>(message: T | string): T | string =>
      typeof message === "string"
        ? message.replace(
            /(Invalid regular expression):.*/,
            "$1: (the regex error)",
          )
        : message;

    expect(cleanRegexError(run(decoder, bad))).toMatchInlineSnapshot(
      `
      At root["\\\\d{4}:\\\\d{2"]:
      Invalid regular expression: (the regex error)
      Got: "\\\\d{4}:\\\\d{2"
    `,
    );

    expect(
      cleanRegexError(run(fieldsAuto({ regexes: decoder }), { regexes: bad })),
    ).toMatchInlineSnapshot(`
      At root["regexes"]["\\\\d{4}:\\\\d{2"]:
      Invalid regular expression: (the regex error)
      Got: "\\\\d{4}:\\\\d{2"
    `);
  });

  test("ignores __proto__", () => {
    expect(
      run(record(number), JSON.parse(`{"a": 1, "__proto__": 2, "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });
  });
});

describe("fieldsAuto", () => {
  // @ts-expect-error Argument of type '((value: unknown) => string)[]' is not assignable to parameter of type 'FieldsMapping'.
  fieldsAuto([string]);

  test("basic", () => {
    type Person = Infer<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      id: number,
      firstName: string,
    });

    expectType<TypeEqual<Person, { id: number; firstName: string }>>(true);
    expectType<DecoderResult<Person>>(
      personDecoder({ id: 1, firstName: "John" }),
    );

    expect(run(personDecoder, { id: 1, firstName: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(run(personDecoder, { id: "1", firstName: "John" }))
      .toMatchInlineSnapshot(`
        At root["id"]:
        Expected a number
        Got: "1"
      `);

    expect(run(personDecoder, { id: 1, first_name: "John" }))
      .toMatchInlineSnapshot(`
        At root:
        Expected an object with a field called: "firstName"
        Got: {
          "id": 1,
          "first_name": "John"
        }
      `);

    expect(run(fieldsAuto({ 0: number }), [1])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [
        1
      ]
    `);
  });

  test("optional and renamed fields", () => {
    type Person = Infer<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      id: number,
      firstName: field(string, { renameFrom: "first_name" }),
      lastName: field(string, { renameFrom: "last_name", optional: true }),
      age: field(number, { optional: true }),
      likes: field(undefinedOr(number), { optional: true }),
      followers: field(undefinedOr(number), {}),
    });

    // @ts-expect-error Argument of type '{ tag: { decoded: string; encoded: string; }; }' is not assignable to parameter of type 'Omit<FieldMeta, "tag">'.
    //   Object literal may only specify known properties, and 'tag' does not exist in type 'Omit<FieldMeta, "tag">'.
    field(string, { tag: { decoded: "A", encoded: "a" } });

    expectType<
      TypeEqual<
        Person,
        {
          id: number;
          firstName: string;
          lastName?: string;
          age?: number;
          likes?: number | undefined;
          followers: number | undefined;
        }
      >
    >(true);
    expectType<DecoderResult<Person>>(
      personDecoder({ id: 1, first_name: "John", followers: undefined }),
    );

    expect(
      run(personDecoder, {
        id: 1,
        firstName: "John",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "first_name"
      Got: {
        "id": 1,
        "firstName": "John",
        "followers": undefined
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: false,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      At root["first_name"]:
      Expected a string
      Got: false
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "firstName": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        lastName: "Doe",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "firstName": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "firstName": "John",
        "followers": undefined,
        "id": 1,
        "lastName": "Doe",
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        age: 42,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "age": 42,
        "firstName": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        age: undefined,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      At root["age"]:
      Expected a number
      Got: undefined
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        likes: 42,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "firstName": "John",
        "followers": undefined,
        "id": 1,
        "likes": 42,
      }
    `);

    expect(
      run(personDecoder, {
        id: 1,
        first_name: "John",
        likes: undefined,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "firstName": "John",
        "followers": undefined,
        "id": 1,
        "likes": undefined,
      }
    `);
  });

  describe("allowExtraFields", () => {
    test("allows excess properties by default", () => {
      expect(
        run(fieldsAuto({ one: string, two: boolean }), {
          one: "a",
          two: true,
          three: 3,
          four: {},
        }),
      ).toStrictEqual({ one: "a", two: true });
      expect(
        run(
          fieldsAuto({ one: string, two: boolean }, { allowExtraFields: true }),
          { one: "a", two: true, three: 3, four: {} },
        ),
      ).toStrictEqual({ one: "a", two: true });
    });

    test("fail on excess properties", () => {
      expect(
        run(
          fieldsAuto(
            { one: string, two: boolean },
            { allowExtraFields: false },
          ),
          {
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields:
          "one",
          "two"
        Found extra fields:
          "three",
          "four"
      `);
    });

    test("large number of excess properties", () => {
      expect(
        run(
          fieldsAuto(
            { "1": boolean, "2": boolean },
            { allowExtraFields: false },
          ),
          Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, false])),
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields:
          "1",
          "2"
        Found extra fields:
          "0",
          "3",
          "4",
          "5",
          "6",
          (93 more)
      `);
    });

    test("always print the expected keys in full", () => {
      const decoder = fieldsAuto(
        {
          PrettyLongTagName1: string,
          PrettyLongTagName2: string,
        },
        { allowExtraFields: false },
      );

      expect(
        run(
          decoder,
          {
            PrettyLongTagName1: "",
            PrettyLongTagName2: "",
            PrettyLongTagButWrong: "",
          },
          {
            maxLength: 8,
            maxArrayChildren: 1,
            indent: " ".repeat(8),
          },
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields:
                "PrettyLongTagName1",
                "PrettyLongTagName2"
        Found extra fields:
                "Pre…ong"
      `);
    });
  });

  test("__proto__ is not allowed", () => {
    const decoder = fieldsAuto({ a: number, __proto__: string, b: number });
    expect(
      run(decoder, JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });

    const desc = Object.create(null) as { __proto__: Decoder<string> };
    desc.__proto__ = string;
    const decoder2 = fieldsAuto(desc);
    expect(run(decoder2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
  });

  test("renaming from __proto__ is not allowed", () => {
    const decoder = fieldsAuto({
      a: number,
      b: field(string, { renameFrom: "__proto__" }),
    });
    expect(
      run(decoder, JSON.parse(`{"a": 1, "__proto__": "a"}`)),
    ).toStrictEqual({ a: 1 });

    const desc = Object.create(null) as { __proto__: Decoder<string> };
    desc.__proto__ = string;
    const decoder2 = fieldsAuto(desc);
    expect(run(decoder2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
  });

  test("empty object", () => {
    const decoder = fieldsAuto({}, { allowExtraFields: false });
    expect(run(decoder, {})).toStrictEqual({});
    expect(run(decoder, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: (none)
      Found extra fields:
        "a"
    `);
  });
});

describe("fieldsUnion", () => {
  test("basic", () => {
    type Shape = Infer<typeof shapeDecoder>;
    const shapeDecoder = fieldsUnion("tag", [
      {
        tag: tag("Circle"),
        radius: number,
      },
      {
        tag: tag("Rectangle"),
        width: field(number, { renameFrom: "width_px" }),
        height: field(number, { renameFrom: "height_px" }),
      },
    ]);

    expectType<
      TypeEqual<
        Shape,
        | { tag: "Circle"; radius: number }
        | { tag: "Rectangle"; width: number; height: number }
      >
    >(true);
    expectType<DecoderResult<Shape>>(
      shapeDecoder({ tag: "Circle", radius: 5 }),
    );

    expect(run(shapeDecoder, { tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(run(shapeDecoder, { tag: "Rectangle", radius: 5 }))
      .toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "width_px"
      Got: {
        "tag": "Rectangle",
        "radius": 5
      }
    `);

    expect(run(shapeDecoder, { tag: "Square", size: 5 }))
      .toMatchInlineSnapshot(`
        At root["tag"]:
        Expected one of these tags:
          "Circle",
          "Rectangle"
        Got: "Square"
      `);

    expect(run(fieldsUnion("0", [{ "0": tag("a") }]), ["a"]))
      .toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [
        "a"
      ]
    `);
  });

  test("__proto__ is not allowed", () => {
    expect(() =>
      fieldsUnion("__proto__", [{ __proto__: tag("Test") }]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: commonField cannot be __proto__"',
    );
  });

  test("empty object is not allowed", () => {
    expect(() =>
      // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [Variant<"tag">, ...Variant<"tag">[]]'.
      //   Source has 0 element(s) but target requires 1.
      fieldsUnion("tag", []),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: Got unusable encoded common field: undefined"',
    );
  });

  test("decodedCommonField mismatch", () => {
    expect(() =>
      // @ts-expect-error Property 'tag' is missing in type '{ type: Field<"Test", { tag: { decoded: string; encoded: string; }; }>; }' but required in type 'Record<"tag", Field<any, { tag: { decoded: string; encoded: string; }; }>>'.
      fieldsUnion("tag", [{ type: tag("Test") }]),
    ).toThrow();
  });

  test("one variant uses wrong decodedCommonField", () => {
    expect(() =>
      // @ts-expect-error Property 'tag' is missing in type '{ type: Field<"B", { tag: { decoded: string; encoded: string; }; }>; }' but required in type 'Record<"tag", Field<any, { tag: { decoded: string; encoded: string; }; }>>'.
      fieldsUnion("tag", [{ tag: tag("A") }, { type: tag("B") }]),
    ).toThrow();
  });

  test("decodedCommonField does not use the tag function", () => {
    expect(() =>
      // @ts-expect-error Type '(value: unknown) => string' is not assignable to type 'Field<any, { tag: { decoded: string; encoded: string; }; }>'.
      fieldsUnion("tag", [{ tag: string }]),
    ).toThrow();
  });

  test("encodedCommonField mismatch", () => {
    expect(() =>
      // TODO: This will be a TypeScript error in an upcoming version of tiny-decoders.
      fieldsUnion("tag", [
        { tag: tag("A") },
        { tag: tag("B", { renameFieldFrom: "type" }) },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: Variant at index 1: Key \\"tag\\": Got a different encoded field name (\\"type\\") than before (\\"tag\\")."',
    );
  });

  test("same encodedCommonField correctly used on every variant", () => {
    const decoder = fieldsUnion("tag", [
      { tag: tag("A", { renameFieldFrom: "type" }) },
      { tag: tag("B", { renameFieldFrom: "type" }) },
    ]);
    expectType<TypeEqual<Infer<typeof decoder>, { tag: "A" } | { tag: "B" }>>(
      true,
    );
    expect(run(decoder, { type: "A" })).toStrictEqual({ tag: "A" });
    expect(run(decoder, { type: "B" })).toStrictEqual({ tag: "B" });
  });

  test("same tag used twice", () => {
    type Type = Infer<typeof decoder>;
    const decoder = fieldsUnion("tag", [
      { tag: tag("Test"), one: number },
      { tag: tag("Test"), two: string },
    ]);

    expectType<
      TypeEqual<
        Type,
        | {
            tag: "Test";
            one: number;
          }
        | {
            tag: "Test";
            two: string;
          }
      >
    >(true);

    // The last one wins:
    expect(run(decoder, { tag: "Test", two: "a" })).toStrictEqual({
      tag: "Test",
      two: "a",
    });

    // The first one never matches and always fails:
    expect(run(decoder, { tag: "Test", one: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "two"
      Got: {
        "tag": "Test",
        "one": 1
      }
    `);
  });

  test("generic decoder", () => {
    type Result<Ok, Err> =
      | { tag: "Err"; error: Err }
      | { tag: "Ok"; value: Ok };

    const resultDecoder = <Ok, Err>(
      okDecoder: Decoder<Ok>,
      errDecoder: Decoder<Err>,
    ): Decoder<Result<Ok, Err>> =>
      fieldsUnion("tag", [
        {
          tag: tag("Ok"),
          value: okDecoder,
        },
        {
          tag: tag("Err"),
          error: errDecoder,
        },
      ]);

    const decoder = resultDecoder(number, string);

    expectType<
      TypeEqual<
        Infer<typeof decoder>,
        { tag: "Err"; error: string } | { tag: "Ok"; value: number }
      >
    >(true);

    expect(run(decoder, { tag: "Ok", value: 0 })).toStrictEqual({
      tag: "Ok",
      value: 0,
    });

    expect(run(decoder, { tag: "Err", error: "" })).toStrictEqual({
      tag: "Err",
      error: "",
    });
  });

  test("always print the expected tags in full", () => {
    const decoder = fieldsUnion("tag", [
      { tag: tag("PrettyLongTagName1"), value: string },
      { tag: tag("PrettyLongTagName2"), value: string },
    ]);

    expect(
      run(
        decoder,
        { tag: "PrettyLongTagNameButWrong" },
        { maxLength: 8, maxArrayChildren: 1, indent: " ".repeat(8) },
      ),
    ).toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags:
              "PrettyLongTagName1",
              "PrettyLongTagName2"
      Got: "Pre…ong"
    `);
  });

  describe("allowExtraFields", () => {
    test("allows excess properties by default", () => {
      expect(
        run(
          fieldsUnion("tag", [{ tag: tag("Test"), one: string, two: boolean }]),
          {
            tag: "Test",
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toStrictEqual({ tag: "Test", one: "a", two: true });
      expect(
        run(
          fieldsUnion(
            "tag",
            [{ tag: tag("Test"), one: string, two: boolean }],
            { allowExtraFields: true },
          ),
          {
            tag: "Test",
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toStrictEqual({ tag: "Test", one: "a", two: true });
    });

    test("fail on excess properties", () => {
      expect(
        run(
          fieldsUnion(
            "tag",
            [{ tag: tag("Test"), one: string, two: boolean }],
            { allowExtraFields: false },
          ),
          {
            tag: "Test",
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toMatchInlineSnapshot(`
      At root:
      Expected only these fields:
        "tag",
        "one",
        "two"
      Found extra fields:
        "three",
        "four"
    `);
    });

    test("large number of excess properties", () => {
      expect(
        run(
          fieldsUnion(
            "tag",
            [{ tag: tag("Test"), "1": boolean, "2": boolean }],
            { allowExtraFields: false },
          ),
          {
            tag: "Test",
            ...Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [i, false]),
            ),
          },
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields:
          "1",
          "2",
          "tag"
        Found extra fields:
          "0",
          "3",
          "4",
          "5",
          "6",
          (93 more)
      `);
    });

    test("always print the expected keys in full", () => {
      const decoder = fieldsUnion(
        "tag",
        [
          {
            tag: tag("Test"),
            PrettyLongTagName1: string,
            PrettyLongTagName2: string,
          },
        ],
        { allowExtraFields: false },
      );

      expect(
        run(
          decoder,
          {
            tag: "Test",
            PrettyLongTagName1: "",
            PrettyLongTagName2: "",
            PrettyLongTagButWrong: "",
          },
          {
            maxLength: 8,
            maxArrayChildren: 1,
            indent: " ".repeat(8),
          },
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields:
                "tag",
                "PrettyLongTagName1",
                "PrettyLongTagName2"
        Found extra fields:
                "Pre…ong"
      `);
    });
  });
});

describe("tag", () => {
  test("basic", () => {
    const { decoder } = tag("Test");
    expectType<TypeEqual<Infer<typeof decoder>, "Test">>(true);
    expect(run(decoder, "Test")).toBe("Test");
    expect(run(decoder, "other")).toMatchInlineSnapshot(`
      At root:
      Expected this string: "Test"
      Got: "other"
    `);
    expect(run(decoder, 0)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 0
    `);
  });

  test("renamed", () => {
    const { decoder } = tag("Test", { renameTagFrom: "test" });
    expectType<TypeEqual<Infer<typeof decoder>, "Test">>(true);
    expect(run(decoder, "test")).toBe("Test");
    expect(run(decoder, "other")).toMatchInlineSnapshot(`
      At root:
      Expected this string: "test"
      Got: "other"
    `);
  });
});

describe("tuple", () => {
  // @ts-expect-error Argument of type '{}' is not assignable to parameter of type 'readonly Decoder<unknown, unknown>[]'.
  tuple({});
  // @ts-expect-error Argument of type '(value: unknown) => number' is not assignable to parameter of type 'readonly Decoder<unknown, unknown>[]'.
  tuple(number);

  test("0 items", () => {
    type Type = Infer<typeof decoder>;
    const decoder = tuple([]);

    expectType<TypeEqual<Type, []>>(true);
    expectType<DecoderResult<Type>>(decoder([]));

    expect(run(decoder, [])).toStrictEqual([]);

    expect(run(decoder, [1])).toMatchInlineSnapshot(`
      At root:
      Expected 0 items
      Got: 1
    `);
  });

  test("1 item", () => {
    type Type = Infer<typeof decoder>;
    const decoder = tuple([number]);

    expectType<TypeEqual<Type, [number]>>(true);
    expectType<DecoderResult<Type>>(decoder([1]));

    expect(run(decoder, [1])).toStrictEqual([1]);

    expect(run(decoder, [])).toMatchInlineSnapshot(`
      At root:
      Expected 1 items
      Got: 0
    `);

    expect(run(decoder, [1, 2])).toMatchInlineSnapshot(`
      At root:
      Expected 1 items
      Got: 2
    `);
  });

  test("2 items", () => {
    type Type = Infer<typeof decoder>;
    const decoder = tuple([number, string]);

    expectType<TypeEqual<Type, [number, string]>>(true);
    expectType<DecoderResult<Type>>(decoder([1, "a"]));

    expect(run(decoder, [1, "a"])).toStrictEqual([1, "a"]);

    expect(run(decoder, [1])).toMatchInlineSnapshot(`
      At root:
      Expected 2 items
      Got: 1
    `);

    expect(run(decoder, ["a", 1])).toMatchInlineSnapshot(`
      At root[0]:
      Expected a number
      Got: "a"
    `);

    expect(run(decoder, [1, "a", 2])).toMatchInlineSnapshot(`
      At root:
      Expected 2 items
      Got: 3
    `);
  });

  test("3 items", () => {
    type Type = Infer<typeof decoder>;
    const decoder = tuple([number, string, boolean]);

    expectType<TypeEqual<Type, [number, string, boolean]>>(true);
    expectType<DecoderResult<Type>>(decoder([1, "a", true]));

    expect(run(decoder, [1, "a", true])).toStrictEqual([1, "a", true]);

    expect(run(decoder, [1, "a"])).toMatchInlineSnapshot(`
      At root:
      Expected 3 items
      Got: 2
    `);

    expect(run(decoder, [1, "a", true, 2])).toMatchInlineSnapshot(`
      At root:
      Expected 3 items
      Got: 4
    `);
  });

  test("4 items", () => {
    type Type = Infer<typeof decoder>;
    const decoder = tuple([number, string, boolean, number]);

    expectType<TypeEqual<Type, [number, string, boolean, number]>>(true);
    expectType<DecoderResult<Type>>(decoder([1, "a", true, 2]));

    expect(run(decoder, [1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);

    expect(run(decoder, [1, "a", true])).toMatchInlineSnapshot(`
      At root:
      Expected 4 items
      Got: 3
    `);

    expect(
      // eslint-disable-next-line no-sparse-arrays
      run(decoder, [1, "a", true, 2, "too", , , "many"]),
    ).toMatchInlineSnapshot(`
      At root:
      Expected 4 items
      Got: 8
    `);
  });

  test("allow only arrays", () => {
    expect(run(tuple([number]), { length: 0 })).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: {
        "length": 0
      }
    `);
    expect(run(tuple([number]), new Int32Array(2))).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: Int32Array
    `);
  });
});

describe("multi", () => {
  test("basic", () => {
    type Id = Infer<typeof idDecoder>;
    const idDecoder = multi(["string", "number"]);

    expectType<
      TypeEqual<
        Id,
        { type: "number"; value: number } | { type: "string"; value: string }
      >
    >(true);
    expectType<DecoderResult<Id>>(idDecoder("123"));

    expect(run(idDecoder, "123")).toStrictEqual({
      type: "string",
      value: "123",
    });

    expect(run(idDecoder, 123)).toStrictEqual({ type: "number", value: 123 });

    expect(run(idDecoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – mapped", () => {
    type Id = Infer<typeof idDecoder>;
    const idDecoder = map(multi(["string", "number"]), (value) => {
      switch (value.type) {
        case "string":
          return { tag: "Id" as const, id: value.value };
        case "number":
          return { tag: "LegacyId" as const, id: value.value };
      }
    });

    expectType<
      TypeEqual<Id, { tag: "Id"; id: string } | { tag: "LegacyId"; id: number }>
    >(true);
    expectType<DecoderResult<Id>>(idDecoder("123"));

    expect(run(idDecoder, "123")).toStrictEqual({ tag: "Id", id: "123" });

    expect(run(idDecoder, 123)).toStrictEqual({ tag: "LegacyId", id: 123 });

    expect(run(idDecoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – variation", () => {
    type Id = Infer<typeof idDecoder>;
    const idDecoder = map(multi(["string", "number"]), (value) => {
      switch (value.type) {
        case "string":
          return value.value;
        case "number":
          return value.value.toString();
      }
    });

    expectType<TypeEqual<Id, string>>(true);
    expectType<DecoderResult<Id>>(idDecoder("123"));

    expect(run(idDecoder, "123")).toBe("123");
    expect(run(idDecoder, 123)).toBe("123");

    expect(run(idDecoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("empty array", () => {
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [MultiTypeName, ...MultiTypeName[]]'.
    //   Source has 0 element(s) but target requires 1.
    const decoder = multi([]);

    expect(run(decoder, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: never
      Got: undefined
    `);
  });

  test("all types", () => {
    const decoder = multi([
      "undefined",
      "null",
      "boolean",
      "number",
      "string",
      "array",
      "object",
    ]);

    const values = [
      undefined,
      null,
      true,
      false,
      0,
      "a",
      [1, 2],
      { a: 1 },
      new Int32Array(2),
      /a/g,
    ];

    for (const value of values) {
      expect(run(decoder, value)).toMatchObject({ value });
    }
  });

  test("coverage", () => {
    const decoder = multi(["undefined"]);

    expect(run(decoder, null)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: null
    `);

    expect(run(decoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: true
    `);

    expect(run(decoder, 0)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: 0
    `);

    expect(run(decoder, "")).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: ""
    `);

    expect(run(decoder, [])).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: []
    `);

    expect(run(decoder, {})).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: {}
    `);
  });
});

describe("recursive", () => {
  test("basic", () => {
    type Recursive = {
      a?: Recursive;
      b: Array<Recursive>;
    };

    const decoder: Decoder<Recursive> = fieldsAuto({
      a: field(
        recursive(() => decoder),
        { optional: true },
      ),
      b: array(recursive(() => decoder)),
    });

    const input = { a: { b: [] }, b: [{ a: { b: [] }, b: [] }] };
    expect(run(decoder, input)).toStrictEqual(input);
  });
});

describe("undefinedOr", () => {
  test("undefined or string", () => {
    const decoder = undefinedOr(string);

    expectType<TypeEqual<Infer<typeof decoder>, string | undefined>>(true);

    expect(run(decoder, undefined)).toBeUndefined();
    expect(run(decoder, "a")).toBe("a");

    expect(run(decoder, null)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: null
      Or expected: undefined
    `);
  });

  test("with default", () => {
    const decoder = map(undefinedOr(string), (value) => value ?? "def");

    expectType<TypeEqual<Infer<typeof decoder>, string>>(true);

    expect(run(decoder, undefined)).toBe("def");
    expect(run(decoder, "a")).toBe("a");
  });

  test("using with fieldsAuto does NOT result in an optional field", () => {
    type Person = Infer<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      name: string,
      age: undefinedOr(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | undefined }>>(
      true,
    );

    expect(run(personDecoder, { name: "John" })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "age"
      Got: {
        "name": "John"
      }
    `);

    expect(run(personDecoder, { name: "John", age: undefined })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(run(personDecoder, { name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"]:
        Expected a number
        Got: "old"
        Or expected: undefined
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | undefined; }'.
    const person: Person = { name: "John" };
    void person;

    const person2: Person = { name: "John", age: undefined };
    void person2;
  });

  test("undefined or custom decoder", () => {
    function decoder(value: unknown): DecoderResult<never> {
      return {
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: "fail",
          got: value,
          path: [],
        },
      };
    }
    expect(run(undefinedOr(decoder), 1)).toMatchInlineSnapshot(`
      At root:
      fail
      Got: 1
      Or expected: undefined
    `);
  });

  test("undefinedOr higher up the chain makes no difference", () => {
    const decoder = fieldsAuto({
      test: undefinedOr(fieldsAuto({ inner: string })),
    });

    expect(run(decoder, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"]:
      Expected an object
      Got: 1
      Or expected: undefined
    `);

    expect(run(decoder, { test: { inner: 1 } })).toMatchInlineSnapshot(`
      At root["test"]["inner"]:
      Expected a string
      Got: 1
    `);
  });
});

describe("nullable", () => {
  test("nullable string", () => {
    const decoder = nullable(string);

    expectType<TypeEqual<Infer<typeof decoder>, string | null>>(true);

    expect(run(decoder, null)).toBeNull();
    expect(run(decoder, "a")).toBe("a");

    expect(run(decoder, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: undefined
      Or expected: null
    `);
  });

  test("with default", () => {
    const decoder = map(nullable(string), (value) => value ?? "def");

    expectType<TypeEqual<Infer<typeof decoder>, string>>(true);

    expect(run(decoder, null)).toBe("def");
    expect(run(decoder, "a")).toBe("a");
  });

  test("with undefined instead of null", () => {
    const decoder = map(nullable(string), (value) => value ?? undefined);

    expectType<TypeEqual<Infer<typeof decoder>, string | undefined>>(true);

    expect(run(decoder, null)).toBeUndefined();
    expect(run(decoder, "a")).toBe("a");
  });

  test("nullable field", () => {
    type Person = Infer<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      name: string,
      age: nullable(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | null }>>(true);

    expect(run(personDecoder, { name: "John" })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "age"
      Got: {
        "name": "John"
      }
    `);

    expect(run(personDecoder, { name: "John", age: undefined }))
      .toMatchInlineSnapshot(`
        At root["age"]:
        Expected a number
        Got: undefined
        Or expected: null
      `);

    expect(run(personDecoder, { name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(run(personDecoder, { name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"]:
        Expected a number
        Got: "old"
        Or expected: null
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | null; }'.
    const person: Person = { name: "John" };
    void person;
  });

  test("nullable custom decoder", () => {
    function decoder(value: unknown): DecoderResult<never> {
      return {
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: "fail",
          got: value,
          path: [],
        },
      };
    }

    expect(run(nullable(decoder), 1)).toMatchInlineSnapshot(`
      At root:
      fail
      Got: 1
      Or expected: null
    `);
  });

  test("nullable higher up the chain makes no difference", () => {
    const decoder = fieldsAuto({
      test: nullable(fieldsAuto({ inner: string })),
    });

    expect(run(decoder, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"]:
      Expected an object
      Got: 1
      Or expected: null
    `);

    expect(run(decoder, { test: { inner: 1 } })).toMatchInlineSnapshot(`
      At root["test"]["inner"]:
      Expected a string
      Got: 1
    `);
  });

  test("undefinedOr and nullable", () => {
    const decoder = undefinedOr(nullable(nullable(undefinedOr(string))));

    expect(run(decoder, 1)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 1
      Or expected: null or undefined
    `);
  });
});

test("map", () => {
  expect(run(map(number, Math.round), 4.9)).toBe(5);

  expect(
    run(
      map(array(number), (arr) => new Set(arr)),
      [1, 2, 1],
    ),
  ).toStrictEqual(new Set([1, 2]));

  expect(map(number, string)(0)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "error": {
          "got": 0,
          "path": [],
          "tag": "string",
        },
        "tag": "DecoderError",
      },
    }
  `);

  expect(run(map(number, string), "string")).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: "string"
  `);
});

test("flatMap", () => {
  expect(
    run(
      flatMap(number, (n) => ({ tag: "Valid", value: Math.round(n) })),
      4.9,
    ),
  ).toBe(5);

  expect(
    run(
      flatMap(number, (n) => ({
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: "The error message",
          got: n,
          path: ["some", "path", 0],
        },
      })),
      4.9,
    ),
  ).toMatchInlineSnapshot(`
    At root["some"]["path"][0]:
    The error message
    Got: 4.9
  `);

  expect(run(flatMap(number, string), 0)).toMatchInlineSnapshot(`
    At root:
    Expected a string
    Got: 0
  `);

  expect(run(flatMap(number, string), "string")).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: "string"
  `);
});
