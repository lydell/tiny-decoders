// @flow strict

import {
  type Decoder,
  array,
  autoRecord,
  boolean,
  constant,
  deep,
  dict,
  either,
  lazy,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  pair,
  record,
  repr,
  string,
  triple,
  tuple,
} from "../src";

beforeEach(() => {
  repr.sensitive = false;
});

function testWithErrorsArray<T>({
  decoder,
  data,
}: {
  decoder: Decoder<T>,
  data: mixed,
}): { decoded: T, errors: Array<string>, shortErrors: Array<string> } {
  const errors = [];
  const decoded = decoder(data);
  expect(decoder(data, errors)).toEqual(decoded);

  const shortErrors = [];
  repr.sensitive = true;
  const decoded2 = decoder(data, shortErrors);
  repr.sensitive = false;
  expect(decoded2).toEqual(decoded);

  return { decoded, errors, shortErrors };
}

test("boolean", () => {
  expect(boolean(true)).toMatchInlineSnapshot(`true`);
  expect(boolean(false)).toMatchInlineSnapshot(`false`);

  expect(() => boolean(0)).toThrowErrorMatchingInlineSnapshot(
    `Expected a boolean, but got: 0`
  );
});

test("number", () => {
  expect(number(0)).toMatchInlineSnapshot(`0`);
  expect(number(Math.PI)).toMatchInlineSnapshot(`3.141592653589793`);
  expect(number(NaN)).toMatchInlineSnapshot(`NaN`);
  expect(number(Infinity)).toMatchInlineSnapshot(`Infinity`);
  expect(number(-Infinity)).toMatchInlineSnapshot(`-Infinity`);

  expect(() => number(undefined)).toThrowErrorMatchingInlineSnapshot(
    `Expected a number, but got: undefined`
  );
});

test("string", () => {
  expect(string("")).toMatchInlineSnapshot(`""`);
  expect(string("string")).toMatchInlineSnapshot(`"string"`);

  expect(() => string(Symbol("desc"))).toThrowErrorMatchingInlineSnapshot(
    `Expected a string, but got: Symbol(desc)`
  );
});

