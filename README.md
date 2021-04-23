# tiny-decoders ![no dependencies](https://img.shields.io/david/lydell/tiny-decoders.svg) [![minified size](https://img.shields.io/bundlephobia/min/tiny-decoders.svg)](https://bundlephobia.com/result?p=tiny-decoders)

Type-safe data decoding for the minimalist.

## Installation

```
npm install tiny-decoders
```

## Example

```ts
import {
  array,
  boolean,
  DecoderError,
  fields,
  fieldsAuto,
  number,
  optional,
  string,
} from "tiny-decoders";

type User = {
  name: string;
  active: boolean;
  age?: number;
  interests: Array<string>;
};

const userDecoder = fields(
  (field): User => ({
    name: field("full_name", string),
    active: field("is_active", boolean),
    age: field("age", optional(number)),
    interests: field("interests", array(string)),
  })
);

const payload: unknown = getSomeJSON();

try {
  const user: User = userDecoder(payload);
} catch (error: unknown) {
  if (error instanceof DecoderError) {
    console.error(error.format());
  } else {
    console.error(error);
  }
}
```

Here’s an example error message:

```
At root["age"] (optional):
Expected a number
Got: "30"
```

If you use the same field names in both JSON and TypeScript there’s a shortcut:

```ts
const userDecoder2 = fieldsAuto({
  full_name: string,
  is_active: boolean,
  age: optional(number),
  interests: array(string),
});
```

