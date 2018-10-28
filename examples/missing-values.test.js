// @flow strict

import {
  andThen,
  constant,
  either,
  field,
  group,
  mixedArray,
  mixedDict,
  number,
  string,
} from "../src";

test("distinguishing between undefined, null and missing values", () => {
  // When decoding objects, arrays and tuple, the value for a proerty or index
  // can be missing in three ways:
  //
  // - The value is `null`.
  // - The value is `undefined`.
  // - The property is not set, or the index is out of bounds or pointing to a
  //   hole in the array. Trying to access the property or index anyway returns
  //   the value `undefined`.
  //
  // tiny-decoders makes no attempt to distinguish between those cases. It never
  // checks if a property or index exists before trying to access it, and
  // `optional` treats `null` and `undefined` the same. Luckily, there’s
  // seldomly any need to distingush the three cases so that’s whay
  // tiny-decoders have kept things simple, rather than providing three or more
  // confusingly similar functions. I wouldn’t want to have to learn the
  // difference between `optional`, `maybe`, `nullable`, etc.
  //
  // If you ever end up in a situation where you do need to disinguish between
  // them, it’s still possible with a little trickery.

  // If you don’t need to check for missing values and need `optional` but only
  // for `null` OR `undefined` (not both), you can use `either` and
  // `constant(null)` or `constant(undefined)`.
  expect(either(number, constant(null))(0)).toMatchInlineSnapshot(`0`);
  expect(either(number, constant(null))(null)).toMatchInlineSnapshot(`null`);
  expect(() => either(number, constant(null))(undefined))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
Expected a number, but got: undefined
Expected the value null, but got: undefined
`);

  // If you also need to consider missing values, there are a couple of approaches.

  type Age = "missing" | void | null | number;

  type User = {|
    name: string,
    age: Age,
  |};

  const userDecoder: mixed => User = group({
    name: field("name", string),
    age: andThen(
      mixedDict,
      // This manual checking is ugly but also kind of clear in what it is doing.
      obj =>
        !("age" in obj)
          ? () => "missing"
          : obj.age === null
            ? () => null
            : obj.age === undefined
              ? () => undefined
              : field("age", number)
    ),
  });
  expect(userDecoder({ name: "John" })).toMatchInlineSnapshot(`
Object {
  "age": "missing",
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: undefined })).toMatchInlineSnapshot(`
Object {
  "age": undefined,
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: null })).toMatchInlineSnapshot(`
Object {
  "age": null,
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: 30 })).toMatchInlineSnapshot(`
Object {
  "age": 30,
  "name": "John",
}
`);

  // You could also make a custom decoder.
  function maybeField<T, U>(
    key: string | number,
    decoder: mixed => T,
    valueIfMissing: U
  ): mixed => ?T | U {
    return function maybeFieldDecoder(value: mixed): T | U {
      const obj = either(mixedDict, mixedArray)(value);
      return !(key in obj)
        ? valueIfMissing
        : field(
            key,
            either(decoder, either(constant(null), constant(undefined)))
          )(obj);
    };
  }

  const userDecoder2: mixed => User = group({
    name: field("name", string),
    age: maybeField("age", number, "missing"),
  });
  expect(userDecoder2({ name: "John" })).toMatchInlineSnapshot(`
Object {
  "age": "missing",
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: undefined })).toMatchInlineSnapshot(`
Object {
  "age": undefined,
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: null })).toMatchInlineSnapshot(`
Object {
  "age": null,
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: 30 })).toMatchInlineSnapshot(`
Object {
  "age": 30,
  "name": "John",
}
`);
});
