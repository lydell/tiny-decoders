import { expectType, TypeEqual } from "ts-expect";
import { describe, expect, test } from "vitest";

import {
  array,
  boolean,
  chain,
  Decoder,
  DecoderError,
  fields,
  fieldsAuto,
  fieldsUnion,
  multi,
  nullable,
  number,
  optional,
  record,
  repr,
  string,
  stringUnion,
  tuple,
} from "..";

function run<T>(decoder: Decoder<T>, value: unknown): T | string {
  try {
    return decoder(value);
  } catch (error) {
    return error instanceof DecoderError
      ? error.format()
      : error instanceof Error
      ? error.message
      : `Unknown error: ${repr(error)}`;
  }
}

expect.addSnapshotSerializer({
  test: (value: unknown): boolean =>
    typeof value === "string" && value.includes("At root"),
  print: String,
});

test("boolean", () => {
  expect(boolean(true)).toBe(true);
  expect(boolean(false)).toBe(false);

  expectType<boolean>(boolean(true));
  // @ts-expect-error Expected 1 arguments, but got 2.
  boolean(true, []);

  expect(run(boolean, 0)).toMatchInlineSnapshot(`
    At root:
    Expected a boolean
    Got: 0
  `);
});

test("number", () => {
  expect(number(0)).toMatchInlineSnapshot(`0`);
  expect(number(Math.PI)).toMatchInlineSnapshot(`3.141592653589793`);
  expect(number(NaN)).toMatchInlineSnapshot(`NaN`);
  expect(number(Infinity)).toMatchInlineSnapshot(`Infinity`);
  expect(number(-Infinity)).toMatchInlineSnapshot(`-Infinity`);

  expectType<number>(number(0));
  // @ts-expect-error Expected 1 arguments, but got 2.
  number(0, []);

  expect(run(number, undefined)).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: undefined
  `);
});

test("string", () => {
  expect(string("")).toBe("");
  expect(string("string")).toBe("string");

  expectType<string>(string(""));
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
    type Color = ReturnType<typeof colorDecoder>;
    const colorDecoder = stringUnion({
      red: null,
      green: null,
      blue: null,
    });

    expectType<TypeEqual<Color, "blue" | "green" | "red">>(true);

    const red: Color = "red";
    void red;

    // @ts-expect-error Type '"yellow"' is not assignable to type '"red" | "green" | "blue"'.
    const yellow: Color = "yellow";
    void yellow;

    expect(colorDecoder("red")).toBe("red");
    expect(colorDecoder("green")).toBe("green");
    expect(colorDecoder("blue")).toBe("blue");

    expectType<Color>(colorDecoder("red"));
    // @ts-expect-error Passed array instead of object.
    stringUnion(["one", "two"]);

    expect(run(colorDecoder, "Red")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: "red", "green", "blue"
      Got: "Red"
    `);
  });

  test("edge case keys", () => {
    const edgeCaseDecoder = stringUnion({
      constructor: null,
      // Specifying `__proto__` is safe here.
      __proto__: null,
    });
    expect(edgeCaseDecoder("constructor")).toBe("constructor");
    // But `__proto__` won’t work, because it’s not an “own” property for some reason.
    // I haven’t been able to forbid `__proto__` using TypeScript.
    // Notice how "__proto__" isn’t even in the expected keys.
    expect(run(edgeCaseDecoder, "__proto__")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: "constructor"
      Got: "__proto__"
    `);
    expect(run(edgeCaseDecoder, "hasOwnProperty")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: "constructor"
      Got: "hasOwnProperty"
    `);
  });

  test("empty object is not allowed", () => {
    // @ts-expect-error Argument of type '{}' is not assignable to parameter of type '"stringUnion must have at least one key"'.
    const emptyDecoder = stringUnion({});
    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'Record<string, null>'.
    stringUnion("stringUnion must have at least one key");
    expectType<TypeEqual<ReturnType<typeof emptyDecoder>, never>>(true);
    expect(run(emptyDecoder, "test")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: (none)
      Got: "test"
    `);
  });

  test("keys must be strings", () => {
    // @ts-expect-error Type 'null' is not assignable to type '["stringUnion keys must be strings, not numbers", never]'.
    stringUnion({ 1: null });
    // @ts-expect-error Type 'null' is not assignable to type 'never'.
    stringUnion({ 1: ["stringUnion keys must be strings, not numbers", null] });
    const goodDecoder = stringUnion({ "1": null });
    expectType<TypeEqual<ReturnType<typeof goodDecoder>, "1">>(true);
    expect(goodDecoder("1")).toBe("1");
  });
});

describe("array", () => {
  test("basic", () => {
    type Bits = ReturnType<typeof bitsDecoder>;
    const bitsDecoder = array(stringUnion({ "0": null, "1": null }));

    expectType<TypeEqual<Bits, Array<"0" | "1">>>(true);
    expectType<Bits>(bitsDecoder([]));

    expect(bitsDecoder([])).toStrictEqual([]);
    expect(bitsDecoder(["0"])).toStrictEqual(["0"]);
    expect(bitsDecoder(["0", "1", "1", "0"])).toStrictEqual([
      "0",
      "1",
      "1",
      "0",
    ]);

    expect(run(bitsDecoder, ["0", "2"])).toMatchInlineSnapshot(`
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
    type Registers = ReturnType<typeof registersDecoder>;
    const registersDecoder = record(stringUnion({ "0": null, "1": null }));

    expectType<TypeEqual<Registers, Record<string, "0" | "1">>>(true);
    expectType<Registers>(registersDecoder({}));

    expect(registersDecoder({})).toStrictEqual({});
    expect(registersDecoder({ a: "0" })).toStrictEqual({ a: "0" });
    expect(registersDecoder({ a: "0", b: "1", c: "1", d: "0" })).toStrictEqual({
      a: "0",
      b: "1",
      c: "1",
      d: "0",
    });

    expect(run(registersDecoder, { a: "0", b: "2" })).toMatchInlineSnapshot(`
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
    const decoder = chain(record(string), (items) =>
      Object.entries(items).map(
        ([key, value]) => [RegExp(key, "u"), value] as const,
      ),
    );

    expectType<
      TypeEqual<ReturnType<typeof decoder>, Array<readonly [RegExp, string]>>
    >(true);

    const good = { "\\d{4}:\\d{2}": "Year/month", ".*": "Rest" };
    const bad = { "\\d{4}:\\d{2": "Year/month", ".*": "Rest" };

    expect(run(decoder, good)).toStrictEqual([
      [/\d{4}:\d{2}/u, "Year/month"],
      [/.*/u, "Rest"],
    ]);

    expect(run(decoder, bad)).toMatchInlineSnapshot(
      '"Invalid regular expression: /\\\\d{4}:\\\\d{2/u: Incomplete quantifier"',
    );

    expect(run(fieldsAuto({ regexes: decoder }), { regexes: bad }))
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
  test("basic", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fields((field) => ({
      id: field("id", number),
      firstName: field("first_name", string),
    }));

    expectType<TypeEqual<Person, { id: number; firstName: string }>>(true);
    expectType<Person>(personDecoder({ id: 1, first_name: "John" }));

    expect(personDecoder({ id: 1, first_name: "John" })).toStrictEqual({
      id: 1,
      firstName: "John",
    });

    expect(run(personDecoder, { id: "1", first_name: "John" }))
      .toMatchInlineSnapshot(`
        At root["id"]:
        Expected a number
        Got: "1"
      `);

    expect(run(personDecoder, { id: 1, firstName: "John" }))
      .toMatchInlineSnapshot(`
        At root["first_name"]:
        Expected a string
        Got: undefined
      `);

    expect(
      run(
        fields((field) => field("0", number)),
        [1],
      ),
    ).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [1]
    `);
  });

  describe("exact", () => {
    test("allows excess properties by default", () => {
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)]),
          { one: "a", two: true, three: 3, four: {} },
        ),
      ).toStrictEqual(["a", true]);
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)], {
            exact: "allow extra",
          }),
          { one: "a", two: true, three: 3, four: {} },
        ),
      ).toStrictEqual(["a", true]);
    });

    test("throw on excess properties", () => {
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)], {
            exact: "throw",
          }),
          { one: "a", two: true, three: 3, four: {} },
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
          fields((field) => [field("1", boolean), field("2", boolean)], {
            exact: "throw",
          }),
          Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, false])),
        ),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "1", "2"
        Found extra fields: "0", "3", "4", "5", "6", (93 more)
      `);
    });

    test("different fields based on one field", () => {
      const userDecoder = fields(
        (field) =>
          field("isAdmin", boolean)
            ? {
                isAdmin: true,
                name: field("name", string),
                access: field("access", array(string)),
              }
            : {
                isAdmin: false,
                name: field("name", string),
                location: optional(string),
              },
        { exact: "throw" },
      );

      expect(
        run(userDecoder, {
          isAdmin: true,
          name: "John",
          access: [],
          age: 12,
        }),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "isAdmin", "name", "access"
        Found extra fields: "age"
      `);

      expect(
        run(userDecoder, {
          isAdmin: false,
          name: "Jane",
          access: [],
          age: 12,
        }),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "isAdmin", "name"
        Found extra fields: "access", "age"
      `);
    });
  });

  describe("allow", () => {
    test("object", () => {
      const decoder = fields((field) => field("length", number), {
        allow: "object",
      });
      expect(decoder({ length: 0 })).toBe(0);
      expect(run(decoder, [])).toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: []
      `);
    });

    test("array", () => {
      const decoder = fields(
        (field) => [field("length", number), field("0", boolean)],
        { allow: "array" },
      );
      expect(decoder([true])).toStrictEqual([1, true]);
      expect(run(decoder, { length: 0 })).toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: {"length": 0}
      `);
      expect(run(decoder, [])).toMatchInlineSnapshot(`
        At root["0"]:
        Expected a boolean
        Got: undefined
      `);

      // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'string'.
      fields((field) => field(0, string));
    });
  });

  test("obj", () => {
    const objInput = {};
    const result = fields((_field, obj) => {
      expect(obj).toBe(objInput);
      return 1;
    })(objInput);
    expect(result).toBe(1);
  });

  test("empty object", () => {
    const decoder = fields(() => 1, { exact: "throw" });
    expect(decoder({})).toBe(1);
    expect(run(decoder, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: (none)
      Found extra fields: "a"
    `);
  });

  test("return a class", () => {
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

    const decoder = fields(
      (field) =>
        new Person(
          field("first_name", string),
          field("last_name", string),
          field("age", optional(number)),
        ),
    );

    const person = decoder({ first_name: "John", last_name: "Doe" });

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
  });
});

