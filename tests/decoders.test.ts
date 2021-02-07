import { expectType, TypeEqual } from "ts-expect";

// TODO: Test all of them!
import {
  array,
  // autoFields,
  boolean,
  constant,
  Decoder,
  DecoderError,
  // deep,
  // fields,
  // fieldsUnion,
  // formatDecoderErrorVariant,
  // lazy,
  // map,
  // multi,
  // nullable,
  number,
  // optional,
  // optionalNullable,
  // record,
  repr,
  string,
  stringUnion,
  // tuple,
} from "../";

function run<T>(decoder: Decoder<T>, value: unknown): T | string {
  try {
    return decoder(value);
  } catch (error) {
    return error instanceof DecoderError
      ? error.format()
      : "Not a DecoderError";
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
    typeof value === "string" && value.includes("Expected"),
  print: String,
});

test("boolean", () => {
  expect(boolean(true)).toBe(true);
  expect(boolean(false)).toBe(false);

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

  expect(run(number, undefined)).toMatchInlineSnapshot(`
    At root:
    Expected a number
    Got: undefined
  `);
});

test("string", () => {
  expect(string("")).toBe("");
  expect(string("string")).toBe("string");

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

    test("allow only object", () => {
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
    test("throw", () => {
      expect(runWithErrorsArray(array(number), [1, "2", 3]))
        .toMatchInlineSnapshot(`
        At root[1]:
        Expected a number
        Got: "2"
      `);
      expect(runWithErrorsArray(array(number, { mode: "throw" }), [1, "2"]))
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

// test("record", () => {
//   expect(record(string)({})).toMatchInlineSnapshot(`Object {}`);
//   expect(record(string)({ a: "string" })).toMatchInlineSnapshot(`
//     Object {
//       "a": "string",
//     }
//   `);
//   expect(record(string, { allow: "array" })([])).toMatchInlineSnapshot(
//     `Object {}`
//   );

//   expect(() => record(string)(null)).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: null"
//   `);
//   expect(() => record(string)({ a: "a", b: 0 }))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a string
//     Got: number"
//   `);
//   expect(() => record(string)({ '"), "key": "other value"': 1 }))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a string
//     Got: number"
//   `);

//   expect(
//     testWithErrorsArray({
//       decoder: record(number, { mode: "skip" }),
//       data: { a: 1, b: "2", c: 3 },
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "decoded": Object {
//         "a": 1,
//         "c": 3,
//       },
//       "errors": Array [
//         "At root[\\"b\\"]:
//     Expected a number
//     Got: \\"2\\"",
//       ],
//       "shortErrors": Array [
//         "At root[\\"b\\"]:
//     Expected a number
//     Got: string",
//       ],
//     }
//   `);

//   expect(
//     testWithErrorsArray({
//       decoder: record(number, { mode: { default: 0 } }),
//       data: { a: 1, b: "2", c: 3 },
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "decoded": Object {
//         "a": 1,
//         "b": 0,
//         "c": 3,
//       },
//       "errors": Array [
//         "At root[\\"b\\"]:
//     Expected a number
//     Got: \\"2\\"",
//       ],
//       "shortErrors": Array [
//         "At root[\\"b\\"]:
//     Expected a number
//     Got: string",
//       ],
//     }
//   `);
// });

// test("fields object", () => {
//   expect(fields(() => ({}))({})).toMatchInlineSnapshot(`Object {}`);
//   expect(
//     fields((field) => ({
//       first: field("first", boolean),
//       second: field("last", constant("renamed")),
//     }))({
//       first: true,
//       last: "renamed",
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "first": true,
//       "second": "renamed",
//     }
//   `);

//   expect(() => fields(() => "")("string")).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: string"
//   `);
//   expect(() => fields((field) => ({ a: field("missing", boolean) }))({}))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a boolean
//     Got: undefined"
//   `);
// });

// test("fields array", () => {
//   expect(fields(() => [], { allow: "array" })([])).toMatchInlineSnapshot(
//     `Array []`
//   );
//   expect(
//     fields(
//       (field) => ({
//         first: field(0, boolean),
//         second: field(1, constant("renamed")),
//       }),
//       { allow: "object/array" }
//     )([true, "renamed"])
//   ).toMatchInlineSnapshot(`
//     Object {
//       "first": true,
//       "second": "renamed",
//     }
//   `);

//   expect(() =>
//     fields((field) => [field(99, boolean)], { allow: "object/array" })([])
//   ).toThrowErrorMatchingInlineSnapshot(`
//     "Expected a boolean
//     Got: undefined"
//   `);
// });

// test("fields field object", () => {
//   expect(fields((field) => field("a", number))({ a: 1 })).toMatchInlineSnapshot(
//     `1`
//   );
//   expect(
//     fields((field) => field("size", number))(new Set([1, 2]))
//   ).toMatchInlineSnapshot(`2`);

//   expect(() => fields((field) => field("a", number))(null))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: null"
//   `);
//   expect(() => fields((field) => field("a", number))([]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: []"
//   `);
//   expect(() => fields((field) => field("a", number))({}))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: undefined"
//   `);
//   expect(() => fields((field) => field("a", number))({ a: null }))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: null"
//   `);
//   expect(() => fields((field) => field("hasOwnProperty", number))({}))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: function \\"hasOwnProperty\\""
//   `);

//   expect(
//     testWithErrorsArray({
//       decoder: fields((field) => ({
//         a: field("a", number, { mode: { default: 0 } }),
//       })),
//       data: { a: "1" },
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "decoded": Object {
//         "a": 0,
//       },
//       "errors": Array [
//         "At root[\\"a\\"]:
//     Expected a number
//     Got: \\"1\\"",
//       ],
//       "shortErrors": Array [
//         "At root[\\"a\\"]:
//     Expected a number
//     Got: string",
//       ],
//     }
//   `);
// });

// test("fields field array", () => {
//   expect(() => fields((field) => field(0, number), { allow: "array" })([]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: undefined"
//   `);
//   expect(() => fields((field) => field(0, number), { allow: "array" })([true]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: boolean"
//   `);
//   expect(() => fields((field) => field(-1, number), { allow: "array" })([]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: undefined"
//   `);
//   expect(() => fields((field) => field(1, number), { allow: "array" })([1]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: undefined"
//   `);
//   expect(
//     fields((field) => field("length", number), { allow: "array" })([
//       true,
//       false,
//     ])
//   ).toMatchInlineSnapshot(`2`);

//   expect(
//     testWithErrorsArray({
//       decoder: fields((field) => [field(0, number, { mode: { default: 0 } })], {
//         allow: "object/array",
//       }),
//       data: ["1"],
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "decoded": Array [
//         0,
//       ],
//       "errors": Array [
//         "At root[0]:
//     Expected a number
//     Got: \\"1\\"",
//       ],
//       "shortErrors": Array [
//         "At root[0]:
//     Expected a number
//     Got: string",
//       ],
//     }
//   `);
// });

// test("fields obj and errors", () => {
//   const objInput = {};
//   const errorsInput: Array<DecoderError> = [];
//   const result = fields((_field, obj, errors) => {
//     expect(obj).toBe(objInput);
//     expect(errors).toBe(errorsInput);
//     return 1;
//   })(objInput, errorsInput);
//   expect(result).toBe(1);
// });

// test("autoFields", () => {
//   expect(autoFields({})({})).toMatchInlineSnapshot(`Object {}`);
//   expect(autoFields({}, { allow: "array" })([])).toMatchInlineSnapshot(
//     `Object {}`
//   );
//   expect(
//     autoFields({
//       first: boolean,
//       last: constant("not renamed"),
//     })({
//       first: true,
//       last: "not renamed",
//     })
//   ).toMatchInlineSnapshot(`
//     Object {
//       "first": true,
//       "last": "not renamed",
//     }
//   `);
//   expect(autoFields({ "0": string }, { allow: "array" })(["a"]))
//     .toMatchInlineSnapshot(`
//     Object {
//       "0": "a",
//     }
//   `);

//   expect(() => autoFields({})(null)).toThrowErrorMatchingInlineSnapshot(`
//     "Expected an object
//     Got: null"
//   `);
//   expect(() => autoFields({ a: boolean })({}))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a boolean
//     Got: undefined"
//   `);
// });

// test("tuple", () => {
//   expect(tuple([string, number])(["", 0])).toMatchInlineSnapshot(`
//     Array [
//       "",
//       0,
//     ]
//   `);
//   expect(tuple([string, number])(["", 0, true])).toMatchInlineSnapshot(`
//     Array [
//       "",
//       0,
//     ]
//   `);
//   expect(tuple([string, number], { allow: "object" })({ "0": "", "1": 0 }))
//     .toMatchInlineSnapshot(`
//     Array [
//       "",
//       0,
//     ]
//   `);
//   expect(() => tuple([string, number])(undefined))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected an array
//     Got: undefined"
//   `);
//   expect(() => tuple([string, number])([])).toThrowErrorMatchingInlineSnapshot(`
//     "Expected a string
//     Got: undefined"
//   `);
//   expect(() => tuple([string, number])([""]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: undefined"
//   `);
//   expect(() => tuple([string, number])(["", ""]))
//     .toThrowErrorMatchingInlineSnapshot(`
//     "Expected a number
//     Got: string"
//   `);

//   expect(tuple([string, number, boolean])(["", 0, true]))
//     .toMatchInlineSnapshot(`
//     Array [
//       "",
//       0,
//       true,
//     ]
//   `);

//   expect(tuple([number, number, tuple([string, string])])([1, 1, ["a", "b"]]))
//     .toMatchInlineSnapshot(`
//       Array [
//         1,
//         1,
//         Array [
//           "a",
//           "b",
//         ],
//       ]
//     `);
// });

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
