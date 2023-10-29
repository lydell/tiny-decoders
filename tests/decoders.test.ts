import { expectType, TypeEqual } from "ts-expect";
import { describe, expect, test } from "vitest";

import {
  array,
  boolean,
  Codec,
  DecoderResult,
  field,
  fieldsAuto,
  fieldsUnion,
  flatMap,
  Infer,
  InferEncoded,
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
  unknown,
} from "..";
import { run } from "./helpers";

test("unknown", () => {
  expect(run(unknown, true)).toBe(true);
  expect(run(unknown, 1)).toBe(1);
  expect(run(unknown, { prop: 1 })).toStrictEqual({ prop: 1 });

  expect(unknown.encoder(true)).toBe(true);
  expect(unknown.encoder(1)).toBe(1);
  expect(unknown.encoder({ prop: 1 })).toStrictEqual({ prop: 1 });

  expectType<DecoderResult<unknown>>(unknown.decoder(true));
  expectType<unknown>(unknown.encoder(true));

  // @ts-expect-error Expected 1 arguments, but got 2.
  unknown.decoder(true, []);
});

test("boolean", () => {
  expect(run(boolean, true)).toBe(true);
  expect(run(boolean, false)).toBe(false);

  expect(boolean.encoder(true)).toBe(true);
  expect(boolean.encoder(false)).toBe(false);

  expectType<DecoderResult<boolean>>(boolean.decoder(true));
  expectType<boolean>(boolean.encoder(true));

  // @ts-expect-error Expected 1 arguments, but got 2.
  boolean.decoder(true, []);
  // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'boolean'.
  boolean.encoder(0);

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

  expect(number.encoder(0)).toBe(0);
  expect(number.encoder(Math.PI)).toBe(3.141592653589793);
  expect(number.encoder(NaN)).toBeNaN();
  expect(number.encoder(Infinity)).toBe(Infinity);
  expect(number.encoder(-Infinity)).toBe(-Infinity);

  expectType<DecoderResult<number>>(number.decoder(0));
  expectType<number>(number.encoder(0));

  // @ts-expect-error Expected 1 arguments, but got 2.
  number.decoder(0, []);
  // @ts-expect-error Argument of type 'boolean' is not assignable to parameter of type 'number'.
  number.encoder(true);

  expect(run(number, undefined)).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: undefined
  `);
});

test("string", () => {
  expect(run(string, "")).toBe("");
  expect(run(string, "string")).toBe("string");

  expect(string.encoder("")).toBe("");
  expect(string.encoder("string")).toBe("string");

  expectType<DecoderResult<string>>(string.decoder(""));
  expectType<string>(string.encoder(""));

  // @ts-expect-error Expected 1 arguments, but got 2.
  string.decoder("", []);
  // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'string'.
  string.encoder(0);

  expect(run(string, Symbol("desc"))).toMatchInlineSnapshot(`
    At root:
    Expected a string
    Got: Symbol(desc)
  `);
});

describe("stringUnion", () => {
  test("basic", () => {
    type Color = Infer<typeof Color>;
    const Color = stringUnion(["red", "green", "blue"]);

    expectType<TypeEqual<Color, "blue" | "green" | "red">>(true);
    expectType<TypeEqual<Color, InferEncoded<typeof Color>>>(true);

    const red: Color = "red";
    void red;

    // @ts-expect-error Type '"yellow"' is not assignable to type '"red" | "green" | "blue"'.
    const yellow: Color = "yellow";
    void yellow;

    expect(run(Color, "red")).toBe("red");
    expect(run(Color, "green")).toBe("green");
    expect(run(Color, "blue")).toBe("blue");

    expect(Color.encoder("red")).toBe("red");
    expect(Color.encoder("green")).toBe("green");
    expect(Color.encoder("blue")).toBe("blue");

    expectType<DecoderResult<Color>>(Color.decoder("red"));
    expectType<Color>(Color.encoder("red"));

    // @ts-expect-error Argument of type '{ one: null; two: null; }' is not assignable to parameter of type 'readonly string[]'.
    stringUnion({ one: null, two: null });
    // @ts-expect-error Argument of type '"magenta"' is not assignable to parameter of type '"red" | "green" | "blue"'.
    Color.encoder("magenta");

    expect(run(Color, "Red")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants:
        "red",
        "green",
        "blue"
      Got: "Red"
    `);

    expect(run(Color, 0)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 0
    `);
  });

  test("empty array is not allowed", () => {
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [string, ...string[]]'.
    //   Source has 0 element(s) but target requires 1.
    const emptyCodec = stringUnion([]);

    expect(run(emptyCodec, "test")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: (none)
      Got: "test"
    `);

    // Would have been cool if this was a TypeScript error due to `never`,
    // but it’s good enough with having an error at the definition.
    expect(emptyCodec.encoder("test")).toBe("test");
  });

  test("variants must be strings", () => {
    // @ts-expect-error Type 'number' is not assignable to type 'string'.
    stringUnion([1]);
    const goodCodec = stringUnion(["1"]);
    expectType<TypeEqual<Infer<typeof goodCodec>, "1">>(true);
    expect(run(goodCodec, "1")).toBe("1");
  });

  test("always print the expected tags in full", () => {
    const codec = stringUnion(["PrettyLongTagName1", "PrettyLongTagName2"]);

    expect(
      run(codec, "PrettyLongTagNameButWrong", {
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
    type Bits = Infer<typeof Bits>;
    const Bits = array(stringUnion(["0", "1"]));

    expectType<TypeEqual<Bits, Array<"0" | "1">>>(true);
    expectType<TypeEqual<Bits, InferEncoded<typeof Bits>>>(true);

    expectType<DecoderResult<Bits>>(Bits.decoder([]));
    expectType<Bits>(Bits.encoder([]));

    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '("0" | "1")[]'.
    Bits.encoder("0");

    expect(run(Bits, [])).toStrictEqual([]);
    expect(run(Bits, ["0"])).toStrictEqual(["0"]);
    expect(run(Bits, ["0", "1", "1", "0"])).toStrictEqual(["0", "1", "1", "0"]);

    expect(Bits.encoder([])).toStrictEqual([]);
    expect(Bits.encoder(["0"])).toStrictEqual(["0"]);
    expect(Bits.encoder(["0", "1", "1", "0"])).toStrictEqual([
      "0",
      "1",
      "1",
      "0",
    ]);

    expect(run(Bits, ["0", "2"])).toMatchInlineSnapshot(`
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

  test("holes", () => {
    const codec = array(undefinedOr(number));

    const arr = [];
    arr[0] = 1;
    arr[2] = 3;

    expect(run(codec, arr)).toStrictEqual([1, undefined, 3]);
    expect(codec.encoder(arr)).toStrictEqual([1, undefined, 3]);
  });
});

describe("record", () => {
  test("basic", () => {
    type Registers = Infer<typeof Registers>;
    const Registers = record(stringUnion(["0", "1"]));

    expectType<TypeEqual<Registers, Record<string, "0" | "1">>>(true);
    expectType<TypeEqual<Registers, InferEncoded<typeof Registers>>>(true);

    expectType<DecoderResult<Registers>>(Registers.decoder({}));
    expectType<Registers>(Registers.encoder({}));

    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'Record<string, "0" | "1">'.
    Registers.encoder("0");

    expect(run(Registers, {})).toStrictEqual({});
    expect(run(Registers, { a: "0" })).toStrictEqual({ a: "0" });
    expect(run(Registers, { a: "0", b: "1", c: "1", d: "0" })).toStrictEqual({
      a: "0",
      b: "1",
      c: "1",
      d: "0",
    });

    expect(Registers.encoder({})).toStrictEqual({});
    expect(Registers.encoder({ a: "0" })).toStrictEqual({ a: "0" });
    expect(Registers.encoder({ a: "0", b: "1", c: "1", d: "0" })).toStrictEqual(
      {
        a: "0",
        b: "1",
        c: "1",
        d: "0",
      },
    );

    expect(run(Registers, { a: "0", b: "2" })).toMatchInlineSnapshot(`
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
    const codec = flatMap(record(string), {
      decoder: (items) => {
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
      },
      encoder: (regexes) =>
        Object.fromEntries(
          regexes.map(([regex, value]) => [regex.source, value]),
        ),
    });

    expectType<TypeEqual<Infer<typeof codec>, Array<[RegExp, string]>>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, Record<string, string>>>(
      true,
    );

    // @ts-expect-error Argument of type '{}' is not assignable to parameter of type '[RegExp, string][]'.
    expect(() => codec.encoder({})).toThrow();

    const good = { "\\d{4}:\\d{2}": "Year/month", ".*": "Rest" };
    const bad = { "\\d{4}:\\d{2": "Year/month", ".*": "Rest" };

    expect(run(codec, good)).toStrictEqual([
      [/\d{4}:\d{2}/u, "Year/month"],
      [/.*/u, "Rest"],
    ]);

    expect(
      codec.encoder([
        [/\d{4}:\d{2}/u, "Year/month"],
        [/.*/u, "Rest"],
      ]),
    ).toStrictEqual(good);

    // To avoid slightly different error messages on different Node.js versions.
    const cleanRegexError = <T>(message: T | string): T | string =>
      typeof message === "string"
        ? message.replace(
            /(Invalid regular expression):.*/,
            "$1: (the regex error)",
          )
        : message;

    expect(cleanRegexError(run(codec, bad))).toMatchInlineSnapshot(
      `
      At root["\\\\d{4}:\\\\d{2"]:
      Invalid regular expression: (the regex error)
      Got: "\\\\d{4}:\\\\d{2"
    `,
    );

    expect(
      cleanRegexError(run(fieldsAuto({ regexes: codec }), { regexes: bad })),
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

    expect(
      record(number).encoder(
        JSON.parse(`{"a": 1, "__proto__": 2, "b": 3}`) as Record<
          string,
          number
        >,
      ),
    ).toStrictEqual({ a: 1, b: 3 });
  });
});

describe("fieldsAuto", () => {
  // @ts-expect-error Argument of type 'Codec<string, string>[]' is not assignable to parameter of type 'FieldsMapping'.
  //   Index signature for type 'string' is missing in type 'Codec<string, string>[]'.
  fieldsAuto([string]);

  test("basic", () => {
    type Person = Infer<typeof Person>;
    const Person = fieldsAuto({
      id: number,
      firstName: string,
    });

    expectType<TypeEqual<Person, { id: number; firstName: string }>>(true);
    expectType<TypeEqual<Person, InferEncoded<typeof Person>>>(true);

    expectType<DecoderResult<Person>>(
      Person.decoder({ id: 1, firstName: "John" }),
    );
    expectType<Person>(Person.encoder({ id: 1, firstName: "John" }));

    // @ts-expect-error Property 'firstName' is missing in type '{ id: number; }' but required in type '{ id: number; firstName: string; }'.
    Person.encoder({ id: 1 });

    expect(run(Person, { id: 1, firstName: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(Person.encoder({ id: 1, firstName: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(run(Person, { id: "1", firstName: "John" })).toMatchInlineSnapshot(`
        At root["id"]:
        Expected a number
        Got: "1"
      `);

    expect(run(Person, { id: 1, first_name: "John" })).toMatchInlineSnapshot(`
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
    type Person = Infer<typeof Person>;
    const Person = fieldsAuto({
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
    expectType<
      TypeEqual<
        InferEncoded<typeof Person>,
        {
          id: number;
          first_name: string;
          last_name?: string;
          age?: number;
          likes?: number | undefined;
          followers: number | undefined;
        }
      >
    >(true);

    expectType<DecoderResult<Person>>(
      Person.decoder({ id: 1, first_name: "John", followers: undefined }),
    );
    expectType<{
      id: number;
      first_name: string;
      followers: number | undefined;
    }>(Person.encoder({ id: 1, firstName: "John", followers: undefined }));

    // @ts-expect-error Object literal may only specify known properties, but 'first_name' does not exist in type '{ id: number; firstName: string; followers: number | undefined; lastName?: string; age?: number; likes?: number | undefined; }'. Did you mean to write 'firstName'?
    Person.encoder({ id: 1, first_name: "John", followers: undefined });

    expect(
      run(Person, {
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
      run(Person, {
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
      run(Person, {
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
      Person.encoder({
        id: 1,
        firstName: "John",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "first_name": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(Person, {
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
      Person.encoder({
        id: 1,
        firstName: "John",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "first_name": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(Person, {
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
      Person.encoder({
        id: 1,
        firstName: "John",
        lastName: "Doe",
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "first_name": "John",
        "followers": undefined,
        "id": 1,
        "last_name": "Doe",
      }
    `);

    expect(
      run(Person, {
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
      Person.encoder({
        id: 1,
        firstName: "John",
        age: 42,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "age": 42,
        "first_name": "John",
        "followers": undefined,
        "id": 1,
      }
    `);

    expect(
      run(Person, {
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
      run(Person, {
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
      Person.encoder({
        id: 1,
        firstName: "John",
        likes: 42,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "first_name": "John",
        "followers": undefined,
        "id": 1,
        "likes": 42,
      }
    `);

    expect(
      run(Person, {
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

    expect(
      Person.encoder({
        id: 1,
        firstName: "John",
        likes: undefined,
        followers: undefined,
      }),
    ).toMatchInlineSnapshot(`
      {
        "first_name": "John",
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

      fieldsAuto({ one: string, two: boolean }).encoder({
        one: "",
        two: true,
        // @ts-expect-error Object literal may only specify known properties, and 'three' does not exist in type '{ one: string; two: boolean; }'.
        three: 1,
      });
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

      fieldsAuto(
        { one: string, two: boolean },
        { allowExtraFields: false },
      ).encoder({
        one: "a",
        two: true,
        // @ts-expect-error Object literal may only specify known properties, and 'three' does not exist in type '{ one: string; two: boolean; }'.
        three: 3,
        four: {},
      });
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
      const codec = fieldsAuto(
        {
          PrettyLongTagName1: string,
          PrettyLongTagName2: string,
        },
        { allowExtraFields: false },
      );

      expect(
        run(
          codec,
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
    const codec = fieldsAuto({ a: number, __proto__: string, b: number });
    expect(
      run(codec, JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });
    expect(
      codec.encoder(
        JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`) as Infer<typeof codec>,
      ),
    ).toStrictEqual({ a: 1, b: 3 });

    const desc = Object.create(null) as { __proto__: Codec<string> };
    desc.__proto__ = string;
    const codec2 = fieldsAuto(desc);
    expect(run(codec2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
    expect(
      codec2.encoder(JSON.parse(`{"__proto__": "a"}`) as Infer<typeof codec2>),
    ).toStrictEqual({});
  });

  test("renaming from __proto__ is not allowed", () => {
    const codec = fieldsAuto({
      a: number,
      b: field(string, { renameFrom: "__proto__" }),
    });
    expect(run(codec, JSON.parse(`{"a": 1, "__proto__": "a"}`))).toStrictEqual({
      a: 1,
    });
    expect(codec.encoder({ a: 0, b: "" })).toStrictEqual({ a: 0 });

    const desc = Object.create(null) as { __proto__: Codec<string> };
    desc.__proto__ = string;
    const codec2 = fieldsAuto(desc);
    expect(run(codec2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
    expect(
      codec2.encoder(JSON.parse(`{"__proto__": "a"}`) as Infer<typeof codec2>),
    ).toStrictEqual({});
  });

  test("empty object", () => {
    const codec = fieldsAuto({}, { allowExtraFields: false });

    expect(run(codec, {})).toStrictEqual({});
    expect(codec.encoder({})).toStrictEqual({});

    // This should ideally have been a type error, but it is not.
    // Having a codec for the empty object isn’t that useful though.
    expect(codec.encoder({ a: 1 })).toStrictEqual({});

    expect(run(codec, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: (none)
      Found extra fields:
        "a"
    `);
  });
});

describe("fieldsUnion", () => {
  test("basic", () => {
    type Shape = Infer<typeof Shape>;
    const Shape = fieldsUnion("tag", [
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

    expectType<
      TypeEqual<
        InferEncoded<typeof Shape>,
        | { tag: "Circle"; radius: number }
        | { tag: "Rectangle"; width_px: number; height_px: number }
      >
    >(true);

    expectType<DecoderResult<Shape>>(
      Shape.decoder({ tag: "Circle", radius: 5 }),
    );
    expectType<
      | { tag: "Circle"; radius: number }
      | { tag: "Rectangle"; width_px: number; height_px: number }
    >(Shape.encoder({ tag: "Circle", radius: 5 }));

    // @ts-expect-error Object literal may only specify known properties, and 'width_px' does not exist in type '{ tag: "Rectangle"; width: number; height: number; }'.
    Shape.encoder({ tag: "Rectangle", width_px: 1, height_px: 2 });

    expect(run(Shape, { tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(
      run(Shape, { tag: "Rectangle", width_px: 1, height_px: 2 }),
    ).toStrictEqual({
      tag: "Rectangle",
      width: 1,
      height: 2,
    });

    expect(Shape.encoder({ tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(
      Shape.encoder({ tag: "Rectangle", width: 1, height: 2 }),
    ).toStrictEqual({ tag: "Rectangle", width_px: 1, height_px: 2 });

    expect(run(Shape, { tag: "Rectangle", radius: 5 })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "width_px"
      Got: {
        "tag": "Rectangle",
        "radius": 5
      }
    `);

    expect(run(Shape, { tag: "Square", size: 5 })).toMatchInlineSnapshot(`
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
      '"fieldsUnion: decoded common field cannot be __proto__"',
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
      // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '["fieldsUnion variants must have a field in common, and their encoded field names must be the same", never]'.
      fieldsUnion("tag", [
        { tag: tag("A") },
        { tag: tag("B", { renameFieldFrom: "type" }) },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: Variant at index 1: Key \\"tag\\": Got a different encoded field name (\\"type\\") than before (\\"tag\\")."',
    );
  });

  test("encodedCommonField mismatch 2", () => {
    expect(() =>
      // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '["fieldsUnion variants must have a field in common, and their encoded field names must be the same", never]'.
      fieldsUnion("tag", [
        { tag: tag("A", { renameFieldFrom: "other" }) },
        { tag: tag("B", { renameFieldFrom: "type" }) },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: Variant at index 1: Key \\"tag\\": Got a different encoded field name (\\"type\\") than before (\\"other\\")."',
    );
  });

  test("same encodedCommonField correctly used on every variant", () => {
    const codec = fieldsUnion("tag", [
      { tag: tag("A", { renameFieldFrom: "type" }) },
      { tag: tag("B", { renameFieldFrom: "type" }) },
    ]);

    expectType<TypeEqual<Infer<typeof codec>, { tag: "A" } | { tag: "B" }>>(
      true,
    );
    expectType<
      TypeEqual<InferEncoded<typeof codec>, { type: "A" } | { type: "B" }>
    >(true);

    expect(run(codec, { type: "A" })).toStrictEqual({ tag: "A" });
    expect(run(codec, { type: "B" })).toStrictEqual({ tag: "B" });

    expect(codec.encoder({ tag: "A" })).toStrictEqual({ type: "A" });
    expect(codec.encoder({ tag: "B" })).toStrictEqual({ type: "B" });
  });

  test("same tag used twice", () => {
    type Type = Infer<typeof codec>;
    const codec = fieldsUnion("tag", [
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
    expect(run(codec, { tag: "Test", two: "a" })).toStrictEqual({
      tag: "Test",
      two: "a",
    });

    // The first one never matches and always fails:
    expect(run(codec, { tag: "Test", one: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "two"
      Got: {
        "tag": "Test",
        "one": 1
      }
    `);

    // The last one can be encoded:
    expect(codec.encoder({ tag: "Test", two: "a" })).toMatchInlineSnapshot(`
      {
        "tag": "Test",
        "two": "a",
      }
    `);

    // The first one unfortunately compiles, but results in bad data:
    expect(codec.encoder({ tag: "Test", one: 1 })).toMatchInlineSnapshot(`
      {
        "tag": "Test",
        "two": undefined,
      }
    `);
  });

  test("generic decoder", () => {
    type Result<Ok, Err> =
      | { tag: "Err"; error: Err }
      | { tag: "Ok"; value: Ok };

    const Result = <Ok, Err>(
      okCodec: Codec<Ok>,
      errCodec: Codec<Err>,
    ): Codec<Result<Ok, Err>> =>
      fieldsUnion("tag", [
        {
          tag: tag("Ok"),
          value: okCodec,
        },
        {
          tag: tag("Err"),
          error: errCodec,
        },
      ]);

    const codec = Result(number, string);

    expectType<
      TypeEqual<
        Infer<typeof codec>,
        { tag: "Err"; error: string } | { tag: "Ok"; value: number }
      >
    >(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, unknown>>(true);

    // @ts-expect-error Type 'string' is not assignable to type 'number'.
    codec.encoder({ tag: "Ok", value: "" });

    expect(run(codec, { tag: "Ok", value: 0 })).toStrictEqual({
      tag: "Ok",
      value: 0,
    });

    expect(run(codec, { tag: "Err", error: "" })).toStrictEqual({
      tag: "Err",
      error: "",
    });

    expect(codec.encoder({ tag: "Ok", value: 0 })).toStrictEqual({
      tag: "Ok",
      value: 0,
    });

    expect(codec.encoder({ tag: "Err", error: "" })).toStrictEqual({
      tag: "Err",
      error: "",
    });
  });

  test("generic decoder with inferred encoded type", () => {
    type Result<Ok, Err> =
      | { tag: "Err"; error: Err }
      | { tag: "Ok"; value: Ok };

    const Result = <OkDecoded, OkEncoded, ErrDecoded, ErrEncoded>(
      okCodec: Codec<OkDecoded, OkEncoded>,
      errCodec: Codec<ErrDecoded, ErrEncoded>,
    ): Codec<Result<OkDecoded, ErrDecoded>, Result<OkEncoded, ErrEncoded>> =>
      fieldsUnion("tag", [
        {
          tag: tag("Ok"),
          value: okCodec,
        },
        {
          tag: tag("Err"),
          error: errCodec,
        },
      ]);

    const codec = Result(number, string);

    expectType<
      TypeEqual<
        Infer<typeof codec>,
        { tag: "Err"; error: string } | { tag: "Ok"; value: number }
      >
    >(true);
    expectType<
      TypeEqual<
        InferEncoded<typeof codec>,
        { tag: "Err"; error: string } | { tag: "Ok"; value: number }
      >
    >(true);

    // @ts-expect-error Type 'string' is not assignable to type 'number'.
    codec.encoder({ tag: "Ok", value: "" });

    const value = { tag: "Ok", value: 0 } as const;
    expect(run(codec, codec.encoder(value))).toStrictEqual(value);
  });

  test("always print the expected tags in full", () => {
    const codec = fieldsUnion("tag", [
      { tag: tag("PrettyLongTagName1"), value: string },
      { tag: tag("PrettyLongTagName2"), value: string },
    ]);

    expect(
      run(
        codec,
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

  test("unexpectedly found no encoder for decoded variant name", () => {
    const codec = fieldsUnion("tag", [
      { tag: tag("One") },
      { tag: tag("Two") },
    ]);
    expect(() =>
      // This can only happen if you have type errors.
      // @ts-expect-error Type '"Three"' is not assignable to type '"One" | "Two"'.
      codec.encoder({ tag: "Three" }),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: Unexpectedly found no encoder for decoded variant name: \\"Three\\" at key \\"tag\\""',
    );
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

      fieldsUnion("tag", [
        { tag: tag("Test"), one: string, two: boolean },
      ]).encoder({
        tag: "Test",
        one: "a",
        two: true,
        // @ts-expect-error Object literal may only specify known properties, and 'three' does not exist in type '{ tag: "Test"; one: string; two: boolean; }'.
        three: 3,
        four: {},
      });
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

      fieldsUnion("tag", [{ tag: tag("Test"), one: string, two: boolean }], {
        allowExtraFields: false,
      }).encoder({
        tag: "Test",
        one: "a",
        two: true,
        // @ts-expect-error Object literal may only specify known properties, and 'three' does not exist in type '{ tag: "Test"; one: string; two: boolean; }'.
        three: 3,
        four: {},
      });
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
      const codec = fieldsUnion(
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
          codec,
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
    const { codec } = tag("Test");

    expectType<TypeEqual<Infer<typeof codec>, "Test">>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, "Test">>(true);

    expect(run(codec, "Test")).toBe("Test");
    expect(codec.encoder("Test")).toBe("Test");

    // @ts-expect-error Argument of type '"other"' is not assignable to parameter of type '"Test"'.
    codec.encoder("other");

    expect(run(codec, "other")).toMatchInlineSnapshot(`
      At root:
      Expected this string: "Test"
      Got: "other"
    `);
    expect(run(codec, 0)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 0
    `);
  });

  test("renamed", () => {
    const { codec } = tag("Test", { renameTagFrom: "test" });

    expectType<TypeEqual<Infer<typeof codec>, "Test">>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, "test">>(true);

    expect(run(codec, "test")).toBe("Test");
    expect(codec.encoder("Test")).toBe("test");

    // @ts-expect-error Argument of type '"test"' is not assignable to parameter of type '"Test"'.
    codec.encoder("test");

    expect(run(codec, "other")).toMatchInlineSnapshot(`
      At root:
      Expected this string: "test"
      Got: "other"
    `);
  });
});

describe("tuple", () => {
  // @ts-expect-error Argument of type '{}' is not assignable to parameter of type 'Codec<unknown, unknown>[]'.
  tuple({});
  // @ts-expect-error Argument of type 'Codec<number, number>' is not assignable to parameter of type 'Codec<unknown, unknown>[]'.
  tuple(number);

  test("0 items", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([]);

    expectType<TypeEqual<Type, []>>(true);
    expectType<TypeEqual<Type, InferEncoded<typeof codec>>>(true);

    expectType<DecoderResult<Type>>(codec.decoder([]));
    expectType<Type>(codec.encoder([]));

    expect(run(codec, [])).toStrictEqual([]);

    expect(codec.encoder([])).toStrictEqual([]);

    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[]'.
    //   Source has 1 element(s) but target allows only 0.
    codec.encoder([1]);

    expect(run(codec, [1])).toMatchInlineSnapshot(`
      At root:
      Expected 0 items
      Got: 1
    `);
  });

  test("1 item", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([number]);

    expectType<TypeEqual<Type, [number]>>(true);
    expectType<TypeEqual<Type, InferEncoded<typeof codec>>>(true);

    expectType<DecoderResult<Type>>(codec.decoder([1]));
    expectType<Type>(codec.encoder([1]));

    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[number]'.
    //   Source has 0 element(s) but target requires 1.
    codec.encoder([]);

    expect(run(codec, [1])).toStrictEqual([1]);

    expect(codec.encoder([1])).toStrictEqual([1]);

    expect(run(codec, [])).toMatchInlineSnapshot(`
      At root:
      Expected 1 items
      Got: 0
    `);

    expect(run(codec, [1, 2])).toMatchInlineSnapshot(`
      At root:
      Expected 1 items
      Got: 2
    `);
  });

  test("2 items", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([number, string]);

    expectType<TypeEqual<Type, [number, string]>>(true);
    expectType<TypeEqual<Type, InferEncoded<typeof codec>>>(true);

    expectType<DecoderResult<Type>>(codec.decoder([1, "a"]));
    expectType<Type>(codec.encoder([1, "a"]));

    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[number, string]'.
    //   Source has 1 element(s) but target requires 2.
    codec.encoder([1]);

    expect(run(codec, [1, "a"])).toStrictEqual([1, "a"]);

    expect(codec.encoder([1, "a"])).toStrictEqual([1, "a"]);

    expect(run(codec, [1])).toMatchInlineSnapshot(`
      At root:
      Expected 2 items
      Got: 1
    `);

    expect(run(codec, ["a", 1])).toMatchInlineSnapshot(`
      At root[0]:
      Expected a number
      Got: "a"
    `);

    expect(run(codec, [1, "a", 2])).toMatchInlineSnapshot(`
      At root:
      Expected 2 items
      Got: 3
    `);
  });

  test("3 items", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([number, string, boolean]);

    expectType<TypeEqual<Type, [number, string, boolean]>>(true);
    expectType<TypeEqual<Type, InferEncoded<typeof codec>>>(true);

    expectType<DecoderResult<Type>>(codec.decoder([1, "a", true]));
    expectType<Type>(codec.encoder([1, "a", true]));

    // @ts-expect-error Argument of type '[number, string]' is not assignable to parameter of type '[number, string, boolean]'.
    //   Source has 2 element(s) but target requires 3.
    codec.encoder([1, "a"]);

    expect(run(codec, [1, "a", true])).toStrictEqual([1, "a", true]);

    expect(codec.encoder([1, "a", true])).toStrictEqual([1, "a", true]);

    expect(run(codec, [1, "a"])).toMatchInlineSnapshot(`
      At root:
      Expected 3 items
      Got: 2
    `);

    expect(run(codec, [1, "a", true, 2])).toMatchInlineSnapshot(`
      At root:
      Expected 3 items
      Got: 4
    `);
  });

  test("4 items", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([number, string, boolean, number]);

    expectType<TypeEqual<Type, [number, string, boolean, number]>>(true);
    expectType<TypeEqual<Type, InferEncoded<typeof codec>>>(true);

    expectType<DecoderResult<Type>>(codec.decoder([1, "a", true, 2]));
    expectType<Type>(codec.encoder([1, "a", true, 2]));

    // @ts-expect-error Argument of type '[number, string, true]' is not assignable to parameter of type '[number, string, boolean, number]'.
    //   Source has 3 element(s) but target requires 4.
    codec.encoder([1, "a", true]);

    expect(run(codec, [1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);

    expect(codec.encoder([1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);

    expect(run(codec, [1, "a", true])).toMatchInlineSnapshot(`
      At root:
      Expected 4 items
      Got: 3
    `);

    expect(
      // eslint-disable-next-line no-sparse-arrays
      run(codec, [1, "a", true, 2, "too", , , "many"]),
    ).toMatchInlineSnapshot(`
      At root:
      Expected 4 items
      Got: 8
    `);
  });

  test("different decoded and encoded types", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([
      map(boolean, { decoder: Number, encoder: Boolean }),
      fieldsAuto({ decoded: field(string, { renameFrom: "encoded" }) }),
    ]);

    expectType<TypeEqual<Type, [number, { decoded: string }]>>(true);
    expectType<
      TypeEqual<InferEncoded<typeof codec>, [boolean, { encoded: string }]>
    >(true);

    expectType<DecoderResult<Type>>(codec.decoder([true, { encoded: "" }]));
    expectType<[boolean, { encoded: string }]>(
      codec.encoder([1, { decoded: "" }]),
    );

    // @ts-expect-error Type 'boolean' is not assignable to type 'number'.
    codec.encoder([true, { decoded: "" }]);

    expect(run(codec, [true, { encoded: "" }])).toStrictEqual([
      1,
      { decoded: "" },
    ]);

    expect(codec.encoder([1, { decoded: "" }])).toStrictEqual([
      true,
      { encoded: "" },
    ]);

    expect(run(codec, [1, { encoded: "" }])).toMatchInlineSnapshot(`
      At root[0]:
      Expected a boolean
      Got: 1
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

    // @ts-expect-error Type '0' is not assignable to type '1'.
    tuple([number]).encoder({ length: 0 });

    expect(run(tuple([number]), new Int32Array(2))).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: Int32Array
    `);

    // @ts-expect-error Argument of type 'Int32Array' is not assignable to parameter of type '[number]'.
    tuple([number]).encoder(new Int32Array(2));
  });
});

describe("multi", () => {
  test("basic", () => {
    type Id = Infer<typeof Id>;
    const Id = multi(["string", "number"]);

    expectType<
      TypeEqual<
        Id,
        { type: "number"; value: number } | { type: "string"; value: string }
      >
    >(true);
    expectType<TypeEqual<InferEncoded<typeof Id>, number | string>>(true);

    expectType<DecoderResult<Id>>(Id.decoder("123"));
    expectType<number | string>(Id.encoder({ type: "string", value: "123" }));

    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '{ type: "string"; value: string; } | { type: "number"; value: number; }'.
    Id.encoder("123");
    // @ts-expect-error Type '"boolean"' is not assignable to type '"string" | "number"'.
    Id.encoder({ type: "boolean", value: true });

    expect(run(Id, "123")).toStrictEqual({
      type: "string",
      value: "123",
    });

    expect(
      Id.encoder({
        type: "string",
        value: "123",
      }),
    ).toBe("123");

    expect(run(Id, 123)).toStrictEqual({ type: "number", value: 123 });

    expect(Id.encoder({ type: "number", value: 123 })).toBe(123);

    expect(run(Id, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – mapped", () => {
    type Id = Infer<typeof Id>;
    const Id = map(multi(["string", "number"]), {
      decoder: (value) => {
        switch (value.type) {
          case "string":
            return { tag: "Id" as const, id: value.value };
          case "number":
            return { tag: "LegacyId" as const, id: value.value };
        }
      },
      encoder: (id) => {
        switch (id.tag) {
          case "Id":
            return { type: "string", value: id.id };
          case "LegacyId":
            return { type: "number", value: id.id };
        }
      },
    });

    expectType<
      TypeEqual<Id, { tag: "Id"; id: string } | { tag: "LegacyId"; id: number }>
    >(true);

    expectType<TypeEqual<InferEncoded<typeof Id>, number | string>>(true);

    expectType<DecoderResult<Id>>(Id.decoder("123"));
    expectType<number | string>(Id.encoder({ tag: "Id", id: "123" }));

    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '{ tag: "Id"; id: string; } | { tag: "LegacyId"; id: number; }'.
    expect(() => Id.encoder("123")).toThrow();

    expect(run(Id, "123")).toStrictEqual({ tag: "Id", id: "123" });

    expect(Id.encoder({ tag: "Id", id: "123" })).toBe("123");

    expect(run(Id, 123)).toStrictEqual({ tag: "LegacyId", id: 123 });

    expect(Id.encoder({ tag: "LegacyId", id: 123 })).toBe(123);

    expect(run(Id, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – variation", () => {
    type Id = Infer<typeof Id>;
    const Id = map(multi(["string", "number"]), {
      decoder: (value) => {
        switch (value.type) {
          case "string":
            return value.value;
          case "number":
            return value.value.toString();
        }
      },
      encoder: (value) => ({ type: "string", value }),
    });

    expectType<TypeEqual<Id, string>>(true);
    expectType<TypeEqual<InferEncoded<typeof Id>, number | string>>(true);

    expectType<DecoderResult<Id>>(Id.decoder("123"));
    expectType<number | string>(Id.encoder("123"));

    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'string'.
    Id.encoder(123);

    expect(run(Id, "123")).toBe("123");
    expect(run(Id, 123)).toBe("123");

    expect(Id.encoder("123")).toBe("123");

    expect(run(Id, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("empty array", () => {
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [MultiTypeName, ...MultiTypeName[]]'.
    //   Source has 0 element(s) but target requires 1.
    const codec = multi([]);

    expect(run(codec, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: never
      Got: undefined
    `);

    // Would have been cool if this was a TypeScript error due to `never`,
    // but it’s good enough with having an error at the definition.
    expect(
      codec.encoder({ type: "undefined", value: undefined }),
    ).toBeUndefined();
  });

  test("all types", () => {
    const codec = multi([
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
      expect(run(codec, value)).toMatchObject({ value });
    }
  });

  test("coverage", () => {
    const codec = multi(["undefined"]);

    expect(run(codec, null)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: null
    `);

    expect(run(codec, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: true
    `);

    expect(run(codec, 0)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: 0
    `);

    expect(run(codec, "")).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: ""
    `);

    expect(run(codec, [])).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: undefined
      Got: []
    `);

    expect(run(codec, {})).toMatchInlineSnapshot(`
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

    const codec: Codec<Recursive> = fieldsAuto({
      a: field(
        recursive(() => codec),
        { optional: true },
      ),
      b: array(recursive(() => codec)),
    });

    const input = { a: { b: [] }, b: [{ a: { b: [] }, b: [] }] };
    expect(run(codec, input)).toStrictEqual(input);
    expect(codec.encoder(input)).toStrictEqual(input);
  });
});

describe("undefinedOr", () => {
  test("undefined or string", () => {
    const codec = undefinedOr(string);

    expectType<TypeEqual<Infer<typeof codec>, string | undefined>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, string | undefined>>(true);

    // @ts-expect-error Argument of type 'null' is not assignable to parameter of type 'string | undefined'.
    codec.encoder(null);

    expect(run(codec, undefined)).toBeUndefined();
    expect(run(codec, "a")).toBe("a");

    expect(codec.encoder(undefined)).toBeUndefined();
    expect(codec.encoder("a")).toBe("a");

    expect(run(codec, null)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: null
      Or expected: undefined
    `);
  });

  test("with default", () => {
    const codec = map(undefinedOr(string), {
      decoder: (value) => value ?? "def",
      encoder: (value) => value,
    });

    expectType<TypeEqual<Infer<typeof codec>, string>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, string | undefined>>(true);

    expect(run(codec, undefined)).toBe("def");
    expect(run(codec, "a")).toBe("a");

    // @ts-expect-error Argument of type 'undefined' is not assignable to parameter of type 'string'.
    codec.encoder(undefined);

    expect(codec.encoder("a")).toBe("a");
  });

  test("using with fieldsAuto does NOT result in an optional field", () => {
    type Person = Infer<typeof Person>;
    const Person = fieldsAuto({
      name: string,
      age: undefinedOr(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | undefined }>>(
      true,
    );
    expectType<TypeEqual<Person, InferEncoded<typeof Person>>>(true);

    expect(run(Person, { name: "John" })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "age"
      Got: {
        "name": "John"
      }
    `);

    expect(run(Person, { name: "John", age: undefined })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(Person.encoder({ name: "John", age: undefined })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(run(Person, { name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(Person.encoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(Person, { name: "John", age: "old" })).toMatchInlineSnapshot(`
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

  test("undefined or custom codec", () => {
    const codec: Codec<never, never> = {
      decoder: (value) => ({
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: "fail",
          got: value,
          path: [],
        },
      }),
      encoder: () => {
        throw new Error("never");
      },
    };

    expect(run(undefinedOr(codec), 1)).toMatchInlineSnapshot(`
      At root:
      fail
      Got: 1
      Or expected: undefined
    `);

    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'never'.
    expect(() => codec.encoder(1)).toThrowErrorMatchingInlineSnapshot(
      '"never"',
    );
  });

  test("undefinedOr higher up the chain makes no difference", () => {
    const codec = fieldsAuto({
      test: undefinedOr(fieldsAuto({ inner: string })),
    });

    expect(run(codec, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"]:
      Expected an object
      Got: 1
      Or expected: undefined
    `);

    expect(run(codec, { test: { inner: 1 } })).toMatchInlineSnapshot(`
      At root["test"]["inner"]:
      Expected a string
      Got: 1
      Or expected: undefined
    `);
  });
});

describe("nullable", () => {
  test("nullable string", () => {
    const codec = nullable(string);

    expectType<TypeEqual<Infer<typeof codec>, string | null>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, string | null>>(true);

    // @ts-expect-error Argument of type 'undefined' is not assignable to parameter of type 'string | null'.
    codec.encoder(undefined);

    expect(run(codec, null)).toBeNull();
    expect(run(codec, "a")).toBe("a");

    expect(codec.encoder(null)).toBeNull();
    expect(codec.encoder("a")).toBe("a");

    expect(run(codec, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: undefined
      Or expected: null
    `);
  });

  test("with default", () => {
    const codec = map(nullable(string), {
      decoder: (value) => value ?? "def",
      encoder: (value) => value,
    });

    expectType<TypeEqual<Infer<typeof codec>, string>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, string | null>>(true);

    // @ts-expect-error Argument of type 'null' is not assignable to parameter of type 'string'.
    codec.encoder(null);

    expect(run(codec, null)).toBe("def");
    expect(run(codec, "a")).toBe("a");

    expect(codec.encoder("a")).toBe("a");
  });

  test("with undefined instead of null", () => {
    const codec = map(nullable(string), {
      decoder: (value) => value ?? undefined,
      encoder: (value) => value ?? null,
    });

    expectType<TypeEqual<Infer<typeof codec>, string | undefined>>(true);
    expectType<TypeEqual<InferEncoded<typeof codec>, string | null>>(true);

    // @ts-expect-error Argument of type 'null' is not assignable to parameter of type 'string | undefined'.
    codec.encoder(null);

    expect(run(codec, null)).toBeUndefined();
    expect(run(codec, "a")).toBe("a");

    expect(codec.encoder(undefined)).toBeNull();
    expect(codec.encoder("a")).toBe("a");
  });

  test("nullable field", () => {
    type Person = Infer<typeof Person>;
    const Person = fieldsAuto({
      name: string,
      age: nullable(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | null }>>(true);
    expectType<TypeEqual<Person, InferEncoded<typeof Person>>>(true);

    expect(run(Person, { name: "John" })).toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "age"
      Got: {
        "name": "John"
      }
    `);

    expect(run(Person, { name: "John", age: undefined }))
      .toMatchInlineSnapshot(`
        At root["age"]:
        Expected a number
        Got: undefined
        Or expected: null
      `);

    expect(run(Person, { name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(Person.encoder({ name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(run(Person, { name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(Person.encoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(Person, { name: "John", age: "old" })).toMatchInlineSnapshot(`
        At root["age"]:
        Expected a number
        Got: "old"
        Or expected: null
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | null; }'.
    const person: Person = { name: "John" };
    void person;
  });

  test("nullable custom codec", () => {
    const codec: Codec<never, never> = {
      decoder: (value) => ({
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: "fail",
          got: value,
          path: [],
        },
      }),
      encoder: () => {
        throw new Error("never");
      },
    };

    expect(run(nullable(codec), 1)).toMatchInlineSnapshot(`
      At root:
      fail
      Got: 1
      Or expected: null
    `);

    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'never'.
    expect(() => codec.encoder(1)).toThrowErrorMatchingInlineSnapshot(
      '"never"',
    );
  });

  test("nullable higher up the chain makes no difference", () => {
    const codec = fieldsAuto({
      test: nullable(fieldsAuto({ inner: string })),
    });

    expect(run(codec, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"]:
      Expected an object
      Got: 1
      Or expected: null
    `);

    expect(run(codec, { test: { inner: 1 } })).toMatchInlineSnapshot(`
      At root["test"]["inner"]:
      Expected a string
      Got: 1
      Or expected: null
    `);
  });

  test("undefinedOr and nullable", () => {
    const codec = undefinedOr(nullable(nullable(undefinedOr(string))));

    expectType<TypeEqual<Infer<typeof codec>, string | null | undefined>>(true);
    expectType<
      TypeEqual<InferEncoded<typeof codec>, string | null | undefined>
    >(true);

    expect(run(codec, 1)).toMatchInlineSnapshot(`
      At root:
      Expected a string
      Got: 1
      Or expected: null or undefined
    `);
  });
});

test("map", () => {
  const roundNumberCodec = map(number, {
    decoder: Math.round,
    encoder: (value) => value,
  });
  expectType<TypeEqual<Infer<typeof roundNumberCodec>, number>>(true);
  expectType<TypeEqual<InferEncoded<typeof roundNumberCodec>, number>>(true);
  expect(run(roundNumberCodec, 4.9)).toBe(5);
  expect(roundNumberCodec.encoder(4.9)).toBe(4.9);
  expect(run(roundNumberCodec, "4.9")).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: "4.9"
  `);

  const setCodec = map(array(number), {
    decoder: (arr) => new Set(arr),
    encoder: Array.from,
  });
  expectType<TypeEqual<Infer<typeof setCodec>, Set<number>>>(true);
  expectType<TypeEqual<InferEncoded<typeof setCodec>, Array<number>>>(true);
  expect(run(setCodec, [1, 2, 1])).toStrictEqual(new Set([1, 2]));
  expect(setCodec.encoder(new Set([1, 2]))).toStrictEqual([1, 2]);
});

test("flatMap", () => {
  const roundNumberCodec = flatMap(number, {
    decoder: (n) => ({
      tag: "Valid",
      value: Math.round(n),
    }),
    encoder: (value) => value,
  });
  expectType<TypeEqual<Infer<typeof roundNumberCodec>, number>>(true);
  expectType<TypeEqual<InferEncoded<typeof roundNumberCodec>, number>>(true);
  expect(run(roundNumberCodec, 4.9)).toBe(5);
  expect(roundNumberCodec.encoder(4.9)).toBe(4.9);
  expect(run(roundNumberCodec, "4.9")).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: "4.9"
  `);

  const failCodec = flatMap(number, {
    decoder: (n) => ({
      tag: "DecoderError",
      error: {
        tag: "custom",
        message: "The error message",
        got: n,
        path: ["some", "path", 0],
      },
    }),
    encoder: () => 1,
  });
  expectType<TypeEqual<Infer<typeof failCodec>, unknown>>(true);
  expectType<TypeEqual<InferEncoded<typeof failCodec>, number>>(true);

  expect(run(failCodec, 4.9)).toMatchInlineSnapshot(`
    At root["some"]["path"][0]:
    The error message
    Got: 4.9
  `);

  expect(failCodec.encoder(4.9)).toBe(1);
});