You can even [infer the type from the decoder](#type-inference) instead of writing it manually!

```ts
type User2 = ReturnType<typeof userDecoder2>;
```

The above produces this type:

```ts
type User2 = {
  full_name: string;
  is_active: boolean;
  age?: number;
  interests: string[];
};
```

## Decoder&lt;T&gt;

```ts
type Decoder<T> = (value: unknown) => T;
```

A decoder is a function that:

- Takes an `unknown` value and refines it to any type you want (`T`).
- Throws a [DecoderError](#decodererror) otherwise.

That’s it!

tiny-decoders ships with a bunch of decoders, and a few functions to combine decoders. This way you can describe the shape of any data!

### Advanced variant

```ts
type Decoder<T, U = unknown> = (value: U, errors?: Array<DecoderError>) => T;
```

The above is the _full_ definition of a decoder.

- The input value can be some other type (`U`) than `unknown` if you want.
- Some decoders support [pushing errors to an array](#tolerant-decoding).

Most of the time you don’t need to think about this, though!

## Decoders

Here’s a summary of all decoders:

<table>
<thead>
<tr>
<th>Decoder</th>
<th>Type</th>
<th>JSON</th>
<th>TypeScript</th>
</tr>
</thead>
<tbody>
<tr>
<th><a href="#boolean">boolean</a></th>
<td><code>Decoder&lt;boolean&gt;</code></td>
<td>boolean</td>
<td><code>boolean</code></td>
</tr>
<tr>
<th><a href="#number">number</a></th>
<td><code>Decoder&lt;number&gt;</code></td>
<td>number</td>
<td><code>number</code></td>
</tr>
<tr>
<th><a href="#string">string</a></th>
<td><code>Decoder&lt;string&gt;</code></td>
<td>string</td>
<td><code>string</code></td>
</tr>
<th><a href="#stringunion">stringUnion</a></th>
<td><pre>(mapping: {
  string1: null,
  string2: null,
  stringN: null
}) =&gt;
  Decoder&lt;
    "string1"
    | "string2"
    | "stringN"
  &gt;</pre></td>
<td>string</td>
<td><pre>"string1"
| "string2"
| "stringN"</pre></td>
</tr>
<tr>
<th><a href="#array">array</a></th>
<td><pre>(decoder: Decoder&lt;T&gt;) =&gt;
  Decoder&lt;Array&lt;T&gt;&gt;</pre></td>
<td>array</td>
<td><code>Array&lt;T&gt;</code></td>
</tr>
<tr>
<th><a href="#record">record</a></th>
<td><pre>(decoder: Decoder&lt;T&gt;) =&gt;
  Decoder&lt;Record&lt;string, T&gt;&gt;</pre></td>
<td>object</td>
<td><code>Record&lt;string, T&gt;</code></td>
</tr>
<tr>
<th><a href="#fields">fields</a></th>
<td><pre>(callback: Function) =&gt;
  Decoder&lt;T&gt;</pre></td>
<td>object</td>
<td><code>T</code></td>
</tr>
<tr>
<th><a href="#fieldsauto">fieldsAuto</a></th>
<td><pre>(mapping: {
  field1: Decoder&lt;T1&gt;,
  field2: Decoder&lt;T2&gt;,
  fieldN: Decoder&lt;TN&gt;
}) =&gt;
  Decoder&lt;{
    field1: T1,
    field2: T2,
    fieldN: TN
  }&gt;</pre></td>
<td>object</td>
<td><pre>{
  field1: T1,
  field2: T2,
  fieldN: TN
}</pre></td>
</tr>
<tr>
<th><a href="#fieldsunion">fieldsUnion</a></th>
<td><pre>(
  key: string,
  mapping: {
    key1: Decoder&lt;T1&gt;,
    key2: Decoder&lt;T2&gt;,
    keyN: Decoder&lt;TN&gt;
  }
) =&gt;
  Decoder&lt;T1 | T2 | TN&gt;</pre></td>
<td>object</td>
<td><code>T1 | T2 | TN</code></td>
</tr>
<tr>
<th><a href="#tuple">tuple</a></th>
<td><pre>(mapping: [
  Decoder&lt;T1&gt;,
  Decoder&lt;T2&gt;,
  Decoder&lt;TN&gt;
]) =&gt;
  Decoder&lt;[T1, T2, TN]&gt;</pre></td>
<td>array</td>
<td><code>[T1, T2, TN]</code></td>
</tr>
<tr>
<th><a href="#multi">multi</a></th>
<td><pre>(mapping: Record&lt;string, Decoder&lt;T&gt;&gt;) =&gt;
  Decoder&lt;T&gt;</pre></td>
<td>you decide</td>
<td><code>T</code></td>
</tr>
<tr>
<th><a href="#optional">optional</a></th>
<td><pre>(decoder: Decoder&lt;T&gt;) =&gt;
  Decoder&lt;T | undefined&gt;</pre></td>
<td>missing or …</td>
<td><code>T | undefined</code></td>
</tr>
<tr>
<th><a href="#nullable">nullable</a></th>
<td><pre>(decoder: Decoder&lt;T&gt;) =&gt;
  Decoder&lt;T | null&gt;</pre></td>
<td>null or …</td>
<td><code>T | null</code></td>
</tr>
<tr>
<th><a href="#chain">chain</a></th>
<td><pre>(
  decoder: Decoder&lt;T&gt;,
  next: Decoder&lt;U, T&gt;
) =&gt;
  Decoder&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
</tbody>
</table>

### boolean

```ts
function boolean(value: unknown): boolean;
```

Decodes a JSON boolean into a TypeScript `boolean`.

### number

```ts
function number(value: unknown): number;
```

Decodes a JSON number into a TypeScript `number`.

### string

```ts
function string(value: unknown): string;
```

Decodes a JSON string into a TypeScript `string`.

### stringUnion

```ts
function stringUnion<T extends Record<string, null>>(
  mapping: T
): Decoder<keyof T>;
```

Decodes a set of specific JSON strings into a TypeScript union of those strings.

The `mapping` is an object where the keys are the strings you want and the values are always `null`. The keys must be strings (not numbers) and you must provide at least one key.

Example:

```ts
type Color = "green" | "red";

const colorDecoder: Decoder<Color> = stringUnion({
  green: null,
  red: null,
});
```

### array

```ts
function array<T, U = never>(
  decoder: Decoder<T>,
  { mode = "throw" }: { mode?: "skip" | "throw" | { default: U } } = {}
): Decoder<Array<T | U>>;
```

Decodes a JSON array into a TypeScript `Array`.

The passed `decoder` is for each item of the array.

For example, `array(string)` decodes an array of strings (into `Array<string>`).

For the `mode` option, see [Tolerant decoding](#tolerant-decoding).

### record

```ts
function record<T, U = never>(
  decoder: Decoder<T>,
  { mode = "throw" }: { mode?: "skip" | "throw" | { default: U } } = {}
): Decoder<Record<string, T | U>>;
```

Decodes a JSON object into a TypeScript `Record`. (Yes, this function is named after TypeScript’s type. Other languages call this a “dict”.)

The passed `decoder` is for each value of the object.

For example, `record(number)` decodes an object where the keys can be anything and the values are numbers (into `Record<string, number>`).

For the `mode` option, see [Tolerant decoding](#tolerant-decoding).

### fields

```ts
function fields<T>(
  callback: (
    field: <U, V = never>(
      key: string,
      decoder: Decoder<U>,
      options?: { mode?: "throw" | { default: V } }
    ) => U | V,
    object: Record<string, unknown>,
    errors?: Array<DecoderError>
  ) => T,
  {
    exact = "allow extra",
    allow = "object",
  }: {
    exact?: "allow extra" | "push" | "throw";
    allow?: "array" | "object";
  } = {}
): Decoder<T>;
```

Decodes a JSON object (or array) into any TypeScript you’d like (`T`), usually an object/interface with known fields.

This is the most general function, which you can use for lots of different data. Other functions might be more convenient though.

The type annotation is a bit ovewhelming, but using `fields` isn’t super complicated. In a callback, you get a `field` function that you use to pluck out stuff from the JSON object. For example:

```ts
type User = {
  age: number;
  active: boolean;
  name: string;
  description?: string;
  legacyId?: number;
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
    legacyId: field("extra_data", number, { mode: { default: undefined } }),
    // Hardcoded field:
    version: 1,
  })
);

// Plucking a single field out of an object:
const ageDecoder: Decoder<number> = fields((field) => field("age", number));
```

`field("key", decoder)` essentially runs `decoder(obj["key"])` but with better error messages and automatic handling of the `errors` array, if provided. The nice thing about `field` is that it does _not_ return a new decoder – but the value of that field! This means that you can do for instance `const type: string = field("type", string)` and then use `type` however you want inside your callback.

`object` and `errors` are passed in case you’d need them for some edge case, such as if you need to check stuff like `"my-key" in object`.

Note that if your input object and the decoded object look exactly the same and you don’t need any advanced features it’s often more convenient to use [fieldsAuto](#fieldsauto).

Also note that you can return any type from the callback, not just objects. If you’d rather have a tuple you could return that – see the [tuples example](examples/tuples.test.ts).

The `exact` option let’s you choose between ignoring extraneous data and making it a hard error.

- `"allow extra"` (default) allows extra properties on the object (or extra indexes on an array).
- `"push"` pushes a `DecoderError` for extra properties to the `errors` array, if present.
- `"throw"` throws a `DecoderError` for extra properties.

The `allow` option defaults to only allowing JSON objects. Set it to `"array"` if you are decoding an array.

For the `mode` option, see [Tolerant decoding](#tolerant-decoding).

More examples:

- [Extra fields](examples/extra-fields.test.ts).
- [Renaming fields](examples/renaming-fields.test.ts).
- [Tuples](examples/tuples.test.ts).

### fieldsAuto

```ts
function fieldsAuto<T extends Record<string, unknown>>(
  mapping: { [P in keyof T]: Decoder<T[P]> },
  { exact = "allow extra" }: { exact?: "allow extra" | "push" | "throw" } = {}
): Decoder<T> {
```

Decodes a JSON object with certain fields into a TypeScript object type/interface with known fields.

This is for situations where the JSON keys and your TypeScript type keys have the same names, and you don’t need any advanced features from [fields](#fields), like renaming fields.

Example:

```ts
type User = {
  name: string;
  age: number;
  active: boolean;
};

const userDecoder = fieldsAuto<User>({
  name: string,
  age: number,
  active: boolean,
});
```

The `exact` option let’s you choose between ignoring extraneous data and making it a hard error.

- `"allow extra"` (default) allows extra properties on the object.
- `"push"` pushes a `DecoderError` for extra properties to the `errors` array, if present.
- `"throw"` throws a `DecoderError` for extra properties.

More examples:

- [Extra fields](examples/extra-fields.test.ts).
- [Renaming fields](examples/renaming-fields.test.ts).

### fieldsUnion

```ts
type Values<T> = T[keyof T];

function fieldsUnion<T extends Record<string, Decoder<unknown>>>(
  key: string,
  mapping: T
): Decoder<
  Values<{ [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never }>
>;
```

Decodes JSON objects with a common string field (that tells them apart) and a TypeScript union type.

The `key` is the name of the common string field.

The `mapping` is an object where the keys are the strings of the `key` field and the values are decoders. The decoders are usually `fields` or `fieldsAuto`. The keys must be strings (not numbers) and you must provide at least one key.

You _can_ use [fields](#fields) to accomplish the same thing, but it’s easier with `fieldsUnion`. You also get better error messages and type inference with `fieldsUnion`.

```ts
type Shape =
  | { tag: "Circle"; radius: number }
  | { tag: "Rectangle"; width: number; height: number };

const shapeDecoder = fieldsUnion<Shape>("tag", {
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
```

See also the [renaming union field example](examples/renaming-union-field.test.ts).

### tuple

```ts
function tuple<T extends ReadonlyArray<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Decoder<T[P]> }]
): Decoder<[...T]>;
```

Decodes a JSON array into a TypeScript tuple. They both must have the exact same length, otherwise an error is thrown.

Example:

```ts
type Point = [number, number];

const pointDecoder: Decoder<Point> = tuple([number, number]);
```

See the [tuples example](examples/tuples.test.ts) for more details.

### multi

```ts
function multi<
  T1 = never,
  T2 = never,
  T3 = never,
  T4 = never,
  T5 = never,
  T6 = never,
  T7 = never
>(mapping: {
  undefined?: Decoder<T1, undefined>;
  null?: Decoder<T2, null>;
  boolean?: Decoder<T3, boolean>;
  number?: Decoder<T4, number>;
  string?: Decoder<T5, string>;
  array?: Decoder<T6, Array<unknown>>;
  object?: Decoder<T7, Record<string, unknown>>;
}): Decoder<T1 | T2 | T3 | T4 | T5 | T6 | T7>;
```

Decode multiple JSON types into a TypeScript type of choice.

This is useful for supporting stuff that can be either a string or a number, for example.

The `mapping` is an object where the keys are wanted JSON types and the values are callbacks for each type. Specify which JSON types you want and what to do with each (transform the data or decode it further).

Example:

```ts
type Id = { tag: "Id"; id: string } | { tag: "LegacyId"; id: number };

const idDecoder: Decoder<Id> = multi({
  string: (id) => ({ tag: "Id" as const, id }),
  number: (id) => ({ tag: "LegacyId" as const, id }),
});
```

You can return anything from each type callback – the result of the decoder is the union of all of that.

### optional

```ts
function optional<T>(decoder: Decoder<T>): Decoder<T | undefined>;

function optional<T, U>(decoder: Decoder<T>, defaultValue: U): Decoder<T | U>;
```

Returns a new decoder that also accepts `undefined`. Alternatively, supply a `defaultValue` to use in place of `undefined`.

When do you get `undefined` in JSON? When you try to access a field that does not exist using JavaScript. So `optional` is useful to make fields optional in [fields](#fields) and [fieldsAuto](#fieldsauto).

### nullable

```ts
function nullable<T>(decoder: Decoder<T>): Decoder<T | null>;

function nullable<T, U>(decoder: Decoder<T>, defaultValue: U): Decoder<T | U>;
```

Returns a new decoder that also accepts `null`. Alternatively, supply a `defaultValue` to use in place of `null`.

### chain

```ts
function chain<T, U>(decoder: Decoder<T>, next: Decoder<U, T>): Decoder<U>;
```

Run a function after a decoder (if it succeeds). The function can either transform the decoded data, or be another decoder to decode the value further.

Example:

```ts
const numberSetDecoder: Decoder<Set<number>> = chain(
  array(number),
  (arr) => new Set(arr)
);
```

See the [chain example](examples/chain.test.ts) for more.

## DecoderError

```ts
type DecoderErrorVariant =
  | {
      tag: "custom";
      message: string;
      got: unknown;
    }
  | {
      tag: "exact fields";
      knownFields: Array<string>;
      got: Array<string>;
    }
  | {
      tag: "tuple size";
      expected: number;
      got: number;
    }
  | {
      tag: "unknown fieldsUnion tag";
      knownTags: Array<string>;
      got: string;
    }
  | {
      tag: "unknown multi type";
      knownTypes: Array<
        | "array"
        | "boolean"
        | "null"
        | "number"
        | "object"
        | "string"
        | "undefined"
      >;
      got: unknown;
    }
  | {
      tag: "unknown stringUnion variant";
      knownVariants: Array<string>;
      got: string;
    }
  | { tag: "array"; got: unknown }
  | { tag: "boolean"; got: unknown }
  | { tag: "number"; got: unknown }
  | { tag: "object"; got: unknown }
  | { tag: "string"; got: unknown };

type Key = number | string; // Not exported.

class DecoderError extends TypeError {
  path: Array<Key>;

  variant: DecoderErrorVariant;

  nullable: boolean;

  optional: boolean;

  constructor(
    params:
      | { message: string; value: unknown; key?: Key }
      | (DecoderErrorVariant & { key?: Key })
  );

  static MISSING_VALUE: symbol;

  static at(error: unknown, key: Key): DecoderError;

  format(options?: ReprOptions): string;
}
```

The error thrown by all decoders. It keeps track of where in the JSON the error occurred.

At the places where you actually call a decoder function (as opposed to just combining them into bigger and bigger structures), use a `try-catch` to catch errors. You can use `.format()` on the caught error to get a nice string explaining what went wrong.

```ts
const myDecoder = array(string);

try {
  myDecoder(someUnknownValue);
} catch (error) {
  if (error instanceof DecoderError) {
    console.error(error.format());
  } else {
    console.error(error);
  }
}
```

### constructor

The constructor either takes a `DecoderErrorVariant` or a `{ message, value, key }` object.

When creating a `DecoderError` you generally want to pass `message` and `value` rather than one of the existing `DecoderErrorVariant`s.

- `message` is a string saying what went wrong.
- `value` is the value being decoded that caused the error.
- `key` is optional. If you’re at an object key or an array index you can pass that key to let the `DecoderError` know where the error occurred.

### static at

`DecoderError.at(error, key)` returns a `DecoderError` from `error` and marks it as it happened at `key`.

For example, you could turn the keys of an object into regexes. If one key isn’t a valid regex, you can use `at` to make the error message point at that key rather than at the whole object.

```ts
const decoder: Decoder<Array<[RegExp, number]>> = Decode.chain(
  Decode.record(Decode.number),
  (record) =>
    Object.entries(record).map(([key, value]) => {
      try {
        return [RegExp(key, "u"), value];
      } catch (error) {
        throw Decode.DecoderError.at(error, key);
      }
    })
);
```

Note: `DecoderError.at(error)` _mutates_ `error` if `error instanceof DecoderError`! For other values, it creates a new `DecoderError` – and in this case, the value that caused the error is set to `DecoderError.MISSING_VALUE`.

### format

Turn the `DecoderError` into a nicely formatted string. It uses [repr](#repr) under the hood and takes the same options.

If you want to format the error yourself in a custom way, look at these properties:

- `.path`: The path into a JSON object/array to the value that caused the error.
- `.variant`: The actual error.
- `.nullable`: The error happened at a [nullable](#nullable).
- `.optional`: The error happened at an [optional](#optional).

## repr

```ts
type ReprOptions = {
  recurse?: boolean;
  maxArrayChildren?: number;
  maxObjectChildren?: number;
  maxLength?: number;
  recurseMaxLength?: number;
  sensitive?: boolean;
};

function repr(
  value: unknown,
  {
    recurse = true,
    maxArrayChildren = 5,
    maxObjectChildren = 3,
    maxLength = 100,
    recurseMaxLength = 20,
    sensitive = false,
  }: ReprOptions = {}
): string;
```

Takes any value, and returns a string representation of it for use in error messages. [DecoderError.prototype.format](#format) uses it behind the scenes. If you want to do your own formatting, `repr` can be useful.

Options:

| name | type | default | description |
| --- | --- | --- | --- |
| recurse | `boolean` | `true` | Whether to recursively call `repr` on array items and object values. It only recurses once. |
| maxArrayChildren | `number` | `5` | The number of array items to print (when `recurse` is `true`.) |
| maxObjectChildren | `number` | `3` | The number of object key-values to print (when `recurse` is `true`.) |
| maxLength | `number` | `100` | The maximum length of literals, such as strings, before truncating them. |
| recurseMaxLength | `number` | `20` | Like `maxLength`, but when recursing. One typically wants shorter lengths here to avoid overly long error messages. |
| sensitive | `boolean` | `false` | Set it do `true` if you deal with sensitive data to avoid leaks. See below. |

## Sensitive data

By default, the tiny-decoder’s error messages try to be helpful by showing you the actual values that failed decoding to make it easier to understand what happened. However, if you’re dealing with sensitive data, such as email addresses, passwords or social security numbers, you might not want that data to potentially appear in error logs.

Standard:

```
object["details"]["ssn"]: Expected a string, but got: 123456789
```

With `{ sensitive: true }` (in `ReprOptions`):

```
object["details"]["ssn"]: Expected a string, but got: number
```

## Tolerant decoding

Since arrays and objects can hold multiple values, their decoders allow opting into tolerant decoding, where you can recover from errors, either by skipping values or providing defaults. Whenever that happens, the error that would otherwise have been thrown is pushed to an `errors` array (`Array<DecoderError>`, if provided), allowing you to inspect what was ignored. (Perhaps not the most beautiful API, but very simple.)

For example, if you pass an `errors` array to a [fields] decoder, it will both push to the array and pass it along to its sub-decoders so they can push to it as well. If you make a custom decoder, you’ll have to remember to pass along `errors` as well when needed.

Functions that support tolerant decoding take a `mode` option which can have the following values:

- `"throw"` (default): Throws a `DecoderError` on the first invalid item.
- `"skip"`: Items that fail are ignored. This means that a decoded array can be shorter than the input array – even empty! And a decoded object can have fewer keys that the input object. Errors are pushed to the `errors` array, if present. (Not available for [field][fields], since skipping doesn’t make sense it that case.)
- `{ default: U }`: The passed default value is used for items that fail. A decoded array will always have the same length as the input array, and a decoded object will always have the same keys as the input object. Errors are pushed to the `errors` array, if present.

See the [tolerant decoding example](examples/tolerant-decoding.test.ts) for more information.

## Type annotations

The obvious type annotation for decoders is `: Decoder<T>`. But sometimes that’s not the best choice, due to TypeScript quirks! For [fields](#fields) and [fieldsAuto](#fieldsAuto), the recommended approach is:

```ts
type Person = {
  name: string;
  age?: number;
};

// Annotate the return type of the callback.
const personDecoder = fields(
  (field): Person => ({
    name: field("name", string),
    age: field("age", optional(number)),
  })
);

// Annotate the generic.
const personDecoderAuto = fieldsAuto<Person>({
  name: string,
  age: optional(number),
});
```

That gives the best TypeScript error messages, and the most type safety.

See the [type annotations](examples/type-annotations.test.ts) for more details.

## Type inference

Rather than first defining the type and then defining the decoder (which often feels like writing the type once again), you can _only_ define the decoder and then infer the type.

```ts
const personDecoder = fields((field) => ({
  name: field("name", string),
  age: field("age", optional(number)),
}));

const personDecoderAuto = autoFields({
  name: string,
  age: optional(number),
});

type Person = ReturnType<typeof personDecoder>;
// or:
type Person = ReturnType<typeof personDecoderAuto>;
```

See the [type inference example](examples/type-inference.test.ts) for more details.

## Things left out

Here are some decoders I’ve left out. They are not needed, rarely needed and/or too trivial to be included in a decoding library _for the minimalist._

### lazy

```ts
export function lazy<T>(callback: () => Decoder<T>): Decoder<T> {
  return function lazyDecoder(value: unknown, errors?: Array<DecoderError>): T {
    return callback()(value, errors);
  };
```

There used to be a `lazy` function. It was used for recursive structures, but when using [fields](#fields) or [multi](#multi) you don’t need it. See the [recursive example](examples/recursive.test.ts) for more information.

### unknown

```ts
export function unknown(value: unknown): unknown {
  return value;
}
```

This decoder would turn any JSON value into TypeScript’s `unknown`. I rarely need that. When I do, there are other ways of achieving it – the `unknown` function above is just the identity function. See the [unknown example](examples/unknown.test.ts) for more details.

### succeed

```ts
export function succeed<T>(value: T): Decoder<T> {
  return function succeedDecoder() {
    return value;
  };
}
```

This decoder would ignore its input and always “succeed” with a given value. This can be useful when using [fieldsAuto](#fieldsauto) inside [fieldsUnion](#fieldsunion). But I’m not sure if `succeed("Square")` is any more clear than `() => "Square" as const`. Some languages call this function `always` or `const`.

### either

```ts
export function either<T, U>(
  decoder1: Decoder<T>,
  decoder2: Decoder<U>
): Decoder<T | U>;
```

This decoder would try `decoder1` first. If it fails, go on and try `decoder2`. If that fails, present both errors. I consider this a blunt tool.

- If you want either a string or a number, use [multi](#multi). This let’s you switch between any JSON types.
- For objects that can be decoded in different ways, use [fieldsUnion](#fieldsunion). If that’s not possible, use [fields](#fields) and look for the field(s) that tell which variant you’ve got. Then run the appropriate decoder for the rest of the object.

The above approaches result in a much simpler [DecoderError](#decodererror) type, and also results in much better error messages, since there’s never a need to present something like “decoding failed in the following 5 ways: …”.
