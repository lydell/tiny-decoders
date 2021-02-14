import { expectType, TypeEqual } from "ts-expect";

// TODO: Test all of them!
import {
  array,
  autoFields,
  boolean,
  constant,
  Decoder,
  DecoderError,
  // deep,
  fields,
  fieldsUnion,
  // lazy,
  map,
  // multi,
  // nullable,
  number,
  optional,
  // optionalNullable,
  record,
  repr,
  string,
  stringUnion,
  tuple,
} from "../";

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

function runWithErrorsArray<T>(
  decoder: Decoder<T>,
  value: unknown
): string | { decoded: T; errors: Array<string> } {
  const errors: Array<DecoderError> = [];
  try {
    const decoded = decoder(value);
    expect(decoder(value, errors)).toStrictEqual(decoded);
    return {
      decoded,
      errors: errors.map((error) => error.format()),
    };
  } catch (error) {
    return error instanceof DecoderError
      ? error.format()
      : "Not a DecoderError";
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

test("constant", () => {
  const undefinedDecoder = constant(undefined);
  expectType<TypeEqual<ReturnType<typeof undefinedDecoder>, undefined>>(true);
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  expect(undefinedDecoder(undefined)).toBeUndefined();

  const nullDecoder = constant(null);
  expectType<TypeEqual<ReturnType<typeof nullDecoder>, null>>(true);
  expect(nullDecoder(null)).toBeNull();

  const trueDecoder = constant(true);
  expectType<TypeEqual<ReturnType<typeof trueDecoder>, true>>(true);
  expect(trueDecoder(true)).toBe(true);

  const falseDecoder = constant(false);
  expectType<TypeEqual<ReturnType<typeof falseDecoder>, false>>(true);
  expect(falseDecoder(false)).toBe(false);

  const zeroDecoder = constant(0);
  expectType<TypeEqual<ReturnType<typeof zeroDecoder>, 0>>(true);
  expect(zeroDecoder(0)).toBe(0);

  const negativeDecimalDecoder = constant(-1.5);
  expectType<TypeEqual<ReturnType<typeof negativeDecimalDecoder>, -1.5>>(true);
  expect(negativeDecimalDecoder(-1.5)).toBe(-1.5);

  const emptyStringDecoder = constant("");
  expectType<TypeEqual<ReturnType<typeof emptyStringDecoder>, "">>(true);
  expect(emptyStringDecoder("")).toBe("");

  const stringDecoder = constant("string");
  expectType<TypeEqual<ReturnType<typeof stringDecoder>, "string">>(true);
  expect(stringDecoder("string")).toBe("string");

  // @ts-expect-error Expected 1 arguments, but got 2.
  constant(true, []);
  // @ts-expect-error Arrays can’t be compared easily:
  constant([]);
  // @ts-expect-error Objects can’t be compared easily:
  constant({});
  // @ts-expect-error Accidentally passed a decoder:
  constant(string);

  // `NaN !== NaN`. Not the best error message. Maybe we should use `Object.is`
  // in the future.
  const nanDecoder = constant(NaN);
  expectType<TypeEqual<ReturnType<typeof nanDecoder>, number>>(true);
  expect(run(nanDecoder, NaN)).toMatchInlineSnapshot(`
    At root:
    Expected the value NaN
    Got: NaN
  `);
});

describe("stringUnion", () => {
  test("Basic", () => {
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
      Expected one of these variants: ["red", "green", "blue"]
      Got: "Red"
    `);
  });

  test("Edge case keys", () => {
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
      Expected one of these variants: ["constructor"]
      Got: "__proto__"
    `);
    expect(run(edgeCaseDecoder, "hasOwnProperty")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: ["constructor"]
      Got: "hasOwnProperty"
    `);
  });

  test("Empty object is not allowed", () => {
    // @ts-expect-error Argument of type '{}' is not assignable to parameter of type '"stringUnion must have at least one key"'.
    const emptyDecoder = stringUnion({});
    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'Record<string, null>'.
    stringUnion("stringUnion must have at least one key");
    expectType<TypeEqual<ReturnType<typeof emptyDecoder>, never>>(true);
    expect(run(emptyDecoder, "test")).toMatchInlineSnapshot(`
      At root:
      Expected one of these variants: []
      Got: "test"
    `);
  });

  test("Keys must be strings", () => {
    // @ts-expect-error Type 'null' is not assignable to type '"stringUnion keys must be strings, not numbers!"'.
    stringUnion({ 1: null });
    // @ts-expect-error Type 'string' is not assignable to type 'null'.
    stringUnion({ 1: "stringUnion keys must be strings, not numbers!" });
    const goodDecoder = stringUnion({ "1": null });
    expectType<TypeEqual<ReturnType<typeof goodDecoder>, "1">>(true);
    expect(goodDecoder("1")).toBe("1");
  });
});

describe("array", () => {
  test("Basic", () => {
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
      Expected one of these variants: ["0", "1"]
      Got: "2"
    `);
  });

  describe("allow", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"object" | "array" | "object/array" | undefined'.
    array(number, { allow: "nope" });

    test("allows only arrays by default", () => {
      expect(run(array(number), [0])).toStrictEqual([0]);
      expect(run(array(number, { allow: "array" }), [0])).toStrictEqual([0]);
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

    test("allow only objects", () => {
      expect(
        run(array(number, { allow: "object" }), { length: 0 })
      ).toStrictEqual([]);
      expect(
        run(array(number, { allow: "object" }), new Int32Array(2))
      ).toStrictEqual([0, 0]);
      expect(run(array(number, { allow: "object" }), []))
        .toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: []
      `);
    });

    test("allow both", () => {
      expect(
        run(array(number, { allow: "object/array" }), { length: 0 })
      ).toStrictEqual([]);
      expect(
        run(array(number, { allow: "object/array" }), new Int32Array(2))
      ).toStrictEqual([0, 0]);
      expect(run(array(number, { allow: "object/array" }), [])).toStrictEqual(
        []
      );
    });

    describe("invalid length attribute", () => {
      const variants: Array<unknown> = [
        "1",
        1.5,
        -1,
        -0.1,
        2 ** 32,
        NaN,
        Infinity,
        null,
        -1,
      ];

      for (const length of variants) {
        test(`${repr(length)}`, () => {
          expect(run(array(number, { allow: "object" }), { length })).toBe(
            `
At root["length"]:
Expected a valid array length (unsigned 32-bit integer)
Got: ${repr(length)}
          `.trim()
          );
        });
      }
    });
  });

  describe("mode", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"skip" | "throw" | { default: never; } | undefined'.
    array(number, { mode: "nope" });

    test("throw", () => {
      expect(runWithErrorsArray(array(number), [1, "2", 3]))
        .toMatchInlineSnapshot(`
        At root[1]:
        Expected a number
        Got: "2"
      `);
      expect(runWithErrorsArray(array(number, { mode: "throw" }), [1, "2", 3]))
        .toMatchInlineSnapshot(`
        At root[1]:
        Expected a number
        Got: "2"
      `);
    });

    test("skip", () => {
      expect(runWithErrorsArray(array(number, { mode: "skip" }), [1, "2", 3]))
        .toMatchInlineSnapshot(`
        Object {
          "decoded": Array [
            1,
            3,
          ],
          "errors": Array [
            At root[1]:
        Expected a number
        Got: "2",
          ],
        }
      `);
    });

    test("default", () => {
      expect(
        runWithErrorsArray(array(number, { mode: { default: 0 } }), [1, "2", 3])
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Array [
            1,
            0,
            3,
          ],
          "errors": Array [
            At root[1]:
        Expected a number
        Got: "2",
          ],
        }
      `);
    });
  });
});

describe("record", () => {
  test("Basic", () => {
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
      Expected one of these variants: ["0", "1"]
      Got: "2"
    `);
  });

  test("Keys to regex", () => {
    const decoder = map(record(string), (items) =>
      Object.entries(items).map(
        ([key, value]) => [RegExp(key, "u"), value] as const
      )
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
      `"Invalid regular expression: /\\\\d{4}:\\\\d{2/: Incomplete quantifier"`
    );

    expect(run(autoFields({ regexes: decoder }), { regexes: bad }))
      .toMatchInlineSnapshot(`
      At root["regexes"]:
      Invalid regular expression: /\\d{4}:\\d{2/: Incomplete quantifier
    `);
  });

  test("ignores __proto__", () => {
    expect(
      run(record(number), JSON.parse(`{"a": 1, "__proto__": 2, "b": 3}`))
    ).toStrictEqual({ a: 1, b: 3 });
  });

  describe("allow", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"object" | "array" | "object/array" | undefined'.
    record(number, { allow: "nope" });

    test("allows only objects by default", () => {
      expect(run(record(number), { a: 0 })).toStrictEqual({ a: 0 });
      expect(run(record(number, { allow: "object" }), { a: 0 })).toStrictEqual({
        a: 0,
      });
      expect(run(record(number), new Int32Array(2))).toStrictEqual({
        0: 0,
        1: 0,
      });
      expect(run(record(number), [1])).toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: [1]
      `);
    });

    test("allow only arrays", () => {
      expect(run(record(number, { allow: "array" }), [1])).toStrictEqual({
        0: 1,
      });
      expect(run(record(number, { allow: "array" }), new Int32Array(2)))
        .toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: Int32Array
      `);
      expect(run(record(number, { allow: "array" }), {}))
        .toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: {}
      `);
    });

    test("allow both", () => {
      expect(
        run(record(number, { allow: "object/array" }), [1])
      ).toStrictEqual({ 0: 1 });
      expect(
        run(record(number, { allow: "object/array" }), new Int32Array(2))
      ).toStrictEqual({ 0: 0, 1: 0 });
      expect(run(record(number, { allow: "object/array" }), {})).toStrictEqual(
        {}
      );
    });
  });

  describe("mode", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"skip" | "throw" | { default: never; } | undefined'.
    record(number, { mode: "nope" });

    test("throw", () => {
      expect(runWithErrorsArray(record(number), { a: 1, b: "2", c: 3 }))
        .toMatchInlineSnapshot(`
        At root["b"]:
        Expected a number
        Got: "2"
      `);
      expect(
        runWithErrorsArray(record(number, { mode: "throw" }), {
          a: 1,
          b: "2",
          c: 3,
        })
      ).toMatchInlineSnapshot(`
        At root["b"]:
        Expected a number
        Got: "2"
      `);
    });

    test("skip", () => {
      expect(
        runWithErrorsArray(record(number, { mode: "skip" }), {
          a: 1,
          b: "2",
          c: 3,
        })
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Object {
            "a": 1,
            "c": 3,
          },
          "errors": Array [
            At root["b"]:
        Expected a number
        Got: "2",
          ],
        }
      `);
    });

    test("default", () => {
      expect(
        runWithErrorsArray(record(number, { mode: { default: 0 } }), {
          a: 1,
          b: "2",
          c: 3,
        })
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Object {
            "a": 1,
            "b": 0,
            "c": 3,
          },
          "errors": Array [
            At root["b"]:
        Expected a number
        Got: "2",
          ],
        }
      `);
    });
  });
});

