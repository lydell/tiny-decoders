// @flow strict

import { repr } from "../src";

// Make snapshots easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
// This is like the serializer in jest.snapshots.config.js but for _all_ strings.
expect.addSnapshotSerializer({
  test: value => typeof value === "string",
  print: value => value,
});

class Point {
  /*::
    x: number;
    y: number;
    */

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

test("undefined", () => {
  expect(repr(undefined)).toMatchInlineSnapshot(`undefined`);
});

test("null", () => {
  expect(repr(null)).toMatchInlineSnapshot(`null`);
});

test("boolean", () => {
  expect(repr(true)).toMatchInlineSnapshot(`true`);
  expect(repr(false)).toMatchInlineSnapshot(`false`);
});

test("number", () => {
  expect(repr(0)).toMatchInlineSnapshot(`0`);
  expect(repr(123.456)).toMatchInlineSnapshot(`123.456`);
  expect(repr(NaN)).toMatchInlineSnapshot(`NaN`);
  expect(repr(Infinity)).toMatchInlineSnapshot(`Infinity`);
  expect(repr(-Infinity)).toMatchInlineSnapshot(`-Infinity`);
  expect(repr(Math.PI)).toMatchInlineSnapshot(`3.141592653589793`);
  expect(repr(1e300)).toMatchInlineSnapshot(`1e+300`);
  expect(repr(-123456789.01234567890123456789)).toMatchInlineSnapshot(
    `-123456789.01234567`
  );
});

test("string", () => {
  expect(repr("")).toMatchInlineSnapshot(`""`);
  expect(repr("string")).toMatchInlineSnapshot(`"string"`);
  expect(repr('"quotes"')).toMatchInlineSnapshot(`"\\"quotes\\""`);
  /* eslint-disable no-irregular-whitespace */
  expect(repr(" \t\r\n\u2028\u2029\f\v")).toMatchInlineSnapshot(
    `" \\t\\r\\n  \\f\\u000b"`
  );
  /* eslint-enable no-irregular-whitespace */
  expect(repr("Iñtërnâtiônàlizætiøn☃💩")).toMatchInlineSnapshot(
    `"Iñtërnâti…ætiøn☃💩"`
  );
});

test("number-like strings", () => {
  expect(repr("0")).toMatchInlineSnapshot(`(string) "0"`);
  expect(repr("NaN")).toMatchInlineSnapshot(`(string) "NaN"`);
  expect(repr("Infinity")).toMatchInlineSnapshot(`(string) "Infinity"`);
  expect(repr("-Infinity")).toMatchInlineSnapshot(`(string) "-Infinity"`);
  expect(repr("1e300")).toMatchInlineSnapshot(`(string) "1e300"`);
  expect(repr("-123456789.01234567890123456789")).toMatchInlineSnapshot(
    `(string) "-12345678…23456789"`
  );

  // Not number-like:
  expect(repr("10px")).toMatchInlineSnapshot(`"10px"`);
  expect(repr("")).toMatchInlineSnapshot(`""`);
  expect(repr(" \n")).toMatchInlineSnapshot(`" \\n"`);
  expect(repr("  10  ")).toMatchInlineSnapshot(`"  10  "`);
});

test("symbol", () => {
  expect(repr(Symbol())).toMatchInlineSnapshot(`Symbol("")`);
  expect(repr(Symbol("description"))).toMatchInlineSnapshot(
    `Symbol("description")`
  );
  expect(repr(Symbol('"), "key": "other value"'))).toMatchInlineSnapshot(
    `Symbol("\\"), \\"ke… value\\"")`
  );
});

/* eslint-disable no-empty-function, prefer-arrow-callback, flowtype/require-return-type */
test("function", () => {
  expect(repr(repr)).toMatchInlineSnapshot(`function "repr"`);
  expect(repr(() => {})).toMatchInlineSnapshot(`function ""`);
  expect(repr(function named() {})).toMatchInlineSnapshot(`function "named"`);
  expect(repr(async function* generator() {})).toMatchInlineSnapshot(
    `function "generator"`
  );
  const fn = () => {};
  Object.defineProperty(fn, "name", { value: '"), "key": "other value"' });
  expect(repr(fn)).toMatchInlineSnapshot(`function "\\"), \\"ke… value\\""`);
});
/* eslint-enable no-empty-function, prefer-arrow-callback, flowtype/require-return-type */

test("regex", () => {
  expect(repr(/test/)).toMatchInlineSnapshot(`/test/`);
  expect(repr(/^\d{4}-\d{2}-\d{2}$/gimy)).toMatchInlineSnapshot(
    `/^\\d{4}-\\d…{2}$/gimy`
  );
});

test("Date", () => {
  expect(repr(new Date("2018-10-27T16:07:33.978Z"))).toMatchInlineSnapshot(
    `Date(2018-10-27T16:07:33.978Z)`
  );
  expect(repr(new Date("invalid"))).toMatchInlineSnapshot(`Date(Invalid Date)`);
});

test("Error", () => {
  expect(repr(new Error("error"))).toMatchInlineSnapshot(`Error("error")`);
  expect(repr(new RangeError("out of range"))).toMatchInlineSnapshot(
    `RangeError("out of range")`
  );
  expect(repr(new Error("too long\nmessage to fit"))).toMatchInlineSnapshot(
    `Error("too long\\…e to fit")`
  );

  class CustomError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CustomError";
    }
  }
  expect(repr(new CustomError("custom"))).toMatchInlineSnapshot(
    `CustomError("custom") (properties: {"name": "CustomError"})`
  );

