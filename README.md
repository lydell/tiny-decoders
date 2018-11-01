# tiny-decoders [![Build Status][travis-badge]][travis-link] ![no dependencies][deps-tiny-decoders] [![minified size][min-tiny-decoders]][bundlephobia-tiny-decoders]

Type-safe data decoding for the minimalist, inspired by [nvie/decoders] and
[Elm’s JSON Decoders][elm-json].

Supports [Flow] and [TypeScript].

## Contents

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Example](#example)
- [Intro](#intro)
- [API](#api)
  - [Decoding primitive values](#decoding-primitive-values)
    - [`boolean`](#boolean)
    - [`number`](#number)
    - [`string`](#string)
    - [`constant`](#constant)
  - [Decoding combined values](#decoding-combined-values)
    - [`array`](#array)
    - [`dict`](#dict)
    - [`record`](#record)
    - [`optional`](#optional)
  - [Decoding specific fields](#decoding-specific-fields)
    - [`field`](#field)
    - [`fieldDeep`](#fielddeep)
    - [`group`](#group)
  - [Chaining](#chaining)
    - [`either`](#either)
    - [`map`](#map)
    - [`andThen`](#andthen)
    - [`fieldAndThen`](#fieldandthen)
  - [Less common decoders](#less-common-decoders)
    - [`lazy`](#lazy)
    - [`mixedArray`](#mixedarray)
    - [`mixedDict`](#mixeddict)
  - [`repr`](#repr)
- [Comparison with nvie/decoders](#comparison-with-nviedecoders)
  - [Error messages](#error-messages)
- [Development](#development)
  - [npm scripts](#npm-scripts)
  - [Directories](#directories)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
<!-- prettier-ignore-end -->

## Installation

Not yet :)

## Example

```js
import {
  array,
  boolean,
  either,
  number,
  optional,
  record,
  string,
} from "tiny-decoders";

type User = {|
  name: string,
  active: boolean,
  age: ?number,
  interests: Array<string>,
  id: string | number,
|};

const userDecoder: (mixed) => User = record({
  name: string,
  active: boolean,
  age: optional(number),
  interests: array(string),
  id: either(string, number),
});

const payload: mixed = getSomeJSON();

const user: User = userDecoder(payload);

/*
If we get here, `user` is now a valid `User`!
Otherwise, a `TypeError` is thrown.
The error can look like this:

    TypeError: object["age"]: (optional) Expected a number, but got: "30"
    at "age" in {"age": "30", "name": "John Doe", "active": true, (2 more)}
*/
```

[Full example][example-readme]

## Intro

The central concept in tiny-decoders is the _decoder._ It’s a function that
turns `mixed` into some narrower type (`(mixed) => T`), or throws an error.

For example, there’s a decoder called `string` (`(mixed) => string`) that
returns a string if the input is a string, and throws a `TypeError` otherwise.
That’s all there is to a decoder!

tiny-decoders contains:

- A bunch of decoders (such as `(mixed) => string`).
- A bunch of functions that _return_ a decoder (such as `array`:
  `((mixed) => T) => (mixed) => Array<T>`).

Composing those functions together, you can _describe_ the shape of your objects
and let tiny-decoders verify that a given input matches that description.

## API

### Decoding primitive values

> Booleans, numbers and strings, plus [constant].

#### `boolean`

`(value: mixed) => boolean`

Returns `value` if it is a boolean and throws a `TypeError` otherwise.

#### `number`

`(value: mixed) => number`

Returns `value` if it is a number and throws a `TypeError` otherwise.

#### `string`

`(value: mixed) => string`

Returns `value` if it is a string and throws a `TypeError` otherwise.

#### `constant`

`(constantValue: T) => (value: mixed) => T`

`T` must be one of `boolean | number | string | undefined | null`.

Returns a decoder. That decoder returns `value` if `value === constantValue` and
throws a `TypeError` otherwise.

Commonly used when [Decoding by type name][example-decoding-by-type-name].

### Decoding combined values

> Arrays, objects and optional values.

For an array, you need to not just make sure that the value is an array, but
also that every item _inside_ the array has the correct type. Same thing for
objects (the values need to be checked). For this kind of cases you need to
_combine_ decoders. This is done through functions that take a decoder as input
and returns a new decoder. For example, `array(string)` returns a decoder that
handles arrays of strings.

Note that there is no `object` decoder, because there are two ways of decoding
objects:

- If you know all the keys, use [record].
- If the keys are dynamic and all values have the same type, use [dict].

Related:

- [Decoding tuples][example-tuples]
- The less common decoders [mixedArray] and [mixedDict].

#### `array`

`(decoder: (mixed) => T) => (value: mixed) => Array<T>`

Takes a decoder as input, and returns a new decoder. The new decoder checks that
`value` is an array, and then runs the _input_ decoder on every item. If all of
that succeeds it returns `Array<T>`, otherwise it throws a `TypeError`.

Example:

```js
import { array, string } from "tiny-decoders";

const arrayOfStringsDecoder: (mixed) => Array<string> = array(string);
```

#### `dict`

`(decoder: (mixed) => T) => (value: mixed) => { [string]: T }`

Takes a decoder as input, and returns a new decoder. The new decoder checks that
`value` is an object, and then goes through all keys in the object and runs the
_input_ decoder on every value. If all of that succeeds it returns
`{ [string]: T }`, otherwise it throws a `TypeError`.

```js
import { dict, string } from "tiny-decoders";

const dictOfStringsDecoder: (mixed) => { [string]: T } = dict(string);
```

#### `record`

`(mapping: Mapping) => (value: mixed) => Result`

- `Mapping`:

  ```
  {
    key1: (mixed) => A,
    key2: (mixed) => B,
    ...
    keyN: (mixed) => C,
  }
  ```

- `Result`:

  ```
  {
    key1: A,
    key2: B,
    ...
    keyN: C,
  }
  ```

Takes a “Mapping” as input, and returns a decoder. The new decoder checks that
`value` is an object, and then goes through all the key-decoder pairs in the
_Mapping._ For every key, the value of `value[key]` must match the key’s
decoder. If all of that succeeds it returns “Result,” otherwise it throws a
`TypeError`. The Result is identical to the Mapping, except all the `(mixed) =>`
are gone, so to speak.

Example:

```js
import { record, string, number, boolean } from "tiny-decoders";

type User = {|
  name: string,
  age: number,
  active: boolean,
|};

const userDecoder: (mixed) => User = record({
  name: string,
  age: number,
  active: boolean,
});
```

Notes:

- `record` is a convenience function around [group] and [field]. Check those out
  if you need more flexibility, such as renaming fields!

- The `value` we’re decoding is allowed to have extra keys not mentioned in the
  `record` mapping. I haven’t found a use case where it is useful to disallow
  extra keys. This package is about extracting data in a type-safe way, not
  validation.

- Want to _add_ some extra keys? Checkout the [extra
  fields][example-extra-fields] example.

- There’s a way to let Flow infer types from your record decoders (or any
  decoder actually) if you want to take the DRY principle to the extreme – see
  the [inference example][example-inference].

- The _actual_ type annotation for this function is a bit weird but does its job
  (with good error messages!) – check out the source code if you’re interested.

#### `optional`

`(decoder: (mixed) => T, defaultValue?: U) => (value: mixed) => Array<T | U>`

Takes a decoder as input, and returns a new decoder. The new decoder returns
`defaultValue` if `value` is undefined or null, and runs the _input_ decoder on
`value` otherwise. (If you don’t supply `defaultValue`, undefined is used as the
default.)

This is especially useful to mark fields as optional in a [record]:

```js
import { optional, record, string, number, boolean } from "tiny-decoders";

type User = {|
  name: string,
  age: ?number,
  active: boolean,
|};

const userDecoder: (mixed) => User = record({
  name: string,
  age: optional(number),
  active: optional(boolean, true),
});
```

In the above example:

- `.name` must be a string.
- `.age` is allowed to be undefined, null or missing (defaults to `undefined`).
- `.active` defaults to `true` if it is undefined, null or missing.

If the need should ever arise, check out the example on how to [distinguish
between undefined, null and missing values][example-missing-values].
tiny-decoders treats undefined, null and missing values the same by default, to
keep things simple.

### Decoding specific fields

> Parts of objects and arrays, plus [group].

#### `field`

`(key: string | number, decoder: (mixed) => T) => (value: mixed) => T`

Takes a key (object key, or array index) and a decoder as input, and returns a
new decoder. The new decoder checks that `value` is an object (if key is a
string) or an array (if key is a number), and runs the _input_ decoder on
`value[key]`. If both of those checks succeed it returns `T`, otherwise it
throws a `TypeError`.

This lets you pick a single value out of an object or array.

`field` is typically used with [group].

Examples:

```js
import { field, group, string, number } from "tiny-decoders";

type Person = {|
  firstName: string,
  lastName: string,
|};

// You can use `field` with `group` to rename keys on a record.
const personDecoder = (mixed) =>
  (Person = group({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
  }));

type Point = {|
  x: number,
  y: number,
|};

// If you want to pick out items at certain indexes of an array, treating it
// is a tuple, use `field` and save the results in a `group`.
// This will decode `[4, 7]` into `{ x: 4, y: 7 }`.
const pointDecoder: (mixed) => Point = group({
  x: field(0, number),
  y: field(1, number),
});
```

Full examples:

- [Decoding tuples][example-tuples]
- [Renaming fields][example-renaming-fields]
- [Decoding by type name][example-decoding-by-type-name]

#### `fieldDeep`

`(keys: Array<string | number>, decoder: (mixed) => T) => (value: mixed) => T`

Takes an array of keys (object keys, and array indexes) and a decoder as input,
and returns a new decoder. It works like `field`, but repeatedly goes deeper and
deeper using the given `keys`. If all of those checks succeed it returns `T`,
otherwise it throws a `TypeError`.

`fieldDeep` is used to pick a one-off value from a deep structure, rather than
having to decode each level manually with [record] and [array].

Note that `fieldDeep([], decoder)` is equivalent to just `decoder`.

You probably want to [combine `fieldDeep` with `either`][example-allow-failures]
since reaching deeply into structures is likely to fail.

Examples:

```js
import { fieldDeep, number, either } from "tiny-decoders";

const accessoryPriceDecoder: (mixed) => number = fieldDeep(
  ["store", "products", 0, "accessories", 0, "price"],
  number
);

const accessoryPriceDecoderWithDefault: (mixed) => number = either(
  accessoryPriceDecoder,
  () => 0
);
```

#### `group`

`(mapping: Mapping) => (value: mixed) => Result`

- `Mapping`:

  ```
  {
    key1: (mixed) => A,
    key2: (mixed) => B,
    ...
    keyN: (mixed) => C,
  }
  ```

- `Result`:

  ```
  {
    key1: A,
    key2: B,
    ...
    keyN: C,
  }
  ```

Takes a “Mapping” as input, and returns a decoder. The new decoder goes through
all the key-decoder pairs in the _Mapping._ For every key-decoder pair, `value`
must match the decoder. (The keys don’t matter – all their decoders are run on
the same `value`). If all of that succeeds it returns “Result,” otherwise it
throws a `TypeError`. The Result is identical to the Mapping, except all the
`(mixed) =>` are gone, so to speak.

As you might have noticed, `group` has the exact same type annotation as
[record]. So what’s the difference? [record] is all about decoding objects with
certain keys. `group` is all about running several decoders on _the same value_
and saving the results. If all of the decoders in the Mapping succeed, an object
with named values is returned. Otherwise, a `TypeError` is thrown.

If you’re familiar with [Elm’s mapping functions][elm-map], `group` plus [map]
replaces all of those. For example, Elm’s `map3` function lets you run three
decoders. You are then given the result values in the same order, allowing you
to do something with them. With `group` you combine _any_ number of decoders,
and it lets you refer to the result values by name instead of order (reducing
the risk of mix-ups).

`group` is typically used with [field] to decode objects where you want to
rename the fields.

Example:

```js
import { group, field, string, number, boolean } from "tiny-decoders";

const userDecoder = group({
  firstName: field("first_name", string),
  lastName: field("last_name", string),
  age: field("age", number),
  active: field("active", boolean),
});
```

It’s also possible to [rename only some fields][example-renaming-fields] without
repetition if you’d like.

The _actual_ type annotation for this function is a bit weird but does its job
(with good error messages!) – check out the source code if you’re interested.

### Chaining

> Two decoders chained together in different ways, plus [map].

#### `either`

`(decoder1: (mixed) => T, decoder2: (mixed) => U) => (value: mixed) => T | U`

Takes two decoders as input, and returns a new decoder. The new decoder tries to
run the _first_ input decoder on `value`. If that succeeds, it returns `T`,
otherwise it tries the _second_ input decoder. If _that_ succeeds it returns
`U`, otherwise it throws a `TypeError`.

Example:

```js
import { either, string, number } from "tiny-decoders";

const stringOrNumberDecoder: (mixed) => string | number = either(
  string,
  number
);
```

What if you want to try _three_ (or more) decoders? You’ll need to nest another
`either`:

```js
import { either, string, number, boolean } from "tiny-decoders";

const weirdDecoder: (mixed) => string | number | boolean = either(
  string,
  either(number, boolean)
);
```

That’s perhaps not very pretty, but not very common either. It’s possible to
make `either2`, `either3`, etc functions, but I don’t think it’s worth it.

You can also use `either` to [allow decoders to fail][example-allow-failures]
and to [distinguish between undefined, null and missing
values][example-missing-values].

#### `map`

`(decoder: (mixed) => T, fn: (T) => U): (value: mixed) => U`

Takes a decoder and a function as input, and returns a new decoder. The new
decoder runs the _input_ decoder on `value`, and then passes the result to the
provided function. That function can return a transformed result. It can also be
another decoder. If all of that succeeds it returns `U` (the return value of
`fn`), otherwise it throws a `TypeError`.

Example:

```js
import { map, array, number } from "tiny-decoders";

const numberSetDecoder: (mixed) => Set<number> = map(
  array(number),
  (arr) => new Set(arr)
);

const nameDecoder: (mixed) => string = map(
  record({
    firstName: string,
    lastName: string,
  }),
  ({ firstName, lastName }) => `${firstName} ${lastName}`
);
```

Full examples:

- [Decoding Sets][example-sets]
- [Decoding tuples][example-custom-decoders]
- [Adding extra fields][example-extra-fields]
- [Renaming fields][example-custom-decoders]
- [Custom decoders][example-custom-decoders]

#### `andThen`

`(decoder: (mixed) => T, fn: (T) => (mixed) => U): (value: mixed) => U`

Takes a decoder and a function as input, and returns a new decoder. The new
decoder runs the _input_ decoder on `value`, and then passes the result to the
provided function. That function must return yet another decoder. That final
decoder is then run on the same `value` as before. If all of that succeeds it
returns `U`, otherwise it throws a `TypeError`.

This is used when you need to decode a value a little bit, _and then_ decode it
some more based on the first decoding result.

The most common case is to first decode a “type” field of an object, and then
choose a decoder based on that. Since that is so common, there’s actually a
special decoder for that – [fieldAndThen] – with a better error message.

So when do you need `andThen`? Here are some examples:

- When `fieldAndThen` isn’t enough: The second example in [Decoding by type
  name][example-decoding-by-type-name].
- If you ever have to [distinguish between undefined, null and missing
  values][example-missing-values].

#### `fieldAndThen`

`(key: string | number, decoder: (mixed) => T, fn: (T) => (mixed) => U) => (value: mixed) => U`

`fieldAndThen(key, decoder, fn)` is equivalent to
`andThen(field(key, decoder), fn)` but has a better error message. In other
words, it takes the combined parameters of [field] and [andThen] and returns a
new decoder.

See [Decoding by type name][example-decoding-by-type-name] for an example and
comparison with `andThen(field(key, decoder), fn)`.

### Less common decoders

> Recursive structures, and less precise objects and arrays.

Related:

- [Decoding `mixed` values][example-mixed]

#### `lazy`

`(fn: () => (mixed) => T) => (value: mixed) => T`

Takes a function that returns a decoder as input, and returns a new decoder. The
new decoder runs the function to get the _input_ decoder, and then runs the
input decoder on `value`. If that succeeds it returns `T` (the return value of
the input decoder), otherwise it throws a `TypeError`.

`lazy` lets you decode recursive structures. `lazy(() => decoder)` is equivalent
to just `decoder`, but let’s you use `decoder` before it has been defined yet
(which is the case for recursive structures). So all `lazy` is doing is allowing
you to wrap a decoder in an “unnecessary” arrow function, delaying the reference
to the decoder until it’s safe to access in JavaScript. In other words, you make
a _lazy_ reference – one that does not evaluate until the last minute.

Examples:

```js
import { lazy, record, array, string } from "tiny-decoders";

// A recursive data structure:
type Person = {|
  name: string,
  friends: Array<Person>,
|};

// Attempt one:
const personDecoder: (mixed) => Person = record({
  name: string,
  friends: array(personDecoder), // ReferenceError: personDecoder is not defined
});

// Attempt two:
const personDecoder: (mixed) => Person = record({
  name: string,
  friends: lazy(() => array(personDecoder)), // No errors!
});
```

[Full recursive example][example-recursive]

If you use the [no-use-before-define] ESLint rule, you need to disable it for
the `lazy` line:

```js
const personDecoder: (mixed) => Person = record({
  name: string,
  // eslint-disable-next-line no-use-before-define
  friends: lazy(() => array(personDecoder)),
});
```

#### `mixedArray`

`(value: mixed) => Array<mixed>`

Usually you want to use [array] instead. `array` actually uses this decoder
behind the scenes, to verify that `value` is an array (before proceeding to
decode every item of the array). `mixedArray` _only_ checks that `value` is an
array, but does not care about what’s _inside_ the array – all those values stay
as `mixed`.

This can be useful for custom decoders, such as when [distinguishing between
undefined, null and missing values][example-missing-values].

#### `mixedDict`

`(value: mixed) => { [string]: mixed }`

Usually you want to use [dict] or [record] instead. `dict` and `record` actually
use this decoder behind the scenes, to verify that `value` is an object (before
proceeding to decode values of the object). `mixedDict` _only_ checks that
`value` is an object, but does not care about what’s _inside_ the object – all
the keys remain unknown and their values stay as `mixed`.

This can be useful for custom decoders, such as when [distinguishing between
undefined, null and missing values][example-missing-values].

### `repr`

`(value: mixed, options?: Options) => string`

Takes any value, and returns a string representation of it for use in error
messages. Useful when making [custom decoders][example-custom-decoders].

Options:

| name              | type                                          | default     | description                                                                                 |
| ----------------- | --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| key               | <code>string &vert; number &vert; void</code> | `undefined` | An object key or array index to highlight when `repr`ing objects or arrays.                 |
| recurse           | `boolean`                                     | `true`      | Whether to recursively call `repr` on array items and object values. It only recurses once. |
| maxArrayChildren  | `number`                                      | `5`         | The number of array items to print (when `recurse` is `true`.)                              |
| maxObjectChildren | `number`                                      | `3`         | The number of object key-values to print (when `recurse` is `true`.)                        |

Example:

```js
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

This function returns _a_ string, but what that string looks like is not part of
the public API.

## Comparison with nvie/decoders

|                    | [nvie/decoders]                                                                               | tiny-decoders                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Size               | [![minified size][min-decoders]<br>![minzipped size][minzip-decoders]][bundlephobia-decoders] | [![minified size][min-tiny-decoders]<br>![minzipped size][minzip-tiny-decoders]][bundlephobia-tiny-decoders] |
| Dependencies       | ![has dependencies][deps-decoders]                                                            | ![no dependencies][deps-tiny-decoders]                                                                       |
| Error messages     | Really fancy                                                                                  | Kinda good (size tradeoff)                                                                                   |
| Built-in functions | Type checking + validation (regex, email)                                                     | Type checking only (validation can be plugged in)                                                            |
| Decoders…          | …return [Result]s or throw errors                                                             | …only throw errors                                                                                           |

In other words:

- [nvie/decoders]: Larger API, fancier error messages, larger size.
- tiny-decoders: Smaller (slightly different) API, kinda good error messages,
  smaller size.

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

The errors of tiny-decoders are shorter and a little bit more cryptic. As
opposed to [nive/decoders], it stops at the _first_ error in a record (instead
of showing them all). First, the missing “id” field:

```
TypeError: array[1]["accessories"][0]["id"]: Expected a string, but got: undefined
at "id" (missing) in {"name": "Keycap Puller", "image": "data:imag…AkQBADs=", "discount": "5%"}
at 0 in [(index 0) Object(3), Object(4)]
at "accessories" in {"accessories": Array(2), "id": "382973", "name": "Ergonomic Keyboard", (2 more)}
at 1 in [Object(5), (index 1) Object(5), Object(5)]
```

And if we add an “id” we get the “discount” error:

```
TypeError: array[1]["accessories"][0]["discount"]: (optional) Expected a number, but got: "5%"
at "discount" in {"discount": "5%", "id": "489382", "name": "Keycap Puller", (1 more)}
at 0 in [(index 0) Object(4), Object(4)]
at "accessories" in {"accessories": Array(2), "id": "382973", "name": "Ergonomic Keyboard", (2 more)}
at 1 in [Object(5), (index 1) Object(5), Object(5)]
```

If you read the “stack trace” of tiny-decoders from bottom to top, it’s a bit
like expanding objects and arrays in the browser devtools (but in your head):

```
[Object(5), (index 1) Object(5), Object(5)]
                      |
                      v
                      {"accessories": Array(2), "id": "382973", "name": "Ergonomic Keyboard", (2 more)}
                                      |
                                      v
                                      [(index 0) Object(4), Object(4)]
                                                 |
                                                 v
                                                 {"discount": "5%", "id": "489382", "name": "Keycap Puller", (1 more)}
                                                              ^^^^
```

## Development

You can need [Node.js] 10 and npm 6.

### npm scripts

- `npm run flow`: Run [Flow].
- `npm run eslint`: Run [ESLint] \(including [Flow] and [Prettier]).
- `npm run eslint:fix`: Autofix [ESLint] errors.
- `npm run dtslint`: Run [dtslint].
- `npm run prettier`: Run [Prettier] for files other than JS.
- `npm run doctoc`: Run [doctoc] on README.md.
- `npm run jest`: Run unit tests. During development, `npm run jest -- --watch`
  is nice.
- `npm run coverage`: Run unit tests with code coverage.
- `npm build`: Compile with [Babel].
- `npm test`: Check that everything works.
- `npm publish`: Publish to [npm], but only if `npm test` passes.

### Directories

- `src/`: Source code.
- `examples/`: Examples, in the form of [Jest] tests.
- `test/`: [Jest] tests.
- `flow/`: [Flow] typechecking tests. Turn off “ExpectError” in .flowconfig to
  see what the errors look like.
- `typescript/`: [TypeScript] type definitions, config and typechecking tests.
- `dist/`: Compiled code, built by `npm run build`. This is what is published in
  the npm package.

## License

[MIT](LICENSE)

<!-- prettier-ignore-start -->
[andThen]: #andThen
[array]: #array
[babel]: https://babeljs.io/
[bundlephobia-decoders]: https://bundlephobia.com/result?p=decoders
[bundlephobia-tiny-decoders]: https://bundlephobia.com/result?p=tiny-decoders
[constant]: #constant
[deps-decoders]: https://img.shields.io/david/nvie/decoders.svg
[deps-tiny-decoders]: https://img.shields.io/david/lydell/tiny-decoders.svg
[dict]: #dict
[doctoc]: https://github.com/thlorenz/doctoc/
[dtslint]: https://github.com/Microsoft/dtslint/
[elm-json]: https://package.elm-lang.org/packages/elm/json/latest/Json-Decode
[elm-map]: https://package.elm-lang.org/packages/elm/json/latest/Json-Decode#mapping
[eslint]: https://eslint.org/
[example-allow-failures]: https://github.com/lydell/tiny-decoders/blob/master/examples/allow-failures.test.js
[example-custom-decoders]: https://github.com/lydell/tiny-decoders/blob/master/examples/custom-decoders.test.js
[example-decoding-by-type-name]: https://github.com/lydell/tiny-decoders/blob/master/examples/decoding-by-type-name.test.js
[example-extra-fields]: https://github.com/lydell/tiny-decoders/blob/master/examples/extra-fields.test.js
[example-inference]: https://github.com/lydell/tiny-decoders/blob/master/examples/inference.test.js
[example-missing-values]: https://github.com/lydell/tiny-decoders/blob/master/examples/missing-values.test.js
[example-mixed]: https://github.com/lydell/tiny-decoders/blob/master/examples/mixed.test.js
[example-readme]: https://github.com/lydell/tiny-decoders/blob/master/examples/readme.test.js
[example-recursive]: https://github.com/lydell/tiny-decoders/blob/master/examples/recursive.test.js
[example-renaming-fields]: https://github.com/lydell/tiny-decoders/blob/master/examples/renaming-fields.test.js
[example-sets]: https://github.com/lydell/tiny-decoders/blob/master/examples/sets.test.js
[example-tuples]: https://github.com/lydell/tiny-decoders/blob/master/examples/tuples.test.js
[field]: #field
[fieldandthen]: #fieldandthen
[flow]: https://flow.org/
[group]: #group
[jest]: https://jestjs.io/
[map]: #map
[min-decoders]: https://img.shields.io/bundlephobia/min/decoders.svg
[min-tiny-decoders]: https://img.shields.io/bundlephobia/min/tiny-decoders.svg
[minzip-decoders]: https://img.shields.io/bundlephobia/minzip/decoders.svg
[minzip-tiny-decoders]: https://img.shields.io/bundlephobia/minzip/tiny-decoders.svg
[mixedarray]: #mixedarray
[mixeddict]: #mixeddict
[no-use-before-define]: https://eslint.org/docs/rules/no-use-before-define
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[nvie/decoders]: https://github.com/nvie/decoders
[prettier]: https://prettier.io/
[record]: #record
[result]: https://github.com/nvie/lemons.js#result
[travis-badge]: https://travis-ci.com/lydell/tiny-decoders.svg?branch=master
[travis-link]: https://travis-ci.com/lydell/tiny-decoders
[typescript]: https://www.typescriptlang.org/
<!-- prettier-ignore-end -->
