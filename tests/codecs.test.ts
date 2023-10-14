import { expectType, TypeEqual } from "ts-expect";
import { describe, expect, test } from "vitest";

import {
  array,
  boolean,
  Codec,
  DecoderError,
  DecoderResult,
  field,
  fields,
  fieldsUnion,
  flatMap,
  formatAll,
  Infer,
  map,
  multi,
  nullOr,
  number,
  optional,
  parse,
  parseWithoutCodec,
  record,
  recursive,
  singleField,
  string,
  stringify,
  stringifyWithoutCodec,
  stringUnion,
  tag,
  tuple,
  undefinedOr,
  unknown,
} from "..";

function run<T>(codec: Codec<T>, value: unknown): T | string {
  const result = codec.decoder(value);
  switch (result.tag) {
    case "DecoderError":
      return formatAll(result.errors);
    case "Valid":
      return result.value;
  }
}

expect.addSnapshotSerializer({
  test: (value: unknown): boolean =>
    typeof value === "string" && value.includes("At root"),
  print: String,
});

test("boolean", () => {
  expect(boolean.decoder(true)).toBe(true);
  expect(boolean.decoder(false)).toBe(false);

  expect(boolean.encoder(true)).toBe(true);
  expect(boolean.encoder(false)).toBe(false);

  expectType<DecoderResult<boolean>>(boolean.decoder(true));
  expectType<boolean>(boolean.encoder(true));

  expect(run(boolean, 0)).toMatchInlineSnapshot(`
    At root:
    Expected a boolean
    Got: 0
  `);
});