describe("fields", () => {
  test("Basic", () => {
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
  });

  describe("allow", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"object" | "array" | "object/array" | undefined'.
    fields(() => undefined, { allow: "nope" });

    test("allows only objects by default", () => {
      expect(
        run(
          fields(() => 0),
          {}
        )
      ).toBe(0);
      expect(
        run(
          fields(() => 0, { allow: "object" }),
          { a: 0 }
        )
      ).toBe(0);
      expect(
        run(
          fields((field) => field(0, number)),
          new Int32Array(2)
        )
      ).toBe(0);
      expect(
        run(
          fields((field) => field(0, number)),
          [1]
        )
      ).toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: [1]
      `);
    });

    test("allow only arrays", () => {
      expect(
        run(
          fields((field) => field(0, number), { allow: "array" }),
          [1]
        )
      ).toBe(1);
      expect(
        run(
          fields((field) => field(0, number), { allow: "array" }),
          new Int32Array(2)
        )
      ).toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: Int32Array
      `);
      expect(
        run(
          fields((field) => field(0, number), { allow: "array" }),
          {}
        )
      ).toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: {}
      `);
    });

    test("allow both", () => {
      expect(
        run(
          fields((field) => field(0, number), { allow: "object/array" }),
          [1]
        )
      ).toBe(1);
      expect(
        run(
          fields((field) => field(0, number), { allow: "object/array" }),
          new Int32Array(2)
        )
      ).toBe(0);
      expect(
        run(
          fields((field) => field(0, number), { allow: "object/array" }),
          { "0": 1 }
        )
      ).toBe(1);
    });
  });

  describe("mode", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"throw" | { default: never; } | undefined'.
    fields((field) => field("test", number, { mode: "nope" }));

    test("throw", () => {
      expect(
        runWithErrorsArray(
          fields((field) => field("test", number)),
          { test: "2" }
        )
      ).toMatchInlineSnapshot(`
        At root["test"]:
        Expected a number
        Got: "2"
      `);
      expect(
        runWithErrorsArray(
          fields((field) => field("test", number, { mode: "throw" })),
          { test: "2" }
        )
      ).toMatchInlineSnapshot(`
        At root["test"]:
        Expected a number
        Got: "2"
      `);
    });

    test("default", () => {
      expect(
        runWithErrorsArray(
          fields((field) => field("test", number, { mode: { default: 0 } })),
          { test: "2" }
        )
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": 0,
          "errors": Array [
            At root["test"]:
        Expected a number
        Got: "2",
          ],
        }
      `);
    });
  });

  describe("exact", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"push" | "throw" | "allow extra" | undefined'.
    fields(() => undefined, { exact: "nope" });

    test("allows excess properties by default", () => {
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)]),
          { one: "a", two: true, three: 3, four: {} }
        )
      ).toStrictEqual(["a", true]);
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)], {
            exact: "allow extra",
          }),
          { one: "a", two: true, three: 3, four: {} }
        )
      ).toStrictEqual(["a", true]);
    });

    test("throw on excess properties", () => {
      expect(
        run(
          fields((field) => [field("one", string), field("two", boolean)], {
            exact: "throw",
          }),
          { one: "a", two: true, three: 3, four: {} }
        )
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: ["one", "two"]
        Found extra fields: ["three", "four"]
      `);
    });

    test("push error on excess properties", () => {
      expect(
        runWithErrorsArray(
          fields((field) => [field("one", string), field("two", boolean)], {
            exact: "push",
          }),
          { one: "a", two: true, three: 3, four: {} }
        )
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Array [
            "a",
            true,
          ],
          "errors": Array [
            At root:
        Expected only these fields: ["one", "two"]
        Found extra fields: ["three", "four"],
          ],
        }
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
        { exact: "throw" }
      );

      expect(
        run(userDecoder, {
          isAdmin: true,
          name: "John",
          access: [],
          age: 12,
        })
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: ["isAdmin", "name", "access"]
        Found extra fields: ["age"]
      `);

      expect(
        run(userDecoder, {
          isAdmin: false,
          name: "Jane",
          access: [],
          age: 12,
        })
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: ["isAdmin", "name"]
        Found extra fields: ["access", "age"]
      `);
    });
  });

  test("obj and errors", () => {
    const objInput = {};
    const errorsInput: Array<DecoderError> = [];
    const result = fields((_field, obj, errors) => {
      expect(obj).toBe(objInput);
      expect(errors).toBe(errorsInput);
      return 1;
    })(objInput, errorsInput);
    expect(result).toBe(1);
  });

  test("empty object", () => {
    const decoder = fields(() => 1, { exact: "throw" });
    expect(decoder({})).toBe(1);
    expect(run(decoder, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: []
      Found extra fields: ["a"]
    `);
  });
});