  class CustomError2 extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WayTooLongErrorNameToShow";
    }
  }
  expect(repr(new CustomError2("custom"))).toMatchInlineSnapshot(
    `Error("custom") (properties: {"name": "WayTooLon…meToShow"})`
  );

  const error = new Error();
  error.name = '"), "key": "other value"';
  expect(repr(error)).toMatchInlineSnapshot(
    `Error("") (properties: {"name": "\\"), \\"ke… value\\""})`
  );

  const error2 = new Error();
  // $FlowIgnore: `.message` is not allowed to be null, but we’re testing here.
  error2.message = null;
  expect(repr(error2)).toMatchInlineSnapshot(
    `Error (properties: {"message": null})`
  );
});

/* eslint-disable no-new-wrappers */
test("primitive wrappers", () => {
  expect(repr(new Boolean(true))).toMatchInlineSnapshot(`new Boolean(true)`);
  expect(repr(new Boolean(false))).toMatchInlineSnapshot(`new Boolean(false)`);

  expect(repr(new Number(0))).toMatchInlineSnapshot(`new Number(0)`);
  expect(repr(new Number(NaN))).toMatchInlineSnapshot(`new Number(NaN)`);

  expect(repr(new String("string"))).toMatchInlineSnapshot(
    `new String("string")`
  );
  expect(repr(new String('"), "key": "other value"'))).toMatchInlineSnapshot(
    `new String("\\"), \\"ke… value\\"")`
  );
});
/* eslint-enable no-new-wrappers */

test("array", () => {
  expect(repr([])).toMatchInlineSnapshot(`[]`);
  expect(repr([1])).toMatchInlineSnapshot(`[1]`);
  expect(repr([1], { recurse: false })).toMatchInlineSnapshot(`Array(1)`);
  expect(
    repr(
      // eslint-disable-next-line no-sparse-arrays
      [
        undefined,
        ,
        null,
        true,
        NaN,
        "string",
        Symbol("desc"),
        repr,
        /test/gm,
        new Date("2018-10-27T16:07:33.978Z"),
        new RangeError(),
        // eslint-disable-next-line no-new-wrappers
        new String("wrap"),
        [],
        {},
        [1],
        { a: 1 },
        new Point(10, 235.8),
      ],
      { maxArrayChildren: Infinity }
    )
  ).toMatchInlineSnapshot(
    `[undefined, <empty>, null, true, NaN, "string", Symbol("desc"), function "repr", /test/gm, Date(2018-10-27T16:07:33.978Z), RangeError(""), new String("wrap"), Array(0), Object(0), Array(1), Object(1), Point(2)]`
  );
});