test("number", () => {
  expect(number.decoder(0)).toMatchInlineSnapshot(`0`);
  expect(number.decoder(Math.PI)).toMatchInlineSnapshot(`3.141592653589793`);
  expect(number.decoder(NaN)).toMatchInlineSnapshot(`NaN`);
  expect(number.decoder(Infinity)).toMatchInlineSnapshot(`Infinity`);
  expect(number.decoder(-Infinity)).toMatchInlineSnapshot(`-Infinity`);

  expect(number.encoder(0)).toMatchInlineSnapshot(`0`);
  expect(number.encoder(Math.PI)).toMatchInlineSnapshot(`3.141592653589793`);
  expect(number.encoder(NaN)).toMatchInlineSnapshot(`NaN`);
  expect(number.encoder(Infinity)).toMatchInlineSnapshot(`Infinity`);
  expect(number.encoder(-Infinity)).toMatchInlineSnapshot(`-Infinity`);

  expectType<DecoderResult<number>>(number.decoder(0));
  expectType<number>(number.encoder(0));

  expect(run(number, undefined)).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: undefined
  `);
});

test("string", () => {
  expect(string.decoder("")).toBe("");
  expect(string.decoder("string")).toBe("string");

  expect(string.encoder("")).toBe("");
  expect(string.encoder("string")).toBe("string");

  expectType<DecoderResult<string>>(string.decoder(""));
  expectType<string>(string.encoder(""));

  expect(run(string, Symbol("desc"))).toMatchInlineSnapshot(`
    At root:
    Expected a string
    Got: Symbol(desc)
  `);
});

describe("stringUnion", () => {
  test("basic", () => {
    type Color = Infer<typeof colorCodec>;
    const colorCodec = stringUnion(["red", "green", "blue"]);

    expectType<TypeEqual<Color, "blue" | "green" | "red">>(true);

    const red: Color = "red";
    void red;

    // @ts-expect-error Type '"yellow"' is not assignable to type '"red" | "green" | "blue"'.
    const yellow: Color = "yellow";
    void yellow;

    expect(colorCodec.decoder("red")).toBe("red");
    expect(colorCodec.decoder("green")).toBe("green");
    expect(colorCodec.decoder("blue")).toBe("blue");

    expect(colorCodec.encoder("red")).toBe("red");
    expect(colorCodec.encoder("green")).toBe("green");
    expect(colorCodec.encoder("blue")).toBe("blue");

    expectType<DecoderResult<Color>>(colorCodec.decoder("red"));
    expectType<Color>(colorCodec.encoder("red"));
    // @ts-expect-error Passed object instead of array.
    stringUnion({ one: null, two: null });

    expect(run(colorCodec, "Red")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: "red", "green", "blue"
      Got: "Red"
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
  });

  test("variants must be strings", () => {
    // @ts-expect-error Type 'number' is not assignable to type 'string'.
    stringUnion([1]);
    const goodCodec = stringUnion(["1"]);
    expectType<TypeEqual<Infer<typeof goodCodec>, "1">>(true);
    expect(goodCodec.decoder("1")).toBe("1");
    expect(goodCodec.encoder("1")).toBe("1");
  });
});

describe("array", () => {
  test("basic", () => {
    type Bits = Infer<typeof bitsCodec>;
    const bitsCodec = array(stringUnion(["0", "1"]));

    expectType<TypeEqual<Bits, Array<"0" | "1">>>(true);
    expectType<DecoderResult<Bits>>(bitsCodec.decoder([]));
    expectType<Bits>(bitsCodec.encoder([]));
    // @ts-expect-error Type '"nope"' is not assignable to type '"0" | "1"'.
    bitsCodec.encoder(["nope"]);

    expect(bitsCodec.decoder([])).toStrictEqual([]);
    expect(bitsCodec.decoder(["0"])).toStrictEqual(["0"]);
    expect(bitsCodec.decoder(["0", "1", "1", "0"])).toStrictEqual([
      "0",
      "1",
      "1",
      "0",
    ]);

    expect(bitsCodec.encoder([])).toStrictEqual([]);
    expect(bitsCodec.encoder(["0"])).toStrictEqual(["0"]);
    expect(bitsCodec.encoder(["0", "1", "1", "0"])).toStrictEqual([
      "0",
      "1",
      "1",
      "0",
    ]);

    expect(run(bitsCodec, ["0", "2"])).toMatchInlineSnapshot(`
      At root[1]:
      Expected one of these variants: "0", "1"
      Got: "2"
    `);

    expect(run(array(number), { length: 0 })).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: {"length": 0}
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
    type Registers = Infer<typeof registersCodec>;
    const registersCodec = record(stringUnion(["0", "1"]));

    expectType<TypeEqual<Registers, Record<string, "0" | "1">>>(true);
    expectType<DecoderResult<Registers>>(registersCodec.decoder({}));
    expectType<Registers>(registersCodec.encoder({}));
    // @ts-expect-error Type '"nope"' is not assignable to type '"0" | "1"'.
    registersCodec.encoder({ a: "nope" });

    expect(registersCodec.decoder({})).toStrictEqual({});
    expect(registersCodec.decoder({ a: "0" })).toStrictEqual({ a: "0" });
    expect(
      registersCodec.decoder({ a: "0", b: "1", c: "1", d: "0" }),
    ).toStrictEqual({
      a: "0",
      b: "1",
      c: "1",
      d: "0",
    });

    expect(registersCodec.encoder({})).toStrictEqual({});
    expect(registersCodec.encoder({ a: "0" })).toStrictEqual({ a: "0" });
    expect(
      registersCodec.encoder({ a: "0", b: "1", c: "1", d: "0" }),
    ).toStrictEqual({
      a: "0",
      b: "1",
      c: "1",
      d: "0",
    });

    expect(run(registersCodec, { a: "0", b: "2" })).toMatchInlineSnapshot(`
      At root["b"]:
      Expected one of these variants: "0", "1"
      Got: "2"
    `);

    expect(run(record(number), [1])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [1]
    `);
  });

  test("keys to regex", () => {
    const codec = flatMap(record(string), {
      decoder: (items) => {
        const result: Array<[RegExp, string]> = [];
        const errors: Array<DecoderError> = [];
        for (const [key, value] of Object.entries(items)) {
          try {
            result.push([RegExp(key, "u"), value]);
          } catch (error) {
            errors.push({
              tag: "custom",
              message: error instanceof Error ? error.message : String(error),
              got: key,
              path: [key],
            });
          }
        }
        const [firstError, ...restErrors] = errors;
        return firstError === undefined
          ? { tag: "Valid", value: result }
          : {
              tag: "DecoderError",
              errors: [firstError, ...restErrors],
            };
      },
      encoder: (items) =>
        Object.fromEntries(items.map(([key, value]) => [key.source, value])),
    });

    expectType<TypeEqual<Infer<typeof codec>, Array<[RegExp, string]>>>(true);

    const good = { "\\d{4}:\\d{2}": "Year/month", ".*": "Rest" };
    const bad = { "\\d{4}:\\d{2": "Year/month", "*": "Rest" };

    expect(run(codec, good)).toStrictEqual([
      [/\d{4}:\d{2}/u, "Year/month"],
      [/.*/u, "Rest"],
    ]);

    expect(run(codec, bad)).toMatchInlineSnapshot(
      '"Invalid regular expression: /\\\\d{4}:\\\\d{2/u: Incomplete quantifier"',
    );

    expect(run(fields({ regexes: codec }), { regexes: bad }))
      .toMatchInlineSnapshot(`
        At root["regexes"]:
        Invalid regular expression: /\\d{4}:\\d{2/u: Incomplete quantifier
      `);
  });

  test("ignores __proto__", () => {
    expect(
      run(record(number), JSON.parse(`{"a": 1, "__proto__": 2, "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });
  });
});

describe("fields", () => {
  // @ts-expect-error 'readonly [{ decoder: (value: unknown) => string; encoder: (value: string) => string; }]' is not assignable to parameter of type 'FieldsMapping'.
  fields([string] as const);

  test("basic", () => {
    type Person = Infer<typeof personCodec>;
    const personCodec = fields({
      id: number,
      firstName: string,
    });

    expectType<TypeEqual<Person, { id: number; firstName: string }>>(true);
    expectType<DecoderResult<Person>>(
      personCodec.decoder({ id: 1, firstName: "John" }),
    );
    expectType<Record<string, unknown>>(
      personCodec.encoder({ id: 1, firstName: "John" }),
    );

    expect(personCodec.decoder({ id: 1, firstName: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(personCodec.encoder({ id: 1, firstName: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(run(personCodec, { id: "1", firstName: "John" }))
      .toMatchInlineSnapshot(`
        At root["id"]:
        Expected a number
        Got: "1"
      `);

    expect(run(personCodec, { id: 1, first_name: "John" }))
      .toMatchInlineSnapshot(`
        At root["firstName"]:
        Expected a string
        Got: undefined
      `);

    expect(run(fields({ 0: number }), [1])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [1]
    `);
  });

  describe("exact", () => {
    test("allows excess properties by default", () => {
      expect(
        run(fields({ one: string, two: boolean }), {
          one: "a",
          two: true,
          three: 3,
          four: {},
        }),
      ).toStrictEqual({ one: "a", two: true });
      expect(
        run(
          fields({ one: string, two: boolean }, { disallowExtraFields: false }),
          {
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toStrictEqual({ one: "a", two: true });
    });

    test("throw on excess properties", () => {
      expect(
        run(
          fields({ one: string, two: boolean }, { disallowExtraFields: true }),
          {
            one: "a",
            two: true,
            three: 3,
            four: {},
          },
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "one", "two"
        Found extra fields: "three", "four"
      `);
    });

    test("large number of excess properties", () => {
      expect(
        run(
          fields({ "1": boolean, "2": boolean }, { disallowExtraFields: true }),
          Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, false])),
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "1", "2"
        Found extra fields: "0", "3", "4", "5", "6", (93 more)
      `);
    });
  });

  test("__proto__ is not allowed", () => {
    const codec = fields({ a: number, __proto__: string, b: number });
    expect(
      run(codec, JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });

    const desc = Object.create(null) as { __proto__: Codec<string> };
    desc.__proto__ = string;
    const codec2 = fields(desc);
    expect(run(codec2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
  });

  test("empty object", () => {
    const codec = fields({}, { disallowExtraFields: true });
    expect(codec.decoder({})).toStrictEqual({});
    expect(codec.encoder({})).toStrictEqual({});
    expect(codec.encoder({ a: 1 })).toStrictEqual({});
    expect(run(codec, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: (none)
      Found extra fields: "a"
    `);
  });

  test("turn into a class", () => {
    class Person {
      constructor(
        public firstName: string,
        public lastName: string,
        public age?: number,
      ) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.age = age;
      }

      getFullName(): string {
        return `${this.firstName} ${this.lastName}`;
      }
    }

    const codec = map(
      fields({
        first_name: string,
        last_name: string,
        age: optional(number),
      }),
      {
        decoder: (object) =>
          new Person(object.first_name, object.last_name, object.age),
        encoder: (object) => ({
          first_name: object.firstName,
          last_name: object.lastName,
          ...(object.age === undefined ? {} : { age: object.age }),
        }),
      },
    );

    const result = codec.decoder({ first_name: "John", last_name: "Doe" });

    if (result.tag === "DecoderError") {
      throw new Error(formatAll(result.errors));
    }

    const person = result.value;

    if (person.firstName !== "John") {
      // @ts-expect-error Object is possibly 'undefined'.
      person.age.toFixed(2);
    }

    expect(person).toMatchInlineSnapshot(`
      Person {
        "age": undefined,
        "firstName": "John",
        "lastName": "Doe",
      }
    `);

    expect(person.getFullName()).toMatchInlineSnapshot(`"John Doe"`);

    expect(codec.encoder(person)).toMatchInlineSnapshot(`
      {
        "age": undefined,
        "first_name": "John",
        "last_name": "Doe",
      }
    `);
  });
});

describe("fieldsUnion", () => {
  test("basic", () => {
    type Shape = Infer<typeof shapeCodec>;
    const shapeCodec = fieldsUnion("tag", [
      {
        tag: tag("Circle"),
        radius: number,
      },
      {
        tag: tag("Rectangle"),
        width: field("width_px", number),
        height: field("height_px", number),
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
      shapeCodec.decoder({ tag: "Circle", radius: 5 }),
    );
    expectType<Record<string, unknown>>(
      shapeCodec.encoder({ tag: "Circle", radius: 5 }),
    );

    expect(shapeCodec.decoder({ tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(shapeCodec.encoder({ tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(run(shapeCodec, { tag: "Rectangle", radius: 5 }))
      .toMatchInlineSnapshot(`
        At root["width_px"]:
        Expected a number
        Got: undefined
      `);

    expect(run(shapeCodec, { tag: "Square", size: 5 })).toMatchInlineSnapshot(`
        At root["tag"]:
        Expected one of these tags: "Circle", "Rectangle"
        Got: "Square"
      `);

    expect(run(fieldsUnion("0", [{ "0": tag("a") }]), ["a"]))
      .toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: ["a"]
    `);
  });

  test("__proto__ is not allowed as the common field", () => {
    expect(() =>
      fieldsUnion("__proto__", [{ __proto__: tag("one") }]),
    ).toThrowErrorMatchingInlineSnapshot(
      '"fieldsUnion: commonField cannot be __proto__"',
    );
  });

  test("empty array is not allowed", () => {
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[Variant<"tag">, ...Variant<"tag">[]]'.
    //   Source has 0 element(s) but target requires 1.
    const emptyCodec = fieldsUnion("tag", []);
    // @ts-expect-error Type 'undefined' is not assignable to type 'never'.
    fieldsUnion(["fieldsUnion must have at least one variant", undefined], []);
    expect(run(emptyCodec, { tag: "test" })).toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags: (none)
      Got: "test"
    `);
  });
});

describe("tuple", () => {
  // @ts-expect-error Argument of type '{}' is not assignable to parameter of type 'readonly { decoder: (value: unknown) => unknown; encoder: (value: unknown) => unknown; }[]'.
  tuple({});
  // @ts-expect-error Argument of type '{ decoder: (value: unknown) => number; encoder: (value: number) => number; }' is not assignable to parameter of type 'readonly { decoder: (value: unknown) => unknown; encoder: (value: unknown) => unknown; }[]'.
  tuple(number);

  test("0 items", () => {
    type Type = Infer<typeof codec>;
    const codec = tuple([]);

    expectType<TypeEqual<Type, []>>(true);
    expectType<DecoderResult<Type>>(codec.decoder([]));
    expectType<Array<unknown>>(codec.encoder([]));

    expect(codec.decoder([])).toStrictEqual([]);
    expect(codec.encoder([])).toStrictEqual([]);
    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[]'.
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
    expectType<DecoderResult<Type>>(codec.decoder([1]));
    expectType<Array<unknown>>(codec.encoder([1]));
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[number]'.
    codec.encoder([]);
    // @ts-expect-error Argument of type '[number, number]' is not assignable to parameter of type '[number]'.
    codec.encoder([1, 2]);

    expect(codec.decoder([1])).toStrictEqual([1]);
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
    expectType<DecoderResult<Type>>(codec.decoder([1, "a"]));
    expectType<Array<unknown>>(codec.encoder([1, "a"]));
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[number, string]'.
    codec.encoder([]);
    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[number, string]'.
    codec.encoder([1]);
    // @ts-expect-error Type 'number' is not assignable to type 'string'.
    codec.encoder([1, 2]);
    // @ts-expect-error Argument of type '[number, string, number]' is not assignable to parameter of type '[number, string]'.
    codec.encoder([1, "a", 3]);

    expect(codec.decoder([1, "a"])).toStrictEqual([1, "a"]);
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
    expectType<DecoderResult<Type>>(codec.decoder([1, "a", true]));
    expectType<Array<unknown>>(codec.encoder([1, "a", true]));
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[number, string, boolean]'.
    codec.encoder([]);
    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[number, string, boolean]'.
    codec.encoder([1]);
    // @ts-expect-error Argument of type '[number, string]' is not assignable to parameter of type '[number, string, boolean]'.
    codec.encoder([1, "a"]);
    // @ts-expect-error Type 'number' is not assignable to type 'boolean'.
    codec.encoder([1, "a", 3]);
    // @ts-expect-error Argument of type '[number, string, true, number]' is not assignable to parameter of type '[number, string, boolean]'.
    codec.encoder([1, "a", true, 4]);

    expect(codec.decoder([1, "a", true])).toStrictEqual([1, "a", true]);
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
    expectType<DecoderResult<Type>>(codec.decoder([1, "a", true, 2]));
    expectType<Array<unknown>>(codec.encoder([1, "a", true, 2]));
    // @ts-expect-error Argument of type '[]' is not assignable to parameter of type '[number, string, boolean, number]'.
    codec.encoder([]);
    // @ts-expect-error Argument of type '[number]' is not assignable to parameter of type '[number, string, boolean, number]'.
    codec.encoder([1]);
    // @ts-expect-error Argument of type '[number, string]' is not assignable to parameter of type '[number, string, boolean, number]'.
    codec.encoder([1, "a"]);
    // @ts-expect-error Argument of type '[number, string, true]' is not assignable to parameter of type '[number, string, boolean, number]'.
    codec.encoder([1, "a", true]);
    // @ts-expect-error Type 'boolean' is not assignable to type 'number'.
    codec.encoder([1, "a", true, false]);
    // @ts-expect-error Argument of type '[number, string, true, number, number]' is not assignable to parameter of type '[number, string, boolean, number]'.
    codec.encoder([1, "a", true, 2, 5]);

    expect(codec.decoder([1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);
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

  test("allow only arrays", () => {
    expect(run(tuple([number]), { length: 0 })).toMatchInlineSnapshot(`
      At root:
      Expected an array
      Got: {"length": 0}
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
    type Id = Infer<typeof idCodec>;
    const idCodec = multi(["string", "number"]);

    expectType<
      TypeEqual<
        Id,
        { type: "number"; value: number } | { type: "string"; value: string }
      >
    >(true);
    expectType<DecoderResult<Id>>(idCodec.decoder("123"));
    expectType<number | string>(
      idCodec.encoder({ type: "string", value: "123" }),
    );

    expect(idCodec.decoder("123")).toStrictEqual({
      type: "string",
      value: "123",
    });

    expect(idCodec.decoder(123)).toStrictEqual({
      tag: "number",
      value: 123,
    });

    expect(idCodec.encoder({ type: "string", value: "123" })).toBe("123");

    expect(idCodec.encoder({ type: "number", value: 123 })).toBe(123);

    expect(run(idCodec, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – variation", () => {
    type Id = Infer<typeof idCodec>;
    const idCodec = map(multi(["string", "number"]), {
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
    expectType<DecoderResult<Id>>(idCodec.decoder("123"));
    expectType<number | string>(idCodec.encoder("123"));

    expect(idCodec.decoder("123")).toBe("123");
    expect(idCodec.decoder(123)).toBe("123");

    expect(idCodec.encoder("123")).toBe("123");
    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'string'.
    idCodec.encoder(123);

    expect(run(idCodec, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("empty array", () => {
    // @ts-expect-error Argument of type 'never[]' is not assignable to parameter of type '"multi must have at least one type"'.
    const codec = multi([]);
    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '("string" | "number" | "boolean" | "undefined" | "object" | "array" | "null")[]'.
    multi("multi must have at least one type");

    expectType<Codec<never>>(codec);

    expect(run(codec, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: never
      Got: undefined
    `);
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
      expect(codec.decoder(value)).toMatchObject({ value });
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

describe("optional", () => {
  test("optional does not allow undefined", () => {
    const codec = optional(string);

    expectType<TypeEqual<Infer<typeof codec>, string>>(true);

    expect(codec.decoder("a")).toBe("a");
    expect(run(codec, undefined)).toMatchInlineSnapshot();

    expect(codec.encoder("a")).toBe("a");
    // @ts-expect-error Argument of type 'undefined' is not assignable to parameter of type 'string'.
    codec.encoder(undefined);

    expect(run(codec, null)).toMatchInlineSnapshot(`
      At root (optional):
      Expected a string
      Got: null
    `);
  });

  test("optional field", () => {
    type Person = Infer<typeof personCodec>;
    const personCodec = fields({
      name: string,
      age: optional(number),
    });

    expectType<TypeEqual<Person, { name: string; age?: number }>>(true);

    expect(personCodec.decoder({ name: "John" })).toStrictEqual({
      name: "John",
    });

    expect(
      run(personCodec, { name: "John", age: undefined }),
    ).toMatchInlineSnapshot();

    expect(personCodec.decoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(personCodec.encoder({ name: "John" })).toStrictEqual({
      name: "John",
    });

    // @ts-expect-error Type 'undefined' is not assignable to type 'number'.
    personCodec.encoder({ name: "John", age: undefined });

    expect(personCodec.encoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personCodec, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (optional):
        Expected a number
        Got: "old"
      `);

    const person: Person = { name: "John" };
    void person;
  });
});

describe("undefinedOr", () => {
  test("undefined or string", () => {
    const codec = undefinedOr(string);

    expectType<TypeEqual<Infer<typeof codec>, string | undefined>>(true);

    expect(codec.decoder(undefined)).toBeUndefined();
    expect(codec.decoder("a")).toBe("a");

    expect(codec.encoder(undefined)).toBeUndefined();
    expect(codec.encoder("a")).toBe("a");

    expect(run(codec, null)).toMatchInlineSnapshot(`
      At root (optional):
      Expected a string
      Got: null
    `);
  });

  test("with default", () => {
    const codec = map(undefinedOr(string), {
      decoder: (value = "def") => value,
      encoder: (value) => value,
    });

    expectType<TypeEqual<Infer<typeof codec>, string>>(true);

    expect(codec.decoder(undefined)).toBe("def");
    expect(codec.decoder("a")).toBe("a");

    // @ts-expect-error Argument of type 'undefined' is not assignable to parameter of type 'string'.
    codec.encoder(undefined);
    expect(codec.encoder("def")).toBe("def");
    expect(codec.encoder("a")).toBe("a");
  });

  test("with other type default", () => {
    const codec = map(undefinedOr(string), {
      decoder: (value) => value ?? 0,
      encoder: (value) => (value === 0 ? undefined : value),
    });

    expectType<TypeEqual<Infer<typeof codec>, string | 0>>(true);

    expect(codec.decoder(undefined)).toBe(0);
    expect(codec.decoder("a")).toBe("a");

    expect(codec.encoder(0)).toBeUndefined();
    expect(codec.encoder("a")).toBe("a");
  });

  test("undefined for field", () => {
    type Person = Infer<typeof personCodec>;
    const personCodec = fields({
      name: string,
      age: undefinedOr(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | undefined }>>(
      true,
    );

    expect(personCodec.decoder({ name: "John" })).toStrictEqual({
      name: "John",
    });

    expect(personCodec.decoder({ name: "John", age: undefined })).toStrictEqual(
      { name: "John" },
    );

    expect(personCodec.decoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(personCodec.encoder({ name: "John", age: undefined })).toStrictEqual(
      { name: "John" },
    );

    expect(personCodec.encoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personCodec, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (optional):
        Expected a number
        Got: "old"
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | undefined; }'.
    const person: Person = { name: "John" };
    void person;
  });
});

describe("nullOr", () => {
  test("null or string", () => {
    const codec = nullOr(string);

    expectType<TypeEqual<Infer<typeof codec>, string | null>>(true);

    expect(codec.decoder(null)).toBeNull();
    expect(codec.decoder("a")).toBe("a");

    expect(codec.encoder(null)).toBeNull();
    expect(codec.encoder("a")).toBe("a");

    expect(run(codec, undefined)).toMatchInlineSnapshot(`
      At root (nullable):
      Expected a string
      Got: undefined
    `);
  });

  test("with default", () => {
    const codec = map(nullOr(string), {
      decoder: (value) => value ?? "def",
      encoder: (value) => value,
    });

    expectType<TypeEqual<Infer<typeof codec>, string>>(true);

    expect(codec.decoder(null)).toBe("def");
    expect(codec.decoder("a")).toBe("a");

    // @ts-expect-error Argument of type 'null' is not assignable to parameter of type 'string'.
    codec.encoder(null);
    expect(codec.encoder("def")).toBe("def");
    expect(codec.encoder("a")).toBe("a");
  });

  test("with other type default", () => {
    const codec = map(nullOr(string), {
      decoder: (value) => value ?? 0,
      encoder: (value) => (value === 0 ? null : value),
    });

    expectType<TypeEqual<Infer<typeof codec>, string | 0>>(true);

    expect(codec.decoder(null)).toBe(0);
    expect(codec.decoder("a")).toBe("a");

    expect(codec.encoder(0)).toBeNull();
    expect(codec.encoder("a")).toBe("a");
  });

  test("with undefined instead of null", () => {
    const codec = map(nullOr(string), {
      decoder: (value) => value ?? undefined,
      encoder: (value) => value ?? null,
    });

    expectType<TypeEqual<Infer<typeof codec>, string | undefined>>(true);

    expect(codec.decoder(null)).toBeUndefined();
    expect(codec.decoder("a")).toBe("a");

    expect(codec.encoder(undefined)).toBeNull();
    expect(codec.encoder("a")).toBe("a");
  });

  test("null for field", () => {
    type Person = Infer<typeof personCodec>;
    const personCodec = fields({
      name: string,
      age: nullOr(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | null }>>(true);

    expect(run(personCodec, { name: "John" })).toMatchInlineSnapshot(`
      At root["age"] (nullable):
      Expected a number
      Got: undefined
    `);

    expect(run(personCodec, { name: "John", age: undefined }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: undefined
      `);

    expect(personCodec.decoder({ name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(personCodec.decoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(personCodec.encoder({ name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(personCodec.encoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personCodec, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: "old"
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | null; }'.
    const person: Person = { name: "John" };
    void person;
  });

  test("undefined or nullable or string", () => {
    const decoder = undefinedOr(nullOr(nullOr(undefinedOr(string))));

    expect(run(decoder, 1)).toMatchInlineSnapshot(`
      At root (nullable) (optional):
      Expected a string
      Got: 1
    `);
  });
});

describe("map", () => {
  // @ts-expect-error Argument of type '{ decoder: (value: unknown) => DecoderResult<string>; encoder: (value: string) => string; }' is not assignable to parameter of type '{ decoder: (value: number) => string; encoder: (value: string) => number; }'.
  map(number, string);

  test("round", () => {
    const codec = map(number, { decoder: Math.round, encoder: Math.round });

    expect(codec.decoder(4.9)).toBe(5);
    expect(codec.encoder(4.9)).toBe(5);
  });

  test("Set", () => {
    const codec = map(array(number), {
      decoder: (arr) => new Set(arr),
      encoder: Array.from,
    });
    expect(codec.decoder([1, 2, 1])).toStrictEqual(new Set([1, 2]));
    expect(codec.encoder(new Set([1, 2]))).toStrictEqual([1, 2, 1]);
  });
});

test("constrain the input to a decoder", () => {
  const codec1 = fields({
    one: string,
  });

  const codec2 = fields({
    one: stringUnion(["foo", "bar"]),
  });

  function decodeConstrained<Decoded, Encoded>(
    codec: Codec<Decoded, Encoded>,
    value: Encoded,
  ): DecoderResult<Decoded> {
    return codec.decoder(value);
  }

  const result1 = codec1.decoder({ one: "foo" });

  if (result1.tag === "DecoderError") {
    throw new Error(formatAll(result1.errors));
  }

  const result2 = decodeConstrained(codec2, result1.value);

  if (result2.tag === "DecoderError") {
    throw new Error(formatAll(result2.errors));
  }

  // @ts-expect-error Argument of type '{ tag: "Valid"; value: { one: string; }; }' is not assignable to parameter of type '{ one: "foo" | "bar"; }'.
  //   Property 'one' is missing in type '{ tag: "Valid"; value: { one: string; }; }' but required in type '{ one: "foo" | "bar"; }'.
  decodeConstrained(codec2, result1);

  expect(result2.value).toStrictEqual({ one: "foo" });
});