describe("autoFields", () => {
  test("Basic", () => {
    type Person = ReturnType<typeof personDecoder>;
    const personDecoder = autoFields({
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
  });

  describe("allow", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"object" | "array" | "object/array" | undefined'.
    autoFields({}, { allow: "nope" });

    test("allows only objects by default", () => {
      expect(run(autoFields({ a: number }), { a: 0 })).toStrictEqual({ a: 0 });
      expect(
        run(autoFields({ a: number }, { allow: "object" }), { a: 0 })
      ).toStrictEqual({ a: 0 });
      expect(run(autoFields({ 0: number }), new Int32Array(2))).toStrictEqual({
        0: 0,
      });
      expect(run(autoFields({ 0: number }), [1])).toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: [1]
      `);
    });

    test("allow only arrays", () => {
      expect(
        run(autoFields({ 0: number }, { allow: "array" }), [1])
      ).toStrictEqual({ 0: 1 });
      expect(
        run(autoFields({ 0: number }, { allow: "array" }), new Int32Array(2))
      ).toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: Int32Array
      `);
      expect(run(autoFields({ 0: number }, { allow: "array" }), {}))
        .toMatchInlineSnapshot(`
        At root:
        Expected an array
        Got: {}
      `);
    });

    test("allow both", () => {
      expect(
        run(autoFields({ 0: number }, { allow: "object/array" }), [1])
      ).toStrictEqual({ 0: 1 });
      expect(
        run(
          autoFields({ 0: number }, { allow: "object/array" }),
          new Int32Array(2)
        )
      ).toStrictEqual({ 0: 0 });
      expect(
        run(autoFields({ 0: number }, { allow: "object/array" }), { "0": 1 })
      ).toStrictEqual({ 0: 1 });
    });
  });

  describe("exact", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"push" | "throw" | "allow extra" | undefined'.
    autoFields({}, { exact: "nope" });

    test("allows excess properties by default", () => {
      expect(
        run(autoFields({ one: string, two: boolean }), {
          one: "a",
          two: true,
          three: 3,
          four: {},
        })
      ).toStrictEqual({ one: "a", two: true });
      expect(
        run(
          autoFields({ one: string, two: boolean }, { exact: "allow extra" }),
          { one: "a", two: true, three: 3, four: {} }
        )
      ).toStrictEqual({ one: "a", two: true });
    });

    test("throw on excess properties", () => {
      expect(
        run(autoFields({ one: string, two: boolean }, { exact: "throw" }), {
          one: "a",
          two: true,
          three: 3,
          four: {},
        })
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: ["one", "two"]
        Found extra fields: ["three", "four"]
      `);
    });

    test("push error on excess properties", () => {
      expect(
        runWithErrorsArray(
          autoFields({ one: string, two: boolean }, { exact: "push" }),
          {
            one: "a",
            two: true,
            three: 3,
            four: {},
          }
        )
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Object {
            "one": "a",
            "two": true,
          },
          "errors": Array [
            At root:
        Expected only these fields: ["one", "two"]
        Found extra fields: ["three", "four"],
          ],
        }
      `);
    });
  });

  test("__proto__ is not allowed", () => {
    // @ts-expect-error Type '(value: unknown) => string' is not assignable to type 'never'.
    const decoder = autoFields({ a: number, __proto__: string, b: number });
    expect(
      run(decoder, JSON.parse(`{"a": 1, "__proto__": "a", "b": 3}`))
    ).toStrictEqual({ a: 1, b: 3 });
  });

  test("empty object", () => {
    const decoder = autoFields({}, { exact: "throw" });
    expect(decoder({})).toStrictEqual({});
    expect(run(decoder, { a: 1 })).toMatchInlineSnapshot(`
      At root:
      Expected only these fields: []
      Found extra fields: ["a"]
    `);
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
  });

  test("1 item", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number]);

    expectType<TypeEqual<Type, [number]>>(true);
    expectType<Type>(decoder([1]));

    expect(decoder([1])).toStrictEqual([1]);

    expect(run(decoder, [])).toMatchInlineSnapshot(`
      At root[0]:
      Expected a number
      Got: undefined
    `);
  });

  test("2 items", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string]);

    expectType<TypeEqual<Type, [number, string]>>(true);
    expectType<Type>(decoder([1, "a"]));

    expect(decoder([1, "a"])).toStrictEqual([1, "a"]);

    expect(run(decoder, [1])).toMatchInlineSnapshot(`
      At root[1]:
      Expected a string
      Got: undefined
    `);

    expect(run(decoder, ["a", 1])).toMatchInlineSnapshot(`
      At root[0]:
      Expected a number
      Got: "a"
    `);
  });

  test("3 items", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string, boolean]);

    expectType<TypeEqual<Type, [number, string, boolean]>>(true);
    expectType<Type>(decoder([1, "a", true]));

    expect(decoder([1, "a", true])).toStrictEqual([1, "a", true]);

    expect(run(decoder, [1, "a"])).toMatchInlineSnapshot(`
      At root[2]:
      Expected a boolean
      Got: undefined
    `);
  });

  test("4 items", () => {
    type Type = ReturnType<typeof decoder>;
    const decoder = tuple([number, string, boolean, number]);

    expectType<TypeEqual<Type, [number, string, boolean, number]>>(true);
    expectType<Type>(decoder([1, "a", true, 2]));

    expect(decoder([1, "a", true, 2])).toStrictEqual([1, "a", true, 2]);

    expect(run(decoder, [1, "a", true])).toMatchInlineSnapshot(`
      At root[3]:
      Expected a number
      Got: undefined
    `);
  });

  describe("allow", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"object" | "array" | "object/array" | undefined'.
    tuple([], { allow: "nope" });

    test("allows only arrays by default", () => {
      expect(run(tuple([number]), [0])).toStrictEqual([0]);
      expect(run(tuple([number], { allow: "array" }), [0])).toStrictEqual([0]);
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

    test("allow only objects", () => {
      expect(
        run(tuple([number], { allow: "object" }), { length: 1, 0: 1 })
      ).toStrictEqual([1]);
      expect(
        run(tuple([number], { allow: "object" }), new Int32Array(2))
      ).toStrictEqual([0]);
      expect(run(tuple([number], { allow: "object" }), []))
        .toMatchInlineSnapshot(`
        At root:
        Expected an object
        Got: []
      `);
    });

    test("allow both", () => {
      expect(
        run(tuple([number], { allow: "object/array" }), { length: 1, 0: 1 })
      ).toStrictEqual([1]);
      expect(
        run(tuple([number], { allow: "object/array" }), new Int32Array(2))
      ).toStrictEqual([0]);
      expect(
        run(tuple([number], { allow: "object/array" }), [1])
      ).toStrictEqual([1]);
    });
  });

  describe("exact", () => {
    // @ts-expect-error Type '"nope"' is not assignable to type '"push" | "throw" | "allow extra" | undefined'.
    tuple([], { exact: "nope" });

    test("allows excess items by default", () => {
      expect(run(tuple([string, boolean]), ["a", true, 3, {}])).toStrictEqual([
        "a",
        true,
      ]);
      expect(
        run(tuple([string, boolean], { exact: "allow extra" }), [
          "a",
          true,
          3,
          {},
        ])
      ).toStrictEqual(["a", true]);
    });

    test("throw on excess items", () => {
      expect(
        run(tuple([string, boolean], { exact: "throw" }), ["a", true, 3, {}])
      ).toMatchInlineSnapshot(`
        At root:
        Expected only these fields: ["0", "1"]
        Found extra fields: ["2", "3"]
      `);
    });

    test("push error on excess items", () => {
      expect(
        runWithErrorsArray(tuple([string, boolean], { exact: "push" }), [
          "a",
          true,
          3,
          {},
        ])
      ).toMatchInlineSnapshot(`
        Object {
          "decoded": Array [
            "a",
            true,
          ],
          "errors": Array [
            At root:
        Expected only these fields: ["0", "1"]
        Found extra fields: ["2", "3"],
          ],
        }
      `);
    });
  });
});