test("array key", () => {
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7])).toMatchInlineSnapshot(
    `[0, 1, 2, 3, 4, (3 more)]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: -1 })).toMatchInlineSnapshot(
    `[0, 1, 2, 3, 4, (3 more)]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 0 })).toMatchInlineSnapshot(
    `[(index 0) 0, 1, 2, 3, 4, (3 more)]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 1 })).toMatchInlineSnapshot(
    `[(1 more), (index 1) 1, 2, 3, 4, 5, (2 more)]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 2 })).toMatchInlineSnapshot(
    `[(2 more), (index 2) 2, 3, 4, 5, 6, (1 more)]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 3 })).toMatchInlineSnapshot(
    `[(3 more), (index 3) 3, 4, 5, 6, 7]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 4 })).toMatchInlineSnapshot(
    `[(3 more), 3, (index 4) 4, 5, 6, 7]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 5 })).toMatchInlineSnapshot(
    `[(3 more), 3, 4, (index 5) 5, 6, 7]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 6 })).toMatchInlineSnapshot(
    `[(3 more), 3, 4, 5, (index 6) 6, 7]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: 7 })).toMatchInlineSnapshot(
    `[(3 more), 3, 4, 5, 6, (index 7) 7]`
  );
  expect(repr([0, 1, 2, 3, 4, 5, 6, 7], { key: "0" })).toMatchInlineSnapshot(
    `[0, 1, 2, 3, 4, (3 more)]`
  );
});

test("object", () => {
  expect(repr({})).toMatchInlineSnapshot(`{}`);
  expect(repr({ a: 1 })).toMatchInlineSnapshot(`{"a": 1}`);
  expect(repr({ a: 1 }, { recurse: false })).toMatchInlineSnapshot(`Object(1)`);
  expect(
    repr(
      {
        a: undefined,
        b: null,
        c: true,
        d: NaN,
        e: "string",
        f: Symbol("desc"),
        g: repr,
        h: /test/gm,
        i: new Date("2018-10-27T16:07:33.978Z"),
        j: new RangeError(),
        // eslint-disable-next-line no-new-wrappers
        k: new String("wrap"),
        l: [],
        m: {},
        o: [1],
        p: { a: 1 },
        r: new Point(10, 235.8),
      },
      { maxObjectChildren: Infinity }
    )
  ).toMatchInlineSnapshot(
    `{"a": undefined, "b": null, "c": true, "d": NaN, "e": "string", "f": Symbol("desc"), "g": function "repr", "h": /test/gm, "i": Date(2018-10-27T16:07:33.978Z), "j": RangeError(""), "k": new String("wrap"), "l": Array(0), "m": Object(0), "o": Array(1), "p": Object(1), "r": Point(2)}`
  );
  expect(repr({ '"), "key": "other value"': 1 })).toMatchInlineSnapshot(
    `{"\\"), \\"ke… value\\"": 1}`
  );
  expect(repr(new Point(10, 235.8))).toMatchInlineSnapshot(
    `Point {"x": 10, "y": 235.8}`
  );
  class Bad {
    /*:: prop: number; */
    constructor() {
      this.prop = 1;
    }
  }
  Object.defineProperty(Bad, "name", { value: '"), "key": "other value"' });
  expect(repr(new Bad())).toMatchInlineSnapshot(`{"prop": 1}`);
});

