# tiny-decoders ![no dependencies][deps-tiny-decoders] [![minified size][min-tiny-decoders]][bundlephobia-tiny-decoders]

Type-safe data decoding for the minimalist, inspired by [nvie/decoders] and [Elm’s JSON Decoders][elm-json].

Supports [TypeScript] and [Flow].

```ts
import {
  Decoder,
  array,
  boolean,
  either,
  number,
  optional,
  fields,
  string,
} from "tiny-decoders";

type User = {
  name: string;
  active: boolean;
  age: number | undefined;
  interests: Array<string>;
  id: string | number;
};

const userDecoder = fields(
  (field): User => ({
    name: field("full_name", string),
    active: field("is_active", boolean),
    age: field("age", optional(number)),
    interests: field("interests", array(string)),
    id: field("id", either(string, number)),
  })
);

const payload: unknown = getSomeJSON();

const user: User = userDecoder(payload);

/*
If we get here, `user` is now a valid `User`!
Otherwise, a `TypeError` is thrown.
The error can look like this:

    TypeError: object["age"]: (optional) Expected a number, but got: "30"
*/
```

[️Full example][example-readme]

---

[bundlephobia-tiny-decoders]: https://bundlephobia.com/result?p=tiny-decoders
[deps-tiny-decoders]: https://img.shields.io/david/lydell/tiny-decoders.svg
[elm-json]: https://package.elm-lang.org/packages/elm/json/latest/Json-Decode
[example-readme]: https://github.com/lydell/tiny-decoders/blob/master/examples/readme.test.js
[flow]: https://flow.org/
[min-tiny-decoders]: https://img.shields.io/bundlephobia/min/tiny-decoders.svg
[nvie/decoders]: https://github.com/nvie/decoders
[typescript]: https://www.typescriptlang.org/

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Intro](#intro)
- [A note on type annotations](#a-note-on-type-annotations)
- [API](#api)
  - [The `Decoder<T>` type](#the-decodert-type)
  - [Primitive decoders](#primitive-decoders)
    - [`boolean`](#boolean)
    - [`number`](#number)
    - [`string`](#string)
    - [`constant`](#constant)
  - [Functions that _return_ a decoder](#functions-that-_return_-a-decoder)
    - [Tolerant decoding](#tolerant-decoding)
    - [`array`](#array)
    - [`dict`](#dict)
    - [`fields`](#fields)
    - [`pair`](#pair)
    - [`triple`](#triple)
    - [`autoRecord`](#autorecord)
    - [`deep`](#deep)
    - [`optional`](#optional)
    - [`map`](#map)
    - [`either`](#either)
  - [Recursive decoding: `lazy`](#recursive-decoding-lazy)
  - [`repr`](#repr)
    - [Output for sensitive data](#output-for-sensitive-data)
- [Comparison with nvie/decoders](#comparison-with-nviedecoders)
  - [Error messages](#error-messages)
- [Development](#development)
  - [npm scripts](#npm-scripts)
  - [Directories](#directories)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
<!-- prettier-ignore-end -->

## Installation

```
npm install tiny-decoders
```

## Intro

The central concept in tiny-decoders is the _decoder._ It’s a function that turns `unknown` (for Flow users: `mixed`) into some narrower type, or throws an error.

For example, there’s a decoder called `string` (`(value: unknown) => string`) that returns a string if the input is a string, and throws a `TypeError` otherwise. That’s all there is to a decoder!

tiny-decoders contains:

- [A bunch of decoders.][primitive-decoders]
- [A bunch of functions that _return_ a decoder.][returns-decoders]

Composing those functions together, you can _describe_ the shape of your objects and let tiny-decoders extract data that matches that description from a given input.

Note that tiny-decoders is all about _extracting data,_ not validating that input _exactly matches_ a schema.

## A note on type annotations

Most of the time, you don’t need to write any type annotations for decoders (but some examples in the API documentation show them explicitly for clarity).

However, adding type annotations for record decoders results in much better error messages. The following is the recommended way of annotating record decoders in TypeScript:

```ts
import { fields, autoRecord } from "tiny-decoders";

type Person = {
  name: string;
  age: number;
};

const personDecoder = fields(
  (field): Person => ({
    name: field("name", string),
    age: field("age", number),
  })
);

const personDecoderAuto = autoRecord<Person>({
  name: string,
  age: number,
});
```

In TypeScript, you can also write it like this:

```ts
const personDecoder = fields((field) => ({
  name: field("name", string),
  age: field("age", number),
}));

const personDecoderAuto = autoRecord({
  name: string,
  age: number,
});

type Person = ReturnType<typeof personDecoder>;
// or:
type Person = ReturnType<typeof personDecoderAuto>;
```

In Flow, annotate like this:

```js
import { fields, autoRecord } from "tiny-decoders";

type Person = {
  name: string,
  age: number,
};

const personDecoder = fields((field): Person => ({
  name: field("name", string),
  age: field("age", number),
}));
// or:
const personDecoder2: Decoder<Person> = fields((field) => ({
  name: field("name", string),
  age: field("age", number),
}));

const personDecoderAuto: Decoder<Person> = autoRecord({
  name: string,
  age: number,
});
```

See the [TypeScript type annotations example][typescript-type-annotations] and the [Flow type annotations example][example-type-annotations] for more information, tips and caveats.

## API

### The `Decoder<T>` type

```ts
export type Decoder<T> = (value: unknown, errors?: Array<string>) => T;
```

This is a handy type alias for decoder functions.

Note that simple decoders that do not take an optional `errors` array are also allowed by the above defintion:

```ts
(value: unknown) => T;
```

The type definition does not show that decoder functions throw `TypeError`s when the input is invalid, but do keep that in mind.

### Primitive decoders

> Booleans, numbers and strings, plus [constant].

Related: [Decoding `unknown` values.][example-mixed]

#### `boolean`

```ts
export function boolean(value: unknown): boolean;
```

Returns `value` if it is a boolean and throws a `TypeError` otherwise.

#### `number`

```ts
export function number(value: unknown): number;
```

Returns `value` if it is a number and throws a `TypeError` otherwise.

#### `string`

```ts
export function string(value: unknown): string;
```

Returns `value` if it is a string and throws a `TypeError` otherwise.

#### `constant`

```ts
export function constant<
  T extends boolean | number | string | undefined | null
>(constantValue: T): (value: unknown) => T;
```

Returns a decoder. That decoder returns `value` if `value === constantValue` and throws a `TypeError` otherwise.

Commonly used when [Decoding by type name][example-decoding-by-type-name] to prevent mixups.

### Functions that _return_ a decoder

> Decode arrays, objects and optional values. Combine decoders and functions.

For an array, you need to not just make sure that the value is an array, but also that every item _inside_ the array has the correct type. Same thing for objects (the values need to be checked). For these kinds of cases you need to _combine_ decoders. This is done through functions that take a decoder as input and returns a new decoder. For example, `array(string)` returns a decoder that handles arrays of strings.

Note that there is no `object` decoder, because there are two ways of decoding objects:

- If you know all the keys, use [fields] or [autoRecord].
- If the keys are dynamic and all values have the same type, use [dict].

Some languages also have _tuples_ in addition to arrays. Both TypeScript and Flow lets you use arrays as tuples if you want, which is also common in JSON. Use [fields], [pair] and [triple] to decode tuples.

All decoders that work with objects also accept arrays, because arrays are objects too.

#### Tolerant decoding

Since arrays and objects can hold multiple values, their decoders allow opting into tolerant decoding, where you can recover from errors, either by skipping values or providing defaults. Whenever that happens, the message of the error that would otherwise have been thrown is pushed to an `errors` array (`Array<string>`, if provided), allowing you to inspect what was ignored. (Perhaps not the most beautiful API, but very simple.)

For example, if you pass an `errors` array to a [fields] decoder, it will both push to the array and pass it along to its sub-decoders so they can push to it as well.

#### `array`

```ts
export function array<T, U = T>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U }
): Decoder<Array<T | U>>;
```

Takes a decoder as input, and returns a new decoder. The new decoder checks that its `unknown` input is an array (or array-like object), and then runs the _input_ decoder on every item. What happens if decoding one of the items fails depends on the `mode`:

- `"throw"` (default): Throws a `TypeError` on the first invalid item.
- `"skip"`: Items that fail are ignored. This means that the decoded array can be shorter than the input array – even empty! Error messages are pushed to the `errors` array, if present.
- `{ default: U }`: The passed default value is used for items that fail. The decoded array will always have the same length as the input array. Error messages are pushed to the `errors` array, if present.

If no error was thrown, `Array<T>` is returned (or `Array<T | U>` if you use the `{ default: U }` mode).

An array-like object is an object with a `length` property which is a number (unsigned 32-bit integer). The decoder will go through all integers from 0 to (but not including) `length`.

Example:

```ts
import { array, string } from "tiny-decoders";

const arrayOfStringsDecoder1: Decoder<Array<string>> = array(string);
const arrayOfStringsDecoder2: Decoder<Array<string>> = array(string, "skip");
const arrayOfStringsDecoder3: Decoder<Array<string>> = array(string, {
  default: "",
});

// Decode an array of strings:
arrayOfStringsDecoder1(["a", "b", "c"]);

// Optionally collect error messages when `mode` isn’t `"throw"`:
const errors = [];
arrayOfStringsDecoder2(["a", 0, "c"], errors);

// Decode an array-like object, such as `Buffer`.
const bufferDecoder: Decoder<Array<number>> = array(number);
bufferDecoder(Buffer.from("hi"));
```

#### `dict`

```ts
export function dict<T, U = T>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U }
): Decoder<{ [key: string]: T | U }>;
```

Takes a decoder as input, and returns a new decoder. The new decoder checks that its `unknown` input is an object, and then goes through all keys in the object and runs the _input_ decoder on every value. What happens if decoding one of the key-values fails depends on the `mode`:

- `"throw"` (default): Throws a `TypeError` on the first invalid item.
- `"skip"`: Items that fail are ignored. This means that the decoded object can have fewer keys than the input object – it can even be empty! Error messages are pushed to the `errors` array, if present.
- `{ default: U }`: The passed default value is used for items that fail. The decoded object will always have the same set of keys as the input object. Error messages are pushed to the `errors` array, if present.

If no error was thrown, `{ [key: string]: T }` is returned (or `{ [key: string]: T | U }` if you use the `{ default: U }` mode).

```ts
import { dict, string } from "tiny-decoders";

const dictOfStringsDecoder1: Decoder<{ [key: string]: string }> = dict(string);
const dictOfStringsDecoder2: Decoder<{ [key: string]: string }> = dict(
  string,
  "skip"
);
const dictOfStringsDecoder3: Decoder<{ [key: string]: string }> = dict(string, {
  default: "",
});

// Decode an object of strings:
dictOfStringsDecoder1({ a: "1", b: "2" });

// Optionally collect error messages when `mode` isn’t `"throw"`:
const errors = [];
dictOfStringsDecoder2({ a: "1", b: 0 }, errors);
```

#### `fields`

```ts
export function fields<T>(
  callback: (
    field: <U, V = U>(
      key: string | number,
      decoder: Decoder<U>,
      mode?: "throw" | { default: V }
    ) => U | V,
    fieldError: (key: string | number, message: string) => TypeError,
    obj: { readonly [key: string]: unknown },
    errors?: Array<string>
  ) => T
): Decoder<T>;
```

Takes a callback function as input, and returns a new decoder. The new decoder checks that its `unknown` input is an object, and then calls the callback (the object is passed as the `obj` parameter). The callback receives a `field` function that is used to pluck values out of object. The callback is allowed to return anything, and that is the `T` of the decoder.

`field("key", decoder)` essentially runs `decoder(obj["key"])` but with better error messages and automatic handling of the `errors` array, if provided. The nice thing about `field` is that it does _not_ return a new decoder – but the value of that field! This means that you can do for instance `const type: string = field("type", string)` and then use `type` however you want inside your callback.

`fieldError("key", "message")` creates an error message for a certain key. `throw fieldError("key", "message")` gives an error that lets you know that something is wrong with `"key"`, while `throw new TypeError("message")` would not be as clear. Useful when [Decoding by type name][example-decoding-by-type-name].

`obj` and `errors` are passed in case you’d need them for some edge case, such as if you need to [distinguish between undefined, null and missing values][example-missing-values].

Note that if your input object and the decoded object look exactly the same and you don’t need any advanced features it’s often more convenient to use [autoRecord].

Also note that you can return any type from the callback, not just objects. If you’d rather have a tuple you could return that – see [Decoding tuples][example-tuples]. Most tuples are 2 or 3 in length. If you want to decode such a tuple into a TypeScript/Flow tuple it’s usually more convenient to use [pair] and [triple].

```ts
import { Decoder, tuple, number, string } from "tiny-decoders";

type Person = {
  firstName: string;
  lastName: string;
  age: number;
  description: string;
};

// Decoding a tuple into a record:
const personDecoder = tuple(
  (item): Person => ({
    firstName: item(0, string),
    lastName: item(1, string),
    age: item(2, number),
    description: item(3, string),
  })
);

// Taking the first number from an array:
const firstNumberDecoder: Decoder<number> = tuple((item) => item(0, number));
```

```ts
import {
  Decoder,
  fields,
  boolean,
  number,
  string,
  optional,
  repr,
} from "tiny-decoders";

type User = {
  age: number;
  active: boolean;
  name: string;
  description: string | undefined;
  legacyId: string | undefined;
  version: 1;
};

const userDecoder = fields(
  (field): User => ({
    // Simple field:
    age: field("age", number),
    // Renaming a field:
    active: field("is_active", boolean),
    // Combining two fields:
    name: `${field("first_name", string)} ${field("last_name", string)}`,
    // Optional field:
    description: field("description", optional(string)),
    // Allowing a field to fail:
    legacyId: field("extra_data", number, { default: undefined }),
    // Hardcoded field:
    version: 1,
  })
);

const userData: unknown = {
  age: 30,
  is_active: true,
  first_name: "John",
  last_name: "Doe",
};

// Decode a user:
userDecoder(userData);

// Optionally collect error messages from fields where `mode` isn’t `"throw"`:
const errors = [];
userDecoder(userData, errors);

// `fields` can also be used for arrays/tuples:
const userTupleDecoder = fields(
  (field): User => ({
    // You can use numbers as keys. It makes no difference, but is convenient
    // when decoding arrays/tuples.
    age: field(0, number),
    active: field(1, boolean),
    name: `${field(2, string)} ${field(3, string)}`,
    description: field(4, optional(string)),
    legacyId: field(5, number, { default: undefined }),
    version: 1,
  })
);

const userTuple: unknown = [30, true, "John", "Doe"];

// Decode a user tuple:
userTupleDecoder(userTuple);

type Shape =
  | {
      type: "Circle";
      radius: number;
    }
  | {
      type: "Rectangle";
      width: number;
      height: number;
    };

// Decoding by type name:
const shapeDecoder = fields(
  (field): Shape => {
    const type = field("type", string);
    switch (type) {
      case "Circle":
        return {
          type: "Circle",
          radius: field("radius", number),
        };

      case "Rectangle":
        return {
          type: "Rectangle",
          width: field("width", number),
          height: field("height", number),
        };

      default:
        throw fieldError("type", `Invalid Shape type: ${repr(type)}`);
    }
  }
);

// Plucking a single field out of an object:
const ageDecoder: Decoder<number> = fields((field) => field("age", number));

// Taking the first number from an array:
const firstNumberDecoder: Decoder<number> = tuple((field) => field(0, number));
```

#### `pair`

```ts
export function pair<T1, T2>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>
): Decoder<[T1, T2]>;
```

A convenience function around [fields] when you want to decode `[x, y]` into `[T1, T2]`.

```ts
import { Decoder, pair, number } from "tiny-decoders";

const pointDecoder: Decoder<[number, number]> = pair(number, number);
```

See also [Decoding tuples][example-tuples].

#### `triple`

```ts
export function triple<T1, T2, T3>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>,
  decoder3: Decoder<T3>
): Decoder<[T1, T2, T3]>;
```

A convenience function around [fields] when you want to decode `[x, y, z]` into `[T1, T2, T3]`.

```ts
import { Decoder, triple, number } from "tiny-decoders";

const coordinateDecoder: Decoder<[number, number, number]> = pair(
  number,
  number,
  number
);
```

See also [Decoding tuples][example-tuples].

#### `autoRecord`

```ts
export function autoRecord<T>(
  mapping: { [key in keyof T]: Decoder<T[key]> }
): Decoder<T>;
```

Suppose you have a record `T`. Now make an object that looks just like `T`, but where every value is a decoder for its key. `autoRecord` takes such an object – called `mapping` – as input and returns a new decoder. The new decoder checks that its `unknown` input is an object, and then goes through all the key-decoder pairs in the `mapping`. For every key, `mapping[key](value[key])` is run. If all of that succeeds it returns a `T`, otherwise it throws a `TypeError`.

Example:

```ts
import { autoRecord, boolean, number, string } from "tiny-decoders";

type User = {
  name: string;
  age: number;
  active: boolean;
};

const userDecoder = autoRecord<User>({
  name: string,
  age: number,
  active: boolean,
});
```

Notes:

- `autoRecord` is a convenience function instead of [fields]. Check out [fields] if you need more flexibility, such as renaming fields!

- The `unknown` input value we’re decoding is allowed to have extra keys not mentioned in the `mapping`. I haven’t found a use case where it is useful to disallow extra keys. This package is about extracting data in a type-safe way, not validation.

- Want to _add_ some extra keys? Checkout the [extra fields][example-extra-fields] example.

#### `deep`

```ts
export function deep<T>(
  path: Array<string | number>,
  decoder: Decoder<T>
): Decoder<T>;
```

Takes an array of keys (object keys, and array indexes) and a decoder as input, and returns a new decoder. It repeatedly goes deeper and deeper into its `unknown` input using the given `path`. If all of those checks succeed it returns `T`, otherwise it throws a `TypeError`.

`deep` is used to pick a one-off value from a deep structure, rather than having to decode each level manually with [fields]. See the [Deep example][example-deep].

Note that `deep([], decoder)` is equivalent to just `decoder`.

You might want to [combine `deep` with `either`][example-deep] since reaching deeply into structures is likely to fail.

Examples:

```ts
import { deep, number, either } from "tiny-decoders";

const accessoryPriceDecoder: Decoder<number> = deep(
  ["store", "products", 0, "accessories", 0, "price"],
  number
);

const accessoryPriceDecoderWithDefault: Decoder<number> = either(
  accessoryPriceDecoder,
  () => 0
);
```

#### `optional`

```ts
export function optional<T>(decoder: Decoder<T>): Decoder<T | undefined>;
export function optional<T, U>(
  decoder: (value: unknown) => T,
  defaultValue: U
): (value: unknown) => T | U;
```

Takes a decoder as input, and returns a new decoder. The new decoder returns `defaultValue` if its `unknown` input is undefined or null, and runs the _input_ decoder on the `unknown` otherwise. (If you don’t supply `defaultValue`, undefined is used as the default.)

This is especially useful to mark fields as optional in [fields] or [autoRecord]:

```ts
import { autoRecord, optional, boolean, number, string } from "tiny-decoders";

type User = {
  name: string;
  age: number | undefined;
  active: boolean;
};

const userDecoder = autoRecord<User>({
  name: string,
  age: optional(number),
  active: optional(boolean, true),
});
```

In the above example:

- `.name` must be a string.
- `.age` is allowed to be undefined, null or missing (defaults to `undefined`).
- `.active` defaults to `true` if it is undefined, null or missing.

If the need should ever arise, check out the example on how to [distinguish between undefined, null and missing values][example-missing-values]. tiny-decoders treats undefined, null and missing values the same by default, to keep things simple.

#### `map`

```ts
export function map<T, U>(
  decoder: Decoder<T>,
  fn: (value: T, errors?: Array<string>) => U
): Decoder<U>;
```

Takes a decoder and a function as input, and returns a new decoder. The new decoder runs the _input_ decoder on its `unknown` input, and then passes the result to the provided function. That function can return a transformed result. It can also be another decoder. If all of that succeeds it returns `U` (the return value of `fn`), otherwise it throws a `TypeError`.

Example:

```ts
import { Decoder, map, array, autoRecord, fields, number } from "tiny-decoders";

const numberSetDecoder: Decoder<Set<number>> = map(
  array(number),
  (arr) => new Set(arr)
);

const nameDecoder: Decoder<string> = map(
  autoRecord({
    firstName: string,
    lastName: string,
  }),
  ({ firstName, lastName }) => `${firstName} ${lastName}`
);

// But the above is actually easier with `fields`:
const nameDecoder2: Decoder<string> = fields(
  (field) => `${field("firstName", string)} ${field("lastName", string)}`
);
```

Full examples:

- [Decoding Sets][example-sets]
- [Decoding tuples][example-tuples]
- [Adding extra fields][example-extra-fields]
- [Renaming fields][example-renaming-fields]
- [Custom decoders][example-custom-decoders]

#### `either`

```ts
export function either<T, U>(
  decoder1: Decoder<T>,
  decoder2: Decoder<U>
): Decoder<T | U>;
```

Takes two decoders as input, and returns a new decoder. The new decoder tries to run the _first_ input decoder on its `unknown` input. If that succeeds, it returns `T`, otherwise it tries the _second_ input decoder. If _that_ succeeds it returns `U`, otherwise it throws a `TypeError`.

Example:

```ts
import { Decoder, either, number, string } from "tiny-decoders";

const stringOrNumberDecoder: Decoder<string | number> = either(string, number);
```

What if you want to try _three_ (or more) decoders? You’ll need to nest another `either`:

```ts
import { Decoder, either, boolean, number, string } from "tiny-decoders";

const weirdDecoder: Decoder<string | number | boolean> = either(
  string,
  either(number, boolean)
);
```

That’s perhaps not very pretty, but not very common either. It would of course be possible to add functions like `either2`, `either3`, etc, but I don’t think it’s worth it.

You can also use `either` [distinguish between undefined, null and missing values][example-missing-values].

### Recursive decoding: `lazy`

```ts
export function lazy<T>(callback: () => Decoder<T>): Decoder<T>;
```

Takes a callback function that returns a decoder as input, and returns a new decoder. The new decoder runs the callback function to get the _input_ decoder, and then runs the input decoder on its `unknown` input. If that succeeds it returns `T` (the return value of the input decoder), otherwise it throws a `TypeError`.

`lazy` lets you decode recursive structures. `lazy(() => decoder)` is equivalent to just `decoder`, but lets you use `decoder` before it has been defined yet (which is the case for recursive structures). So all `lazy` is doing is allowing you to wrap a decoder in an “unnecessary” arrow function, delaying the reference to the decoder until it’s safe to access in JavaScript. In other words, you make a _lazy_ reference – one that does not evaluate until the last minute.

Since [fields] takes a callback itself, lazy is not needed most of the time. But `lazy` can come in handy for [array] and [dict].

See the [Recursive example][example-recursive] to learn when and how to use this decoder.

### `repr`

```ts
export function repr(
  value: unknown,
  options?: {
    recurse?: boolean;
    maxArrayChildren?: number;
    maxObjectChildren?: number;
    maxLength?: number;
    recurseMaxLength?: number;
  }
): string;
```

Takes any value, and returns a string representation of it for use in error messages. Useful when making [custom decoders][example-custom-decoders].

Options:

| name | type | default | description |
| --- | --- | --- | --- |
| recurse | `boolean` | `true` | Whether to recursively call `repr` on array items and object values. It only recurses once. |
| maxArrayChildren | `number` | `5` | The number of array items to print (when `recurse` is `true`.) |
| maxObjectChildren | `number` | `3` | The number of object key-values to print (when `recurse` is `true`.) |
| maxLength | `number` | `100` | The maximum length of literals, such as strings, before truncating them. |
| recurseMaxLength | `number` | `20` | Like `maxLength`, but when recursing. One typically wants shorter lengths here to avoid overly long error messages. |

Example:

```ts
import { repr } from "tiny-decoders";

type Alignment = "top" | "right" | "bottom" | "left";

function alignmentDecoder(value: string): Alignment {
  switch (value) {
    case "top":
    case "right":
    case "bottom":
    case "left":
      return value;
    default:
      throw new TypeError(`Expected an Alignment, but got: ${repr(value)}`);
  }
}
```

This function returns _a_ string, but what that string looks like is not part of the public API.

#### Output for sensitive data

By default, the tiny-decoder’s error messages try to be helpful by showing you the actual values that failed decoding to make it easier to understand what happened. However, if you’re dealing with sensitive data, such as email addresses, passwords or social security numbers, you might not want that data to potentially appear in error logs.

By setting `repr.sensitive = true` you will get error messages containing only _where_ the error happened and the actual and expected types, but not showing any actual values.

Standard:

```
object["details"]["ssn"]: Expected a string, but got: 123456789
```

With `repr.sensitive = true`:

```
object["details"]["ssn"]: Expected a string, but got: number
```

All decoders use `repr` internally when making their error messages, so setting `repr.sensitive` affect them too. This is admittedly not the most beautiful API, but it is tiny.

If you need _both_ standard _and_ sensitive output in the same application – remember that `repr.sensitive = true` globally affects everything. You’ll need to flip `repr.sensitive` back and forth as needed.

## Comparison with nvie/decoders

|  | [nvie/decoders] | tiny-decoders |
| --- | --- | --- |
| Size | [![minified size][min-decoders]<br>![minzipped size][minzip-decoders]][bundlephobia-decoders] | [![minified size][min-tiny-decoders]<br>![minzipped size][minzip-tiny-decoders]][bundlephobia-tiny-decoders] |
| Dependencies | ![has dependencies][deps-decoders] | ![no dependencies][deps-tiny-decoders] |
| Error messages | Really fancy | Kinda good (size tradeoff) |
| Built-in functions | Type checking + validation (regex, email) | Type checking only (validation can be plugged in) |
| Decoders… | …return [Result]s or throw errors | …only throw errors |

In other words:

- [nvie/decoders]: Larger API, fancier error messages, larger size.
- tiny-decoders: Smaller (and slightly different) API, kinda good error messages, smaller size.

### Error messages

The error messages of [nvie/decoders] are really nice, but also quite verbose:

```
Decoding error:
[
  {
    "id": "512971",
    "name": "Ergonomic Mouse",
    "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
    "price": 499,
    "accessories": [],
  },
  {
    "id": "382973",
    "name": "Ergonomic Keyboard",
    "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
    "price": 998,
    "accessories": [
      {
        "name": "Keycap Puller",
        "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
        "discount": "5%",
                    ^^^^
                    Either:
                    - Must be null
                    - Must be number
      },
      ^ Missing key: "id" (at index 0)
      {
        "id": 892873,
        "name": "Keycap Set",
        "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
        "discount": null,
      },
    ],
  },
  ^ index 1
  {
    "id": "493673",
    "name": "Foot Pedals",
    "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
    "price": 299,
    "accessories": [],
  },
]
```

The errors of tiny-decoders are way shorter. As opposed to [nvie/decoders], it stops at the _first_ error in a record (instead of showing them all). First, the missing “id” field:

```
TypeError: array[1]["accessories"][0]["id"]: Expected a string, but got: undefined
```

And if we add an “id” we get the “discount” error:

```
TypeError: array[1]["accessories"][0]["discount"]: (optional) Expected a number, but got: "5%"
```

tiny-decoders used to also print a “stack trace,” showing you a little of each parent object and array. After using tiny-decoders for a while I noticed this not being super useful. It’s nicer to look at the whole object in a tool of choice, and just use the error message to understand _where_ the error is, and what is wrong.

## Development

You need [Node.js] 12 and npm 6.

### npm scripts

- `npx flow`: Run [Flow].
- `npm run eslint`: Autofix [ESLint] errors.
- `npm run dtslint`: Run [dtslint].
- `npm run prettier`: Run [Prettier] for files other than JS.
- `npm run doctoc`: Run [doctoc] on README.md.
- `npx jest --watch`: Run unit tests.
- `npm run build`: Compile with [Babel].
- `npm test`: Check that everything works.

### Directories

- `src/`: Source code.
- `examples/`: Examples, in the form of [Jest] tests.
- `test/`: [Jest] tests.
- `flow/`: [Flow] typechecking tests. Turn off “ExpectError” in .flowconfig to see what the errors look like.
- `typescript/`: [TypeScript] type definitions, config and typechecking tests.
- `dist/`: Compiled code, built by `npm run build`. This is what is published in the npm package.

## License

[MIT](LICENSE)

[array]: #array
[autorecord]: #autoRecord
[babel]: https://babeljs.io/
[bundlephobia-decoders]: https://bundlephobia.com/result?p=decoders
[constant]: #constant
[deps-decoders]: https://img.shields.io/david/nvie/decoders.svg
[dict]: #dict
[doctoc]: https://github.com/thlorenz/doctoc/
[dtslint]: https://github.com/Microsoft/dtslint/
[elm-map]: https://package.elm-lang.org/packages/elm/json/latest/Json-Decode#mapping
[eslint]: https://eslint.org/
[example-allow-failures]: https://github.com/lydell/tiny-decoders/blob/master/examples/allow-failures.test.js
[example-custom-decoders]: https://github.com/lydell/tiny-decoders/blob/master/examples/custom-decoders.test.js
[example-decoding-by-type-name]: https://github.com/lydell/tiny-decoders/blob/master/examples/decoding-by-type-name.test.js
[example-deep]: https://github.com/lydell/tiny-decoders/blob/master/examples/deep.test.js
[example-extra-fields]: https://github.com/lydell/tiny-decoders/blob/master/examples/extra-fields.test.js
[example-missing-values]: https://github.com/lydell/tiny-decoders/blob/master/examples/missing-values.test.js
[example-mixed]: https://github.com/lydell/tiny-decoders/blob/master/examples/mixed.test.js
[example-recursive]: https://github.com/lydell/tiny-decoders/blob/master/examples/recursive.test.js
[example-renaming-fields]: https://github.com/lydell/tiny-decoders/blob/master/examples/renaming-fields.test.js
[example-sets]: https://github.com/lydell/tiny-decoders/blob/master/examples/sets.test.js
[example-tuples]: https://github.com/lydell/tiny-decoders/blob/master/examples/tuples.test.js
[example-type-annotations]: https://github.com/lydell/tiny-decoders/blob/master/examples/type-annotations.test.js
[fields]: #fields
[jest]: https://jestjs.io/
[map]: #map
[min-decoders]: https://img.shields.io/bundlephobia/min/decoders.svg
[minzip-decoders]: https://img.shields.io/bundlephobia/minzip/decoders.svg
[minzip-tiny-decoders]: https://img.shields.io/bundlephobia/minzip/tiny-decoders.svg
[mixedarray]: #mixedarray
[mixeddict]: #mixeddict
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[pair]: #pair
[prettier]: https://prettier.io/
[primitive-decoders]: #primitive-decoders
[result]: https://github.com/nvie/lemons.js#result
[returns-decoders]: #functions-that-return-a-decoder
[triple]: #triple
[typescript-type-annotations]: https://github.com/lydell/tiny-decoders/blob/master/typescript/type-annotations.ts