test("mixedArray", () => {
  expect(mixedArray([])).toMatchInlineSnapshot(`Array []`);
  expect(mixedArray([1])).toMatchInlineSnapshot(`
    Array [
      1,
    ]
  `);
  expect(mixedArray([1, "", {}, Symbol("desc")])).toMatchInlineSnapshot(`
    Array [
      1,
      "",
      Object {},
      Symbol(desc),
    ]
  `);

  expect(() =>
    mixedArray({ length: 1, "0": 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: {"0": 1, "length": 1}`
  );
});

test("mixedDict", () => {
  expect(mixedDict({})).toMatchInlineSnapshot(`Object {}`);
  expect(mixedDict({ a: 1 })).toMatchInlineSnapshot(`
    Object {
      "a": 1,
    }
  `);
  expect(mixedDict({ a: 1, b: "", c: {}, d: Symbol("desc") }))
    .toMatchInlineSnapshot(`
      Object {
        "a": 1,
        "b": "",
        "c": Object {},
        "d": Symbol(desc),
      }
    `);

  expect(() => mixedDict(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => mixedDict([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  // eslint-disable-next-line no-empty-function
  expect(() => mixedDict(() => {})).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: function ""`
  );
});

test("constant", () => {
  expect(constant(undefined)(undefined)).toMatchInlineSnapshot(`undefined`);
  expect(constant(null)(null)).toMatchInlineSnapshot(`null`);
  expect(constant(true)(true)).toMatchInlineSnapshot(`true`);
  expect(constant(false)(false)).toMatchInlineSnapshot(`false`);
  expect(constant(0)(0)).toMatchInlineSnapshot(`0`);
  expect(constant(-1.5)(-1.5)).toMatchInlineSnapshot(`-1.5`);
  expect(constant("")("")).toMatchInlineSnapshot(`""`);
  expect(constant("string")("string")).toMatchInlineSnapshot(`"string"`);

  // `NaN !== NaN`. Not the best error message. Maybe we should use `Object.is`
  // in the future.
  expect(() => constant(NaN)(NaN)).toThrowErrorMatchingInlineSnapshot(
    `Expected the value NaN, but got: NaN`
  );
});

test("array", () => {
  expect(array(number)([])).toMatchInlineSnapshot(`Array []`);
  expect(array(number)([1])).toMatchInlineSnapshot(`
    Array [
      1,
    ]
  `);

  expect(() =>
    array(number)({ length: 1, "0": 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: {"0": 1, "length": 1}`
  );
  expect(() => array(number)([1, "2"])).toThrowErrorMatchingInlineSnapshot(
    `array[1]: Expected a number, but got: "2"`
  );

  expect(
    testWithErrorsArray({
      decoder: array(number, "skip"),
      data: [1, "2", 3],
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Array [
        1,
        3,
      ],
      "errors": Array [
        array[1]: Expected a number, but got: "2",
      ],
      "shortErrors": Array [
        array[1]: Expected a number, but got: string,
      ],
    }
  `);

  expect(
    testWithErrorsArray({
      decoder: array(number, { default: 0 }),
      data: [1, "2", 3],
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Array [
        1,
        0,
        3,
      ],
      "errors": Array [
        array[1]: Expected a number, but got: "2",
      ],
      "shortErrors": Array [
        array[1]: Expected a number, but got: string,
      ],
    }
  `);
});

test("dict", () => {
  expect(dict(string)({})).toMatchInlineSnapshot(`Object {}`);
  expect(dict(string)({ a: "string" })).toMatchInlineSnapshot(`
    Object {
      "a": "string",
    }
  `);

  expect(() => dict(string)(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => dict(string)([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  expect(() =>
    dict(string)({ a: "a", b: 0 })
  ).toThrowErrorMatchingInlineSnapshot(
    `object["b"]: Expected a string, but got: 0`
  );
  expect(() =>
    dict(string)({ '"), "key": "other value"': 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `object["\\"), \\"key\\": \\"other value\\""]: Expected a string, but got: 1`
  );

  expect(
    testWithErrorsArray({
      decoder: dict(number, "skip"),
      data: { a: 1, b: "2", c: 3 },
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Object {
        "a": 1,
        "c": 3,
      },
      "errors": Array [
        object["b"]: Expected a number, but got: "2",
      ],
      "shortErrors": Array [
        object["b"]: Expected a number, but got: string,
      ],
    }
  `);

  expect(
    testWithErrorsArray({
      decoder: dict(number, { default: 0 }),
      data: { a: 1, b: "2", c: 3 },
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Object {
        "a": 1,
        "b": 0,
        "c": 3,
      },
      "errors": Array [
        object["b"]: Expected a number, but got: "2",
      ],
      "shortErrors": Array [
        object["b"]: Expected a number, but got: string,
      ],
    }
  `);
});

test("record", () => {
  expect(record(() => ({}))({})).toMatchInlineSnapshot(`Object {}`);
  expect(
    record((field) => ({
      first: field("first", boolean),
      second: field("last", constant("renamed")),
    }))({
      first: true,
      last: "renamed",
    })
  ).toMatchInlineSnapshot(`
    Object {
      "first": true,
      "second": "renamed",
    }
  `);

  expect(() => record(() => "")("string")).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: "string"`
  );
  expect(() =>
    record((field) => ({ a: field("missing", boolean) }))({})
  ).toThrowErrorMatchingInlineSnapshot(
    `object["missing"] (missing): Expected a boolean, but got: undefined`
  );
});

test("record field", () => {
  expect(record((field) => field("a", number))({ a: 1 })).toMatchInlineSnapshot(
    `1`
  );
  expect(
    record((field) => field("size", number))(new Set([1, 2]))
  ).toMatchInlineSnapshot(`2`);

  expect(() =>
    record((field) => field("a", number))(null)
  ).toThrowErrorMatchingInlineSnapshot(`Expected an object, but got: null`);
  expect(() =>
    record((field) => field("a", number))([])
  ).toThrowErrorMatchingInlineSnapshot(`Expected an object, but got: []`);
  expect(() =>
    record((field) => field("a", number))({})
  ).toThrowErrorMatchingInlineSnapshot(
    `object["a"] (missing): Expected a number, but got: undefined`
  );
  expect(() =>
    record((field) => field("a", number))({ a: null })
  ).toThrowErrorMatchingInlineSnapshot(
    `object["a"]: Expected a number, but got: null`
  );
  expect(() =>
    record((field) => field("hasOwnProperty", number))({})
  ).toThrowErrorMatchingInlineSnapshot(
    `object["hasOwnProperty"] (prototype): Expected a number, but got: function "hasOwnProperty"`
  );

  expect(
    testWithErrorsArray({
      decoder: record((field) => ({ a: field("a", number, { default: 0 }) })),
      data: { a: "1" },
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Object {
        "a": 0,
      },
      "errors": Array [
        object["a"]: Expected a number, but got: "1",
      ],
      "shortErrors": Array [
        object["a"]: Expected a number, but got: string,
      ],
    }
  `);
});

test("record fieldError", () => {
  const decoder = record((field, fieldError) => fieldError("key", "invalid"));

  expect(decoder({})).toMatchInlineSnapshot(
    `[TypeError: object["key"] (missing): invalid]`
  );

  repr.sensitive = true;
  expect(decoder({})).toMatchInlineSnapshot(
    `[TypeError: object["key"] (missing): invalid]`
  );
});

test("record obj and errors", () => {
  const objInput = {};
  const errorsInput = [];
  const result = record((field, fieldError, obj, errors) => {
    expect(obj).toBe(objInput);
    expect(errors).toBe(errorsInput);
    return 1;
  })(objInput, errorsInput);
  expect(result).toBe(1);
});

test("tuple", () => {
  expect(tuple(() => [])([])).toMatchInlineSnapshot(`Array []`);
  expect(
    tuple((item) => ({
      first: item(0, boolean),
      second: item(1, constant("renamed")),
    }))([true, "renamed"])
  ).toMatchInlineSnapshot(`
    Object {
      "first": true,
      "second": "renamed",
    }
  `);

  expect(() => tuple(() => "")("string")).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: "string"`
  );
  expect(() =>
    tuple((item) => [item(99, boolean)])([])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[99] (out of bounds): Expected a boolean, but got: undefined`
  );
  expect(() =>
    tuple((item) => item(0, number))({ length: 1, "0": 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: {"0": 1, "length": 1}`
  );
});

test("tuple item", () => {
  expect(() =>
    tuple((item) => item(0, number))({ length: 1, "0": 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: {"0": 1, "length": 1}`
  );
  expect(() =>
    tuple((item) => item(0, number))([])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[0] (out of bounds): Expected a number, but got: undefined`
  );
  expect(() =>
    tuple((item) => item(0, number))([true])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[0]: Expected a number, but got: true`
  );
  expect(() =>
    tuple((item) => item(-1, number))([])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[-1] (out of bounds): Expected a number, but got: undefined`
  );
  expect(() =>
    tuple((item) => item(1, number))([1])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1] (out of bounds): Expected a number, but got: undefined`
  );

  expect(
    testWithErrorsArray({
      decoder: tuple((item) => [item(0, number, { default: 0 })]),
      data: ["1"],
    })
  ).toMatchInlineSnapshot(`
    Object {
      "decoded": Array [
        0,
      ],
      "errors": Array [
        array[0]: Expected a number, but got: "1",
      ],
      "shortErrors": Array [
        array[0]: Expected a number, but got: string,
      ],
    }
  `);
});

test("tuple itemError", () => {
  const decoder = tuple((item, itemError) => itemError(0, "invalid"));

  expect(decoder([])).toMatchInlineSnapshot(
    `[TypeError: array[0] (out of bounds): invalid]`
  );

  repr.sensitive = true;
  expect(decoder([])).toMatchInlineSnapshot(
    `[TypeError: array[0] (out of bounds): invalid]`
  );
});

test("tuple arr and errors", () => {
  const arrInput = [];
  const errorsInput = [];
  const result = tuple((item, itemError, arr, errors) => {
    expect(arr).toBe(arrInput);
    expect(errors).toBe(errorsInput);
    return 1;
  })(arrInput, errorsInput);
  expect(result).toBe(1);
});

test("autoRecord", () => {
  expect(autoRecord({})({})).toMatchInlineSnapshot(`Object {}`);
  expect(
    autoRecord({
      first: boolean,
      last: constant("not renamed"),
    })({
      first: true,
      last: "not renamed",
    })
  ).toMatchInlineSnapshot(`
    Object {
      "first": true,
      "last": "not renamed",
    }
  `);

  expect(() => autoRecord({})(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => autoRecord({})([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  expect(() =>
    autoRecord({ a: boolean })({})
  ).toThrowErrorMatchingInlineSnapshot(
    `object["a"] (missing): Expected a boolean, but got: undefined`
  );
});

test("pair", () => {
  expect(pair(string, number)(["", 0])).toMatchInlineSnapshot(`
    Array [
      "",
      0,
    ]
  `);
  expect(pair(string, number)(["", 0, true])).toMatchInlineSnapshot(`
    Array [
      "",
      0,
    ]
  `);
  expect(() =>
    pair(string, number)(undefined)
  ).toThrowErrorMatchingInlineSnapshot(`Expected an array, but got: undefined`);
  expect(() => pair(string, number)([])).toThrowErrorMatchingInlineSnapshot(
    `array[0] (out of bounds): Expected a string, but got: undefined`
  );
  expect(() => pair(string, number)([""])).toThrowErrorMatchingInlineSnapshot(
    `array[1] (out of bounds): Expected a number, but got: undefined`
  );
  expect(() =>
    pair(string, number)(["", ""])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1]: Expected a number, but got: ""`
  );
});

test("triple", () => {
  expect(triple(string, number, boolean)(["", 0, true])).toMatchInlineSnapshot(`
    Array [
      "",
      0,
      true,
    ]
  `);
  expect(triple(string, number, boolean)(["", 0, true, 1]))
    .toMatchInlineSnapshot(`
      Array [
        "",
        0,
        true,
      ]
    `);
  expect(() =>
    triple(string, number, boolean)(undefined)
  ).toThrowErrorMatchingInlineSnapshot(`Expected an array, but got: undefined`);
  expect(() =>
    triple(string, number, boolean)([])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[0] (out of bounds): Expected a string, but got: undefined`
  );
  expect(() =>
    triple(string, number, boolean)([""])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1] (out of bounds): Expected a number, but got: undefined`
  );
  expect(() =>
    triple(string, number, boolean)(["", 0])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[2] (out of bounds): Expected a boolean, but got: undefined`
  );
  expect(() =>
    triple(string, number, boolean)(["", "", true])
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1]: Expected a number, but got: ""`
  );

  expect(triple(number, number, pair(string, string))([1, 1, ["a", "b"]]))
    .toMatchInlineSnapshot(`
      Array [
        1,
        1,
        Array [
          "a",
          "b",
        ],
      ]
    `);
});

test("deep", () => {
  const decoder = deep(
    ["store", "products", 1, "accessories", 0, "price"],
    number
  );

  expect(deep([], boolean)(true)).toMatchInlineSnapshot(`true`);
  expect(
    decoder({
      store: { products: [{}, { accessories: [{ price: 123 }] }] },
    })
  ).toMatchInlineSnapshot(`123`);

  expect(() => decoder(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => decoder([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  expect(() => decoder({})).toThrowErrorMatchingInlineSnapshot(
    `object["store"] (missing): Expected an object, but got: undefined`
  );
  expect(() => decoder({ store: {} })).toThrowErrorMatchingInlineSnapshot(
    `object["store"]["products"] (missing): Expected an array, but got: undefined`
  );
  expect(() =>
    decoder({ store: { products: [{}] } })
  ).toThrowErrorMatchingInlineSnapshot(
    `object["store"]["products"][1] (out of bounds): Expected an object, but got: undefined`
  );
  expect(() =>
    decoder({ store: { products: [{}, { accessories: [{ price: null }] }] } })
  ).toThrowErrorMatchingInlineSnapshot(
    `object["store"]["products"][1]["accessories"][0]["price"]: Expected a number, but got: null`
  );
});

test("optional", () => {
  expect(optional(number)(undefined)).toMatchInlineSnapshot(`undefined`);
  expect(optional(number)(null)).toMatchInlineSnapshot(`undefined`);
  expect(optional(number)(0)).toMatchInlineSnapshot(`0`);
  expect(
    record((field) => field("missing", optional(string)))({})
  ).toMatchInlineSnapshot(`undefined`);
  expect(
    record((field) => field("present", optional(string)))({ present: "string" })
  ).toMatchInlineSnapshot(`"string"`);
  expect((optional(number, 5)(undefined): number)).toMatchInlineSnapshot(`5`);
  expect(
    (optional(number, "5")(undefined): number | string)
  ).toMatchInlineSnapshot(`"5"`);
  expect((optional(number, null)(undefined): ?number)).toMatchInlineSnapshot(
    `null`
  );

  expect(() => optional(number)("string")).toThrowErrorMatchingInlineSnapshot(
    `(optional) Expected a number, but got: "string"`
  );
  expect(() =>
    optional(record((field) => field("missing", string)))({})
  ).toThrowErrorMatchingInlineSnapshot(
    `(optional) object["missing"] (missing): Expected a string, but got: undefined`
  );
});

test("map", () => {
  expect(map(number, Math.round)(4.9)).toMatchInlineSnapshot(`5`);
  expect(map(mixedArray, (arr) => arr.length)([1, 2])).toMatchInlineSnapshot(
    `2`
  );
  expect(map(array(number), (arr) => new Set(arr))([1, 2, 1]))
    .toMatchInlineSnapshot(`
      Set {
        1,
        2,
      }
    `);

  expect(() => map(number, string)(0)).toThrowErrorMatchingInlineSnapshot(
    `Expected a string, but got: 0`
  );
  expect(() =>
    map(number, string)("string")
  ).toThrowErrorMatchingInlineSnapshot(`Expected a number, but got: "string"`);
});

test("either", () => {
  expect(either(string, number)("string")).toMatchInlineSnapshot(`"string"`);
  expect(either(string, number)(0)).toMatchInlineSnapshot(`0`);
  expect(either(string, either(number, boolean))(true)).toMatchInlineSnapshot(
    `true`
  );
  expect(either(either(string, number), boolean)(false)).toMatchInlineSnapshot(
    `false`
  );

  expect(() => either(string, number)(true))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
Expected a string, but got: true
Expected a number, but got: true
`);
  expect(() => either(string, either(number, boolean))(null))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
Expected a string, but got: null
Expected a number, but got: null
Expected a boolean, but got: null
`);
  expect(() => either(either(string, number), boolean)(null))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
Expected a string, but got: null
Expected a number, but got: null
Expected a boolean, but got: null
`);
  expect(() => either(autoRecord({ a: number }), string)({ a: true }))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["a"]: Expected a number, but got: true
Expected a string, but got: {"a": true}
`);
});

test("lazy", () => {
  expect(lazy(() => string)("string")).toMatchInlineSnapshot(`"string"`);

  type NestedArray = Array<number | NestedArray>;
  const decodeNestedNumber: Decoder<NestedArray> = array(
    either(
      number,
      lazy(() => decodeNestedNumber)
    )
  );
  expect(decodeNestedNumber([[[[[[[1337]]]]]]])).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Array [
            Array [
              Array [
                Array [
                  1337,
                ],
              ],
            ],
          ],
        ],
      ],
    ]
  `);

  expect(() => decodeNestedNumber([[[["nope"]]]]))
    .toThrowErrorMatchingInlineSnapshot(`
array[0]: Several decoders failed:
Expected a number, but got: [Array(1)]
array[0]: Several decoders failed:
Expected a number, but got: [Array(1)]
array[0]: Several decoders failed:
Expected a number, but got: ["nope"]
array[0]: Several decoders failed:
Expected a number, but got: "nope"
Expected an array, but got: "nope"
`);
});

test("all decoders pass down errors", () => {
  const subDecoder: Decoder<boolean | null> = record((field) =>
    field("test", boolean, { default: null })
  );

  const decoder = record((field) => ({
    boolean: field("boolean", boolean, { default: undefined }),
    number: field("number", number, { default: undefined }),
    string: field("string", string, { default: undefined }),
    constant: field("constant", constant(1), { default: undefined }),
    mixedArray: field("mixedArray", mixedArray, { default: undefined }),
    mixedDict: field("mixedDict", mixedDict, { default: undefined }),
    array: field("array", array(subDecoder), { default: undefined }),
    dict: field("dict", dict(subDecoder), { default: undefined }),
    record: field(
      "record",
      record((field2) => field2("field", subDecoder)),
      {
        default: undefined,
      }
    ),
    tuple: field(
      "tuple",
      tuple((item) => item(0, subDecoder)),
      {
        default: undefined,
      }
    ),
    pair1: field("pair1", pair(subDecoder, boolean), { default: undefined }),
    pair2: field("pair2", pair(boolean, subDecoder), { default: undefined }),
    triple1: field("triple1", triple(subDecoder, boolean, boolean), {
      default: undefined,
    }),
    triple2: field("triple2", triple(boolean, subDecoder, boolean), {
      default: undefined,
    }),
    triple3: field("triple3", triple(boolean, boolean, subDecoder), {
      default: undefined,
    }),
    autoRecord: field("autoRecord", autoRecord({ field: subDecoder }), {
      default: undefined,
    }),
    deep: field("deep", deep(["field", 0], subDecoder), { default: undefined }),
    optional: field("optional", optional(subDecoder), { default: undefined }),
    map1: field("map1", map(subDecoder, constant(null)), {
      default: undefined,
    }),
    map2: field(
      "map2",
      map((value) => value, subDecoder),
      {
        default: undefined,
      }
    ),
    either1: field("either1", either(boolean, subDecoder), {
      default: undefined,
    }),
    either2: field("either2", either(subDecoder, boolean), {
      default: undefined,
    }),
    lazy: field(
      "lazy",
      lazy(() => subDecoder),
      { default: undefined }
    ),
  }));

  const subData: mixed = { test: 0 };

  const data: mixed = {
    boolean: 0,
    number: false,
    string: false,
    constant: false,
    mixedArray: false,
    mixedDict: false,
    array: [subData],
    dict: { key: subData },
    record: { field: subData },
    tuple: [subData],
    pair1: [subData, true],
    pair2: [true, subData],
    triple1: [subData, true, true],
    triple2: [true, subData, true],
    triple3: [true, true, subData],
    autoRecord: { field: subData },
    deep: { field: [subData] },
    optional: subData,
    map1: subData,
    map2: subData,
    either1: subData,
    either2: subData,
    lazy: subData,
  };

  expect(testWithErrorsArray({ decoder, data })).toMatchInlineSnapshot(`
    Object {
      "decoded": Object {
        "array": Array [
          null,
        ],
        "autoRecord": Object {
          "field": null,
        },
        "boolean": undefined,
        "constant": undefined,
        "deep": null,
        "dict": Object {
          "key": null,
        },
        "either1": null,
        "either2": null,
        "lazy": null,
        "map1": null,
        "map2": null,
        "mixedArray": undefined,
        "mixedDict": undefined,
        "number": undefined,
        "optional": null,
        "pair1": Array [
          null,
          true,
        ],
        "pair2": Array [
          true,
          null,
        ],
        "record": null,
        "string": undefined,
        "triple1": Array [
          null,
          true,
          true,
        ],
        "triple2": Array [
          true,
          null,
          true,
        ],
        "triple3": Array [
          true,
          true,
          null,
        ],
        "tuple": null,
      },
      "errors": Array [
        object["boolean"]: Expected a boolean, but got: 0,
        object["number"]: Expected a number, but got: false,
        object["string"]: Expected a string, but got: false,
        object["constant"]: Expected the value 1, but got: false,
        object["mixedArray"]: Expected an array, but got: false,
        object["mixedDict"]: Expected an object, but got: false,
        object["array"][0]["test"]: Expected a boolean, but got: 0,
        object["dict"]["key"]["test"]: Expected a boolean, but got: 0,
        object["record"]["field"]["test"]: Expected a boolean, but got: 0,
        object["tuple"][0]["test"]: Expected a boolean, but got: 0,
        object["pair1"][0]["test"]: Expected a boolean, but got: 0,
        object["pair2"][1]["test"]: Expected a boolean, but got: 0,
        object["triple1"][0]["test"]: Expected a boolean, but got: 0,
        object["triple2"][1]["test"]: Expected a boolean, but got: 0,
        object["triple3"][2]["test"]: Expected a boolean, but got: 0,
        object["autoRecord"]["field"]["test"]: Expected a boolean, but got: 0,
        object["deep"]["field"][0]["test"]: Expected a boolean, but got: 0,
        object["optional"]["test"]: Expected a boolean, but got: 0,
        object["map1"]["test"]: Expected a boolean, but got: 0,
        object["map2"]["test"]: Expected a boolean, but got: 0,
        object["either1"]["test"]: Expected a boolean, but got: 0,
        object["either2"]["test"]: Expected a boolean, but got: 0,
        object["lazy"]["test"]: Expected a boolean, but got: 0,
      ],
      "shortErrors": Array [
        object["boolean"]: Expected a boolean, but got: number,
        object["number"]: Expected a number, but got: boolean,
        object["string"]: Expected a string, but got: boolean,
        object["constant"]: Expected the value number, but got: boolean,
        object["mixedArray"]: Expected an array, but got: boolean,
        object["mixedDict"]: Expected an object, but got: boolean,
        object["array"][0]["test"]: Expected a boolean, but got: number,
        object["dict"]["key"]["test"]: Expected a boolean, but got: number,
        object["record"]["field"]["test"]: Expected a boolean, but got: number,
        object["tuple"][0]["test"]: Expected a boolean, but got: number,
        object["pair1"][0]["test"]: Expected a boolean, but got: number,
        object["pair2"][1]["test"]: Expected a boolean, but got: number,
        object["triple1"][0]["test"]: Expected a boolean, but got: number,
        object["triple2"][1]["test"]: Expected a boolean, but got: number,
        object["triple3"][2]["test"]: Expected a boolean, but got: number,
        object["autoRecord"]["field"]["test"]: Expected a boolean, but got: number,
        object["deep"]["field"][0]["test"]: Expected a boolean, but got: number,
        object["optional"]["test"]: Expected a boolean, but got: number,
        object["map1"]["test"]: Expected a boolean, but got: number,
        object["map2"]["test"]: Expected a boolean, but got: number,
        object["either1"]["test"]: Expected a boolean, but got: number,
        object["either2"]["test"]: Expected a boolean, but got: number,
        object["lazy"]["test"]: Expected a boolean, but got: number,
      ],
    }
  `);
});