test("object key", () => {
  expect(repr({ a: 1, b: 2, c: 3, d: 4, e: 5 })).toMatchInlineSnapshot(
    `{"a": 1, "b": 2, "c": 3, (2 more)}`
  );
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "a" })
  ).toMatchInlineSnapshot(`{"a": 1, "b": 2, "c": 3, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "b" })
  ).toMatchInlineSnapshot(`{"b": 2, "a": 1, "c": 3, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "c" })
  ).toMatchInlineSnapshot(`{"c": 3, "a": 1, "b": 2, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "d" })
  ).toMatchInlineSnapshot(`{"d": 4, "a": 1, "b": 2, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "e" })
  ).toMatchInlineSnapshot(`{"e": 5, "a": 1, "b": 2, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: "f" })
  ).toMatchInlineSnapshot(`{"a": 1, "b": 2, "c": 3, (2 more)}`);
  expect(
    repr({ a: 1, b: 2, c: 3, d: 4, e: 5 }, { key: 0 })
  ).toMatchInlineSnapshot(`{"a": 1, "b": 2, "c": 3, (2 more)}`);
});

test("objects with length", () => {
  expect(repr(Buffer.from("buffer"))).toMatchInlineSnapshot(`Uint8Array(6)`);
  expect(repr(new Float32Array([1, 2.5]))).toMatchInlineSnapshot(
    `Float32Array(2)`
  );
  expect(repr(document.querySelectorAll("html"))).toMatchInlineSnapshot(
    `NodeList(1)`
  );
});

test("objects with size", () => {
  expect(repr(new Map())).toMatchInlineSnapshot(`Map(0)`);
  expect(repr(new Set([1, 1, 2]))).toMatchInlineSnapshot(`Set(2)`);
});

test("misc", () => {
  expect(repr(new WeakMap())).toMatchInlineSnapshot(`WeakMap`);
  expect(repr(new WeakSet())).toMatchInlineSnapshot(`WeakSet`);
  expect(repr(document.createElement("p"))).toMatchInlineSnapshot(
    `HTMLParagraphElement`
  );
  expect(
    repr(
      // eslint-disable-next-line no-unused-vars, flowtype/require-return-type
      (function(a: number, b: number) {
        // eslint-disable-next-line prefer-rest-params
        return arguments;
      })(1, 2)
    )
  ).toMatchInlineSnapshot(`Arguments(2)`);
});

test("extra properties", () => {
  // eslint-disable-next-line no-empty-function
  function fn() {}
  fn.prop = 1;
  expect(repr(fn)).toMatchInlineSnapshot(
    `function "fn" (properties: {"prop": 1})`
  );

  const regex = /test/;
  // $FlowIgnore: Unknown prop for testing.
  regex.prop = 1;
  expect(repr(regex)).toMatchInlineSnapshot(`/test/ (properties: {"prop": 1})`);

  const date = new Date("2018-10-27T16:07:33.978Z");
  // $FlowIgnore: Unknown prop for testing.
  date.prop = 1;
  expect(repr(date)).toMatchInlineSnapshot(
    `Date(2018-10-27T16:07:33.978Z) (properties: {"prop": 1})`
  );

  const error = new Error();
  // $FlowIgnore: Unknown prop for testing.
  error.prop = 1;
  expect(repr(error)).toMatchInlineSnapshot(
    `Error("") (properties: {"prop": 1})`
  );

  const array = [];
  // $FlowIgnore: Unknown prop for testing.
  array.prop = 1;
  expect(repr(array)).toMatchInlineSnapshot(`[] (properties: {"prop": 1})`);

  const set = new Set();
  // $FlowIgnore: Unknown prop for testing.
  set.prop = 1;
  expect(repr(set)).toMatchInlineSnapshot(`Set(0) (properties: {"prop": 1})`);

  // eslint-disable-next-line no-empty-function
  function fn2() {}
  fn2.a = 1;
  fn2["long key is truncated as usual"] = 2;
  // Does not print extra properties for children.
  fn2.noNested = fn2;
  fn2.hidden = "initially";
  expect(repr(fn2)).toMatchInlineSnapshot(
    `function "fn2" (properties: {"a": 1, "long key …as usual": 2, "noNested": function "fn2", (1 more)})`
  );
  expect(repr(fn2, { key: "hidden" })).toMatchInlineSnapshot(
    `function "fn2" (properties: {"hidden": "initially", "a": 1, "long key …as usual": 2, (1 more)})`
  );
  expect(repr(fn2, { printExtraProps: false })).toMatchInlineSnapshot(
    `function "fn2"`
  );
});

test("catch errors", () => {
  const date = new Date("2018-10-27T16:07:33.978Z");
  // $FlowIgnore: Re-assigning method for testing.
  date.toISOString = () => {
    throw new Error("failed for whatever reason");
  };
  expect(() => date.toISOString()).toThrowErrorMatchingInlineSnapshot(
    `failed for whatever reason`
  );
  expect(repr(date)).toMatchInlineSnapshot(`Date`);
});
