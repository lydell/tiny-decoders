// @flow strict

import {
  andThen,
  array,
  boolean,
  constant,
  dict,
  either,
  field,
  fieldAndThen,
  fieldDeep,
  group,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  record,
  repr,
  string,
} from "../src";

// Make snapshots for error messages easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: value => typeof value === "string" && value.includes("Expected"),
  print: value => value,
});

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
    `Expected a string, but got: Symbol("desc")`
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
  expect(() => array(number)([1, "2"])).toThrowErrorMatchingInlineSnapshot(`
array[1]: Expected a number, but got: (string) "2"
at 1 in [1, (index 1) (string) "2"]
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
  expect(() => dict(string)({ a: "a", b: 0 }))
    .toThrowErrorMatchingInlineSnapshot(`
object["b"]: Expected a string, but got: 0
at "b" in {"b": 0, "a": "a"}
`);
  expect(() => dict(string)({ '"), "key": "other value"': 1 }))
    .toThrowErrorMatchingInlineSnapshot(`
object["\\"), \\"ke… value\\""]: Expected a string, but got: 1
at "\\"), \\"ke… value\\"" in {"\\"), \\"ke… value\\"": 1}
`);
});

test("group", () => {
  expect(group({})()).toMatchInlineSnapshot(`Object {}`);
  expect(group({ a: string })("string")).toMatchInlineSnapshot(`
Object {
  "a": "string",
}
`);
  expect(
    group({
      first: field("first", boolean),
      second: field("last", constant("renamed")),
    })({
      first: true,
      last: "renamed",
    })
  ).toMatchInlineSnapshot(`
Object {
  "first": true,
  "second": "renamed",
}
`);

  expect(() => group({ a: string })(0)).toThrowErrorMatchingInlineSnapshot(
    `Expected a string, but got: 0`
  );
  expect(() => group({ a: field("missing", boolean) })({}))
    .toThrowErrorMatchingInlineSnapshot(`
object["missing"]: Expected a boolean, but got: undefined
at "missing" (missing) in {}
`);
});

test("record", () => {
  expect(record({})({})).toMatchInlineSnapshot(`Object {}`);
  expect(
    record({
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

  expect(() => record({})(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => record({})([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  expect(() => record({ a: boolean })({})).toThrowErrorMatchingInlineSnapshot(`