describe("fieldsUnion", () => {
  test("Basic", () => {
    type Shape = ReturnType<typeof shapeDecoder>;
    const shapeDecoder = fieldsUnion("tag", {
      Circle: autoFields({
        tag: constant("Circle"),
        radius: number,
      }),
      Rectangle: fields((field) => ({
        tag: "Rectangle" as const,
        width: field("width", number),
        height: field("height", number),
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
      At root["width"]:
      Expected a number
      Got: undefined
    `);

    expect(run(shapeDecoder, { tag: "Square", size: 5 }))
      .toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags: ["Circle", "Rectangle"]
      Got: "Square"
    `);
  });

  test("Empty object is not allowed", () => {
    // @ts-expect-error Argument of type '{}' is not assignable to parameter of type '"fieldsUnion must have at least one member"'.
    const emptyDecoder = fieldsUnion("tag", {});
    // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'Record<string, Decoder<unknown, unknown>>'.
    fieldsUnion("tag", "fieldsUnion must have at least one member");
    expectType<TypeEqual<ReturnType<typeof emptyDecoder>, never>>(true);
    expect(run(emptyDecoder, { tag: "test" })).toMatchInlineSnapshot(`
      At root["tag"]:
      Expected one of these tags: []
      Got: "test"
    `);
  });

  test("Keys must be strings", () => {
    const innerDecoder = autoFields({ tag: constant("1") });
    // @ts-expect-error Type 'Decoder<{ 1: string; }, unknown>' is not assignable to type '"fieldsUnion keys must be strings, not numbers!"'.
    fieldsUnion("tag", { 1: innerDecoder });
    // @ts-expect-error Type 'string' is not assignable to type 'Decoder<unknown, unknown>'.
    fieldsUnion("tag", { 1: "fieldsUnion keys must be strings, not numbers!" });
    const goodDecoder = fieldsUnion("tag", { "1": innerDecoder });
    expectType<TypeEqual<ReturnType<typeof goodDecoder>, { tag: "1" }>>(true);
    expect(goodDecoder({ tag: "1" })).toStrictEqual({ tag: "1" });
  });
});

// test("deep", () => {
//   const decoder = deep(
//     ["store", "products", 1, "accessories", 0, "price"],
//     number
//   );

//   expect(deep([], boolean)(true)).toMatchInlineSnapshot(`true`);
//   expect(
//     decoder({
//       store: { products: [{}, { accessories: [{ price: 123 }] }] },
//     })
//   ).toMatchInlineSnapshot(`123`);

//   expect(() => decoder(null)).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: null"
//   `);
//   expect(() => decoder([])).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: []"
//   `);
//   expect(() => decoder({})).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: undefined"
//   `);
//   expect(() => decoder({ store: {} })).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an array
//     Got: undefined"
//   `);
//   expect(() => decoder({ store: { products: [{}] } }))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: undefined"
//   `);
//   expect(() =>
//     decoder({ store: { products: [{}, { accessories: [{ price: null }] }] } })
//   ).toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: null"
//   `);
// });

// test("optional", () => {
//   expect(optional(number)(undefined)).toMatchInlineSnapshot(`undefined`);
//   // expect(optional(number)(null)).toMatchInlineSnapshot(`undefined`);
//   expect(optional(number)(0)).toMatchInlineSnapshot(`0`);
//   expect(
//     fields((field) => field("missing", optional(string)))({})
//   ).toMatchInlineSnapshot(`undefined`);
//   expect(
//     fields((field) => field("present", optional(string)))({ present: "string" })
//   ).toMatchInlineSnapshot(`"string"`);
//   expect(optional(number, 5)(undefined)).toMatchInlineSnapshot(`5`);
//   expect(optional(number, "5")(undefined)).toMatchInlineSnapshot(`"5"`);
//   expect(optional(number, null)(undefined)).toMatchInlineSnapshot(`null`);

//   expect(() => optional(number)("string")).toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: string"
//   `);
//   expect(() => optional(fields((field) => field("missing", string)))({}))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a string
//     Got: undefined"
//   `);
// });

// test("map", () => {
//   expect(map(number, Math.round)(4.9)).toMatchInlineSnapshot(`5`);
//   expect(map(array(number), (arr) => new Set(arr))([1, 2, 1]))
//     .toMatchInlineSnapshot(`
//       Set {
//         1,
//         2,
//       }
//     `);

//   expect(() => map(number, string)(0)).toThrowErrorMatchingInlineSnapshot(`
//     "Expected a string
//     Got: number"
//   `);
//   expect(() => map(number, string)("string"))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: string"
//   `);
// });

// test("multi", () => {
//   expect(multi({ string, number })("string")).toMatchInlineSnapshot(`"string"`);
//   expect(multi({ string, number })(0)).toMatchInlineSnapshot(`0`);
//   expect(multi({ string, number, boolean })(true)).toMatchInlineSnapshot(
//     `true`
//   );
//   expect(multi({ string, number, boolean })(false)).toMatchInlineSnapshot(
//     `false`
//   );

//   expect(thrownError(() => multi({ string, number })(true)))
//     .toMatchInlineSnapshot(`
//     "Expected one of these types: [\\"string\\", \\"number\\"]
//     Got: boolean"
//   `);
//   expect(thrownError(() => multi({ string, number, boolean })(null)))
//     .toMatchInlineSnapshot(`
//     "Expected one of these types: [\\"string\\", \\"number\\", \\"boolean\\"]
//     Got: null"
//   `);
//   expect(thrownError(() => multi({ string, number, boolean })(null)))
//     .toMatchInlineSnapshot(`
//     "Expected one of these types: [\\"string\\", \\"number\\", \\"boolean\\"]
//     Got: null"
//   `);
//   expect(
//     thrownError(() =>
//       multi({ object: autoFields({ a: number }), string })({ a: true })
//     )
//   ).toMatchInlineSnapshot(`
//     "Expected a number
//     Got: boolean"
//   `);
// });

// test("lazy", () => {
//   expect(lazy(() => string)("string")).toMatchInlineSnapshot(`"string"`);

//   type NestedArray = Array<NestedArray | number>;
//   const decodeNestedNumber: Decoder<NestedArray> = array(
//     multi({
//       number,
//       array: lazy(() => decodeNestedNumber),
//     })
//   );
//   expect(decodeNestedNumber([[[[[[[1337]]]]]]])).toMatchInlineSnapshot(`
//     Array [
//       Array [
//         Array [
//           Array [
//             Array [
//               Array [
//                 Array [
//                   1337,
//                 ],
//               ],
//             ],
//           ],
//         ],
//       ],
//     ]
//   `);

//   expect(thrownError(() => decodeNestedNumber([[[["nope"]]]])))
//     .toMatchInlineSnapshot(`
//     "Expected one of these types: [\\"number\\", \\"array\\"]
//     Got: string"
//   `);
// });

// test("all decoders pass down errors", () => {
//   const subDecoder: Decoder<boolean | null> = fields((field) =>
//     field("test", boolean, { mode: { default: null } })
//   );

//   const decoder = fields((field) => ({
//     boolean: field("boolean", boolean, { mode: { default: undefined } }),
//     number: field("number", number, { mode: { default: undefined } }),
//     string: field("string", string, { mode: { default: undefined } }),
//     constant: field("constant", constant(1), { mode: { default: undefined } }),
//     array: field("array", array(subDecoder), { mode: { default: undefined } }),
//     dict: field("dict", record(subDecoder), { mode: { default: undefined } }),
//     record: field(
//       "record",
//       fields((field2) => field2("field", subDecoder)),
//       {
//         mode: { default: undefined },
//       }
//     ),
//     tuple: field(
//       "tuple",
//       fields((field2) => field2(0, subDecoder)),
//       {
//         mode: { default: undefined },
//       }
//     ),
//     pair1: field("pair1", tuple([subDecoder, boolean]), {
//       mode: { default: undefined },
//     }),
//     pair2: field("pair2", tuple([boolean, subDecoder]), {
//       mode: { default: undefined },
//     }),
//     triple1: field("triple1", tuple([subDecoder, boolean, boolean]), {
//       mode: { default: undefined },
//     }),
//     triple2: field("triple2", tuple([boolean, subDecoder, boolean]), {
//       mode: { default: undefined },
//     }),
//     triple3: field("triple3", tuple([boolean, boolean, subDecoder]), {
//       mode: { default: undefined },
//     }),
//     autoFields: field("autoFields", autoFields({ field: subDecoder }), {
//       mode: { default: undefined },
//     }),
//     deep: field("deep", deep(["field", 0], subDecoder), {
//       mode: { default: undefined },
//     }),
//     optional: field("optional", optional(subDecoder), {
//       mode: { default: undefined },
//     }),
//     map1: field("map1", map(subDecoder, constant(null)), {
//       mode: { default: undefined },
//     }),
//     map2: field(
//       "map2",
//       map((value) => value, subDecoder),
//       {
//         mode: { default: undefined },
//       }
//     ),
//     either1: field("either1", multi({ boolean, object: subDecoder }), {
//       mode: { default: undefined },
//     }),
//     either2: field("either2", multi({ object: subDecoder, boolean }), {
//       mode: { default: undefined },
//     }),
//     lazy: field(
//       "lazy",
//       lazy(() => subDecoder),
//       { mode: { default: undefined } }
//     ),
//   }));

//   const subData: unknown = { test: 0 };

//   const data: unknown = {
//     boolean: 0,
//     number: false,
//     string: false,
//     constant: false,
//     array: [subData],
//     dict: { key: subData },
//     record: { field: subData },
//     tuple: [subData],
//     pair1: [subData, true],
//     pair2: [true, subData],
//     triple1: [subData, true, true],
//     triple2: [true, subData, true],
//     triple3: [true, true, subData],
//     autoFields: { field: subData },
//     deep: { field: [subData] },
//     optional: subData,
//     map1: subData,
//     map2: subData,
//     either1: subData,
//     either2: subData,
//     lazy: subData,
//   };

//   expect(testWithErrorsArray({ decoder, data })).toMatchInlineSnapshot(`
//     Object {
//       "decoded": Object {
//         "array": Array [
//           null,
//         ],
//         "autoFields": Object {
//           "field": null,
//         },
//         "boolean": undefined,
//         "constant": undefined,
//         "deep": null,
//         "dict": Object {
//           "key": null,
//         },
//         "either1": null,
//         "either2": null,
//         "lazy": null,
//         "map1": null,
//         "map2": null,
//         "number": undefined,
//         "optional": null,
//         "pair1": Array [
//           null,
//           true,
//         ],
//         "pair2": Array [
//           true,
//           null,
//         ],
//         "record": null,
//         "string": undefined,
//         "triple1": Array [
//           null,
//           true,
//           true,
//         ],
//         "triple2": Array [
//           true,
//           null,
//           true,
//         ],
//         "triple3": Array [
//           true,
//           true,
//           null,
//         ],
//         "tuple": undefined,
//       },
//       "errors": Array [
//         "At root[\\"boolean\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"number\\"]:
//     Expected a number
//     Got: false",
//         "At root[\\"string\\"]:
//     Expected a string
//     Got: false",
//         "At root[\\"constant\\"]:
//     Expected the value 1
//     Got: false",
//         "At root[\\"array\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"dict\\"][\\"key\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"record\\"][\\"field\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"tuple\\"]:
//     Expected an object
//     Got: [Object(1)]",
//         "At root[\\"pair1\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"pair2\\"][1][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"triple1\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"triple2\\"][1][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"triple3\\"][2][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"autoFields\\"][\\"field\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"deep\\"][\\"field\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"optional\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"map1\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"map2\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"either1\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"either2\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//         "At root[\\"lazy\\"][\\"test\\"]:
//     Expected a boolean
//     Got: 0",
//       ],
//       "shortErrors": Array [
//         "At root[\\"boolean\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"number\\"]:
//     Expected a number
//     Got: boolean",
//         "At root[\\"string\\"]:
//     Expected a string
//     Got: boolean",
//         "At root[\\"constant\\"]:
//     Expected the value 1
//     Got: boolean",
//         "At root[\\"array\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"dict\\"][\\"key\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"record\\"][\\"field\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"tuple\\"]:
//     Expected an object
//     Got: [Object(1)]",
//         "At root[\\"pair1\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"pair2\\"][1][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"triple1\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"triple2\\"][1][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"triple3\\"][2][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"autoFields\\"][\\"field\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"deep\\"][\\"field\\"][0][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"optional\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"map1\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"map2\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"either1\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"either2\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//         "At root[\\"lazy\\"][\\"test\\"]:
//     Expected a boolean
//     Got: number",
//       ],
//     }
//   `);
// });