describe("fieldsAuto", () => {
  // @ts-expect-error Argument of type 'readonly [(value: unknown) => string]' is not assignable to parameter of type '{ [x: string]: Decoder<unknown, unknown>; }'.
  fieldsAuto([string] as const);

  test("basic", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      id: number,
      firstName: string,
    });

    expectType<TypeEqual<Person, { id: number; firstName: string }>>(true);
    expectType<Person>(personDecoder({ id: 1, firstName: "John" }));

    expect(personDecoder({ id: 1, firstName: "John" })).toStrictEqual({
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
        At root["firstName"]:
        Expected a string
        Got: undefined
      `);

    expect(run(fieldsAuto({ 0: number }), [1])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: [1]
    `);
  });

  describe("exact", () => {
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
          fieldsAuto({ one: string, two: boolean }, { exact: "allow extra" }),
          { one: "a", two: true, three: 3, four: {} },
        ),
      ).toStrictEqual({ one: "a", two: true });
    });

    test("throw on excess properties", () => {
      expect(
        run(fieldsAuto({ one: string, two: boolean }, { exact: "throw" }), {
          one: "a",
          two: true,
          three: 3,
          four: {},
        }),
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: "one", "two"
        Found extra fields: "three", "four"
      `);
    });

    test("large number of excess properties", () => {
      expect(
        run(
          fieldsAuto({ "1": boolean, "2": boolean }, { exact: "throw" }),
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
    // @ts-expect-error Type '(value: unknown) => string' is not assignable to type 'never'.
    const decoder = fieldsAuto({ a: number, __proto__: string, b: number });
    expect(
      run(decoder, JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`)),
    ).toStrictEqual({ a: 1, b: 3 });

    const desc = Object.create(null) as { __proto__: Decoder<string> };
    desc.__proto__ = string;
    // @ts-expect-error Argument of type '{ __proto__: Decoder<string, unknown>; }' is not assignable to parameter of type '{ __proto__: never; }'.
    const decoder2 = fieldsAuto(desc);
    expect(run(decoder2, JSON.parse(`{"__proto__": "a"}`))).toStrictEqual({});
  });

  test("empty object", () => {
    const decoder = fieldsAuto({}, { exact: "throw" });
    expect(decoder({})).toStrictEqual({});
    expect(run(decoder, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: (none)
      Found extra fields: "a"
    `);
  });
});

describe("fieldsUnion", () => {
  test("basic", () => {
    type Shape = ReturnType<typeof shapeDecoder>;
    const shapeDecoder = fieldsUnion("tag", {
      Circle: fieldsAuto({
        tag: () => "Circle" as const,
        radius: number,
      }),
      Rectangle: fields((field) => ({
        tag: "Rectangle" as const,
        width: field("width_px", number),
        height: field("height_px", number),
      })),
    });

    expectType<
      TypeEqual<
        Shape,
        | { tag: "Circle"; radius: number }
        | { tag: "Rectangle"; width: number; height: number }
      >
    >(true);
    expectType<Shape>(shapeDecoder({ tag: "Circle", radius: 5 }));

    expect(shapeDecoder({ tag: "Circle", radius: 5 })).toStrictEqual({
      tag: "Circle",
      radius: 5,
    });

    expect(run(shapeDecoder, { tag: "Rectangle", radius: 5 }))
      .toMatchInlineSnapshot(`
        At root["width_px"]:
        Expected a number
        Got: undefined
      `);

    expect(run(shapeDecoder, { tag: "Square", size: 5 }))
      .toMatchInlineSnapshot(`
        At root["tag"]:
        Expected one of these tags: "Circle", "Rectangle"
        Got: "Square"
      `);

    expect(run(fieldsUnion("0", { a: () => 0 }), ["a"])).toMatchInlineSnapshot(`
      At root:
      Expected an object
      Got: ["a"]
    `);
  });

  test("edge case keys", () => {
    const edgeCaseDecoder = fieldsUnion("tag", {
      constructor: (x) => x,
      // Specifying `__proto__` is safe here.
      __proto__: (x) => x,
    });
    expect(edgeCaseDecoder({ tag: "constructor" })).toStrictEqual({
      tag: "constructor",
    });
    // But `__proto__` won’t work, because it’s not an “own” property for some reason.
    // I haven’t been able to forbid `__proto__` using TypeScript.
    // Notice how "__proto__" isn’t even in the expected keys.
    expect(run(edgeCaseDecoder, { tag: "__proto__" })).toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags: "constructor"
      Got: "__proto__"
    `);
    expect(run(edgeCaseDecoder, { tag: "hasOwnProperty" }))
      .toMatchInlineSnapshot(`
        At root["tag"]:
        Expected one of these tags: "constructor"
        Got: "hasOwnProperty"
      `);
  });

  test("empty object is not allowed", () => {
    // @ts-expect-error Argument of type '{}' is not assignable to parameter of type '"fieldsUnion must have at least one member"'.
    const emptyDecoder = fieldsUnion("tag", {});
    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'Record<string, Decoder<unknown, unknown>>'.
    fieldsUnion("tag", "fieldsUnion must have at least one member");
    expectType<TypeEqual<ReturnType<typeof emptyDecoder>, never>>(true);
    expect(run(emptyDecoder, { tag: "test" })).toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags: (none)
      Got: "test"
    `);
  });

  test("keys must be strings", () => {
    const innerDecoder = fieldsAuto({ tag: stringUnion({ "1": null }) });
    // @ts-expect-error Type 'Decoder<{ 1: string; }, unknown>' is not assignable to type '"fieldsUnion keys must be strings, not numbers"'.
    fieldsUnion("tag", { 1: innerDecoder });
    // @ts-expect-error Type 'string' is not assignable to type 'Decoder<unknown, unknown>'.
    fieldsUnion("tag", { 1: "fieldsUnion keys must be strings, not numbers" });
    const goodDecoder = fieldsUnion("tag", { "1": innerDecoder });
    expectType<TypeEqual<ReturnType<typeof goodDecoder>, { tag: "1" }>>(true);
    expect(goodDecoder({ tag: "1" })).toStrictEqual({ tag: "1" });
  });
});

describe("tuple", () => {
  // @ts-expect-error Argument of type '{}' is not assignable to parameter of type 'readonly Decoder<unknown, unknown>[]'.
  tuple({});
  // @ts-expect-error Argument of type '(value: unknown) => number' is not assignable to parameter of type 'readonly Decoder<unknown, unknown>[]'.
  tuple(number);

  test("0 items", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([]);

    expectType<TypeEqual<Type, []>>(true);
    expectType<Type>(decoder([]));

    expect(decoder([])).toStrictEqual([]);

    expect(run(decoder, [1])).toMatchInlineSnapshot(`
      At root:
      Expected 0 items
      Got: 1
    `);
  });

  test("1 item", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number]);

    expectType<TypeEqual<Type, [number]>>(true);
    expectType<Type>(decoder([1]));

    expect(decoder([1])).toStrictEqual([1]);

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
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string]);

    expectType<TypeEqual<Type, [number, string]>>(true);
    expectType<Type>(decoder([1, "a"]));

    expect(decoder([1, "a"])).toStrictEqual([1, "a"]);

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
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string, boolean]);

    expectType<TypeEqual<Type, [number, string, boolean]>>(true);
    expectType<Type>(decoder([1, "a", true]));

    expect(decoder([1, "a", true])).toStrictEqual([1, "a", true]);

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
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string, boolean, number]);

    expectType<TypeEqual<Type, [number, string, boolean, number]>>(true);
    expectType<Type>(decoder([1, "a", true, 2]));

    expect(decoder([1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);

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
    type Id = ReturnType<typeof idDecoder>;
    const idDecoder = multi({
      string: (id) => ({ tag: "Id" as const, id }),
      number: (id) => ({ tag: "LegacyId" as const, id }),
    });

    expectType<
      TypeEqual<Id, { tag: "Id"; id: string } | { tag: "LegacyId"; id: number }>
    >(true);
    expectType<Id>(idDecoder("123"));

    expect(idDecoder("123")).toStrictEqual({
      tag: "Id",
      id: "123",
    });

    expect(idDecoder(123)).toStrictEqual({
      tag: "LegacyId",
      id: 123,
    });

    expect(run(idDecoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("basic – variation", () => {
    type Id = ReturnType<typeof idDecoder>;
    const idDecoder = multi({
      string: (id) => id,
      number: String,
    });

    expectType<TypeEqual<Id, string>>(true);
    expectType<Id>(idDecoder("123"));

    expect(idDecoder("123")).toBe("123");
    expect(idDecoder(123)).toBe("123");

    expect(run(idDecoder, true)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: string, number
      Got: true
    `);
  });

  test("empty object", () => {
    const decoder = multi({});

    expectType<Decoder<never>>(decoder);

    expect(run(decoder, undefined)).toMatchInlineSnapshot(`
      At root:
      Expected one of these types: never
      Got: undefined
    `);
  });

  test("all types", () => {
    const decoder = multi({
      undefined: (x) => x,
      null: (x) => x,
      boolean: (x) => x,
      number: (x) => x,
      string: (x) => x,
      array: (x) => x,
      object: (x) => x,
    });

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
      expect(decoder(value)).toStrictEqual(value);
    }
  });

  test("coverage", () => {
    const decoder = multi({ undefined: (x) => x });

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

describe("optional", () => {
  test("optional string", () => {
    const decoder = optional(string);

    expectType<TypeEqual<ReturnType<typeof decoder>, string | undefined>>(true);

    expect(decoder(undefined)).toBeUndefined();
    expect(decoder("a")).toBe("a");

    expect(run(decoder, null)).toMatchInlineSnapshot(`
      At root (optional):
      Expected a string
      Got: null
    `);
  });

  test("with default", () => {
    const decoder = optional(string, "def");

    expectType<TypeEqual<ReturnType<typeof decoder>, string>>(true);

    expect(decoder(undefined)).toBe("def");
    expect(decoder("a")).toBe("a");
  });

  test("with other type default", () => {
    const decoder = optional(string, 0);

    expectType<TypeEqual<ReturnType<typeof decoder>, number | string>>(true);

    expect(decoder(undefined)).toBe(0);
    expect(decoder("a")).toBe("a");
  });

  test("optional field", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fields((field) => ({
      name: field("name", string),
      age: field("age", optional(number)),
    }));

    expectType<TypeEqual<Person, { name: string; age?: number }>>(true);

    expect(personDecoder({ name: "John" })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(personDecoder({ name: "John", age: undefined })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(personDecoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (optional):
        Expected a number
        Got: "old"
      `);

    const person: Person = { name: "John" };
    void person;
  });

  test("optional autoField", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      name: string,
      age: optional(number),
    });

    expectType<TypeEqual<Person, { name: string; age?: number }>>(true);

    expect(personDecoder({ name: "John" })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(personDecoder({ name: "John", age: undefined })).toStrictEqual({
      name: "John",
      age: undefined,
    });

    expect(personDecoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (optional):
        Expected a number
        Got: "old"
      `);

    const person: Person = { name: "John" };
    void person;
  });

  test("optional custom decoder", () => {
    function decoder(): never {
      throw new Error("Fail");
    }
    function decoder2(): never {
      throw new DecoderError({ message: "Fail", value: 1 });
    }

    expect(run(optional(decoder), 1)).toMatchInlineSnapshot(`
      At root (optional):
      Fail
    `);

    expect(run(optional(decoder2), 1)).toMatchInlineSnapshot(`
      At root (optional):
      Fail
      Got: 1
    `);
  });

  test("optional higher up the chain makes no difference", () => {
    const decoder = fieldsAuto({
      test: optional(fieldsAuto({ inner: string })),
    });

    expect(run(decoder, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"] (optional):
      Expected an object
      Got: 1
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

    expectType<TypeEqual<ReturnType<typeof decoder>, string | null>>(true);

    expect(decoder(null)).toBeNull();
    expect(decoder("a")).toBe("a");

    expect(run(decoder, undefined)).toMatchInlineSnapshot(`
      At root (nullable):
      Expected a string
      Got: undefined
    `);
  });

  test("with default", () => {
    const decoder = nullable(string, "def");

    expectType<TypeEqual<ReturnType<typeof decoder>, string>>(true);

    expect(decoder(null)).toBe("def");
    expect(decoder("a")).toBe("a");
  });

  test("with other type default", () => {
    const decoder = nullable(string, 0);

    expectType<TypeEqual<ReturnType<typeof decoder>, number | string>>(true);

    expect(decoder(null)).toBe(0);
    expect(decoder("a")).toBe("a");
  });

  test("with undefined instead of null", () => {
    const decoder = nullable(string, undefined);

    expectType<TypeEqual<ReturnType<typeof decoder>, string | undefined>>(true);

    expect(decoder(null)).toBeUndefined();
    expect(decoder("a")).toBe("a");
  });

  test("nullable field", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fields((field) => ({
      name: field("name", string),
      age: field("age", nullable(number)),
    }));

    expectType<TypeEqual<Person, { name: string; age: number | null }>>(true);

    expect(run(personDecoder, { name: "John" })).toMatchInlineSnapshot(`
      At root["age"] (nullable):
      Expected a number
      Got: undefined
    `);

    expect(run(personDecoder, { name: "John", age: undefined }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: undefined
      `);

    expect(personDecoder({ name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(personDecoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: "old"
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | null; }'.
    const person: Person = { name: "John" };
    void person;
  });

  test("nullable autoField", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = fieldsAuto({
      name: string,
      age: nullable(number),
    });

    expectType<TypeEqual<Person, { name: string; age: number | null }>>(true);

    expect(run(personDecoder, { name: "John" })).toMatchInlineSnapshot(`
      At root["age"] (nullable):
      Expected a number
      Got: undefined
    `);

    expect(run(personDecoder, { name: "John", age: undefined }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: undefined
      `);

    expect(personDecoder({ name: "John", age: null })).toStrictEqual({
      name: "John",
      age: null,
    });

    expect(personDecoder({ name: "John", age: 45 })).toStrictEqual({
      name: "John",
      age: 45,
    });

    expect(run(personDecoder, { name: "John", age: "old" }))
      .toMatchInlineSnapshot(`
        At root["age"] (nullable):
        Expected a number
        Got: "old"
      `);

    // @ts-expect-error Property 'age' is missing in type '{ name: string; }' but required in type '{ name: string; age: number | null; }'.
    const person: Person = { name: "John" };
    void person;
  });

  test("nullable custom decoder", () => {
    function decoder(): never {
      throw new Error("Fail");
    }
    function decoder2(): never {
      throw new DecoderError({ message: "Fail", value: 1 });
    }

    expect(run(nullable(decoder), 1)).toMatchInlineSnapshot(`
      At root (nullable):
      Fail
    `);

    expect(run(nullable(decoder2), 1)).toMatchInlineSnapshot(`
      At root (nullable):
      Fail
      Got: 1
    `);
  });

  test("nullable higher up the chain makes no difference", () => {
    const decoder = fieldsAuto({
      test: nullable(fieldsAuto({ inner: string })),
    });

    expect(run(decoder, { test: 1 })).toMatchInlineSnapshot(`
      At root["test"] (nullable):
      Expected an object
      Got: 1
    `);

    expect(run(decoder, { test: { inner: 1 } })).toMatchInlineSnapshot(`
      At root["test"]["inner"]:
      Expected a string
      Got: 1
    `);
  });

  test("optional and nullable", () => {
    const decoder = optional(nullable(nullable(optional(string))));

    expect(run(decoder, 1)).toMatchInlineSnapshot(`
      At root (nullable) (optional):
      Expected a string
      Got: 1
    `);
  });
});

test("chain", () => {
  expect(run(chain(number, Math.round), 4.9)).toBe(5);

  expect(
    run(
      chain(array(number), (arr) => new Set(arr)),
      [1, 2, 1],
    ),
  ).toStrictEqual(new Set([1, 2]));

  expect(run(chain(number, string), 0)).toMatchInlineSnapshot(`
    At root:
    Expected a string
    Got: 0
  `);

  expect(run(chain(number, string), "string")).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: "string"
  `);
});