object["a"]: Expected a boolean, but got: undefined
at "a" (missing) in {}
`);
});

test("field", () => {
  expect(field("a", number)({ a: 1 })).toMatchInlineSnapshot(`1`);
  expect(field(0, number)([1])).toMatchInlineSnapshot(`1`);
  expect(field("size", number)(new Set([1, 2]))).toMatchInlineSnapshot(`2`);
  // eslint-disable-next-line no-empty-function
  function fn() {}
  fn.prop = "value";
  expect(field("prop", constant("value"))).toMatchInlineSnapshot(`[Function]`);

  expect(() => field("a", number)(null)).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: null`
  );
  expect(() => field("a", number)([])).toThrowErrorMatchingInlineSnapshot(
    `Expected an object, but got: []`
  );
  expect(() => field("a", number)({})).toThrowErrorMatchingInlineSnapshot(`
object["a"]: Expected a number, but got: undefined
at "a" (missing) in {}
`);
  expect(() => field("a", number)({ a: null }))
    .toThrowErrorMatchingInlineSnapshot(`
object["a"]: Expected a number, but got: null
at "a" in {"a": null}
`);
  expect(() => field("hasOwnProperty", number)({}))
    .toThrowErrorMatchingInlineSnapshot(`
object["hasOwnProperty"]: Expected a number, but got: function "hasOwnProperty"
at "hasOwnProperty" (prototype) in {}
`);

  expect(() =>
    field(0, number)({ length: 1, "0": 1 })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected an array, but got: {"0": 1, "length": 1}`
  );
  expect(() => field(0, number)([])).toThrowErrorMatchingInlineSnapshot(`
array[0]: Expected a number, but got: undefined
at 0 (out of bounds) in []
`);
  expect(() => field(0, number)([true])).toThrowErrorMatchingInlineSnapshot(`
array[0]: Expected a number, but got: true
at 0 in [(index 0) true]
`);
  expect(() => field(-1, number)([])).toThrowErrorMatchingInlineSnapshot(`
array[-1]: Expected a number, but got: undefined
at -1 (out of bounds) in []
`);
  expect(() => field(1, number)([1])).toThrowErrorMatchingInlineSnapshot(`
array[1]: Expected a number, but got: undefined
at 1 (out of bounds) in [1]
`);
});

test("fieldDeep", () => {
  const decoder = fieldDeep(
    ["store", "products", 1, "accessories", 0, "price"],
    number
  );

  expect(fieldDeep([], boolean)(true)).toMatchInlineSnapshot(`true`);
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
  expect(() => decoder({})).toThrowErrorMatchingInlineSnapshot(`
object["store"]: Expected an object, but got: undefined
at "store" (missing) in {}
`);
  expect(() => decoder({ store: {} })).toThrowErrorMatchingInlineSnapshot(`
object["store"]["products"]: Expected an array, but got: undefined
at "products" (missing) in {}
at "store" in {"store": Object(0)}
`);
  expect(() => decoder({ store: { products: [{}] } }))
    .toThrowErrorMatchingInlineSnapshot(`
object["store"]["products"][1]: Expected an object, but got: undefined
at 1 (out of bounds) in [Object(0)]
at "products" in {"products": Array(1)}
at "store" in {"store": Object(1)}
`);
  expect(() =>
    decoder({ store: { products: [{}, { accessories: [{ price: null }] }] } })
  ).toThrowErrorMatchingInlineSnapshot(`
object["store"]["products"][1]["accessories"][0]["price"]: Expected a number, but got: null
at "price" in {"price": null}
at 0 in [(index 0) Object(1)]
at "accessories" in {"accessories": Array(1)}
at 1 in [Object(0), (index 1) Object(1)]
at "products" in {"products": Array(2)}
at "store" in {"store": Object(1)}
`);
});

test("optional", () => {
  expect(optional(number)(undefined)).toMatchInlineSnapshot(`undefined`);
  expect(optional(number)(null)).toMatchInlineSnapshot(`undefined`);
  expect(optional(number)(0)).toMatchInlineSnapshot(`0`);
  expect(field("missing", optional(string))({})).toMatchInlineSnapshot(
    `undefined`
  );
  expect(
    field("present", optional(string))({ present: "string" })
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
  expect(() => optional(field("missing", string))({}))
    .toThrowErrorMatchingInlineSnapshot(`
(optional) object["missing"]: Expected a string, but got: undefined
at "missing" (missing) in {}
`);
});

test("map", () => {
  expect(map(number, Math.round)(4.9)).toMatchInlineSnapshot(`5`);
  expect(map(mixedArray, arr => arr.length)([1, 2])).toMatchInlineSnapshot(`2`);
  expect(map(array(number), arr => new Set(arr))([1, 2, 1]))
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

test("andThen", () => {
  const decoder = andThen(field("key", string), key => field(key, number));
  expect(decoder({ key: "value", value: 5 })).toMatchInlineSnapshot(`5`);
  expect(decoder({ key: "price", price: 123 })).toMatchInlineSnapshot(`123`);

  expect(() =>
    andThen(number, () => string)(null)
  ).toThrowErrorMatchingInlineSnapshot(`Expected a number, but got: null`);
  expect(() =>
    andThen(number, () => string)(0)
  ).toThrowErrorMatchingInlineSnapshot(`Expected a string, but got: 0`);
  expect(() => decoder({ key: "missing" })).toThrowErrorMatchingInlineSnapshot(`
object["missing"]: Expected a number, but got: undefined
at "missing" (missing) in {"key": "missing"}
`);
  expect(() =>
    andThen(field("key", string), key => {
      throw new TypeError(`Expected a valid key, but got: ${repr(key)}`);
    })({ key: "invalid" })
  ).toThrowErrorMatchingInlineSnapshot(
    `Expected a valid key, but got: "invalid"`
  );
});

test("fieldAndThen", () => {
  const decoder = fieldAndThen("key", string, key => field(key, boolean));

  expect(
    decoder({
      key: "enabled",
      enabled: true,
    })
  ).toMatchInlineSnapshot(`true`);

  expect(() => decoder({ key: "missing" })).toThrowErrorMatchingInlineSnapshot(`
object["missing"]: Expected a boolean, but got: undefined
at "missing" (missing) in {"key": "missing"}
`);
  expect(() =>
    fieldAndThen("key", string, key => {
      throw new TypeError(`Expected a valid key, but got: ${repr(key)}`);
    })({ key: "invalid" })
  ).toThrowErrorMatchingInlineSnapshot(`
object["key"]: Expected a valid key, but got: "invalid"
at "key" in {"key": "invalid"}
`);
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
  expect(() => either(record({ a: number }), string)({ a: true }))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["a"]: Expected a number, but got: true
at "a" in {"a": true}
Expected a string, but got: {"a": true}
`);
});
