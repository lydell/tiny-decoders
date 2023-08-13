# tiny-decoders [![minified size](https://img.shields.io/bundlephobia/min/tiny-decoders.svg)](https://bundlephobia.com/result?p=tiny-decoders)

Type-safe data decoding and encoding for the minimalist.

## Installation

```
npm install tiny-decoders
```

**Don’t miss out!**

- 👉 [Decoders summary](#decoders)
- 👉 [Optimal type annotations](#type-annotations)
- 👉 [Great error messages](#error-messages)

## Example

```ts
import * as Codec from "tiny-decoders";

type User = Codec.Infer<typeof User>;

const User = Codec.fields({
  name: Codec.string,
  age: Codec.optional(Codec.number),
  interests: Codec.array(Codec.string),
  active: Codec.named("is_active", boolean),
});
```

Here’s the same example, but with bare imports and no inferred types:

```ts
import {
  array,
  boolean,
  Codec,
  fields,
  named,
  number,
  optional,
  string,
} from "tiny-decoders";

type User = {
  name: string;
  age?: number;
  interests: Array<string>;
  active: boolean;
};

const User: Codec<User> = fields({
  name: string,
  age: optional(number),
  interests: array(string),
  active: named("is_active", boolean),
});
```

Here’s a way to run it in a type safe way:

```ts
const payload: string = getSomeJSON();

const maybeUser = Codec.parse(User, payload);

if (maybeUser instanceof Codec.DecoderError) {
  // `error.format()` gives a nicer error message than `error.message`.
  console.error(error.format());
} else {
  console.log(maybeUser.name, maybeUser.age);
  // Turn it back to JSON again:
  console.log(Codec.stringify(User, maybeUser));
}
```

Here’s an example error message:

```
At root["age"] (optional):
Expected a number
Got: "30"
```

## Codec&lt;T&gt;

```ts
type Codec<Decoded> = {
  decoder: (value: unknown) => Decoded;
  encoder: (value: Decoded) => unknown;
};
```

A codec is an object with a `decoder` field and an `encoder` field. Both are functions.

A decoder is a function that:

- Takes an `unknown` value and refines it to any type you want (`T`).
- Throws a [DecoderError](#decodererror) otherwise.

An encoder is a function that turns that `T` back to `unknown` again.

That’s it!

tiny-decoders ships with a bunch of codec, and a few functions to combine codecs. This way you can describe the shape of any data!

This package used to only have decoders. That’s why it’s called tiny-_decoders_ and not tiny-_codecs_.

### Advanced variant

```ts
type Codec<
  Decoded,
  Encoded = unknown,
  Options extends CodecOptions = {},
> = Options & {
  decoder: (value: unknown) => Decoded;
  encoder: (value: Decoded) => Encoded;
};

type CodecOptions = {
  encodedFieldName?: string;
  optional?: boolean;
};
```

The above is the _full_ definition of a codec.

- The encoded type does not _have_ to be `unknown`.
- There’s some metadata for supporting optional fields and having different object key names in JSON vs TypeScript.

Most of the time you don’t need to think about this, though!

## Codec

Here’s a summary of all codecs (with slightly simplified type annotations):

<table>
<thead>
<tr>
<th>Codec</th>
<th>Type</th>
<th>JSON</th>
<th>TypeScript</th>
</tr>
</thead>
<tbody>
<tr>
<th><a href="#unknown">unknown</a></th>
<td><code>Codec&lt;unknown&gt;</code></td>
<td>anything</td>
<td><code>unknown</code></td>
</tr>
<tr>
<th><a href="#boolean">boolean</a></th>
<td><code>Codec&lt;boolean&gt;</code></td>
<td>boolean</td>
<td><code>boolean</code></td>
</tr>
<tr>
<th><a href="#number">number</a></th>
<td><code>Codec&lt;number&gt;</code></td>
<td>number</td>
<td><code>number</code></td>
</tr>
<tr>
<th><a href="#string">string</a></th>
<td><code>Codec&lt;string&gt;</code></td>
<td>string</td>
<td><code>string</code></td>
</tr>
<th><a href="#stringunion">stringUnion</a></th>
<td><pre>(variants: [
  "string1",
  "string2",
  "stringN"
]) =&gt;
  Codec&lt;
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
<td><pre>(codec: Codec&lt;T&gt;) =&gt;
  Codec&lt;Array&lt;T&gt;&gt;</pre></td>
<td>array</td>
<td><code>Array&lt;T&gt;</code></td>
</tr>
<tr>
<th><a href="#record">record</a></th>
<td><pre>(decoder: Codec&lt;T&gt;) =&gt;
  Codec&lt;Record&lt;string, T&gt;&gt;</pre></td>
<td>object</td>
<td><code>Record&lt;string, T&gt;</code></td>
</tr>
<tr>
<th><a href="#fields">fields</a></th>
<td><pre>(mapping: {
  field1: Codec&lt;T1&gt;,
  field2: Codec&lt;T2&gt;,
  fieldN: Codec&lt;TN&gt;
}) =&gt;
  Codec&lt;{
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
  encodedCommonField: string,
  callback: (tag: (tagName: string) => Codec<string>) => [
    {
      tag1: tag("tag1"),
      field: Codec<T1["field"]>
    },
    {
      tag2: tag("tag2"),
      field: Codec<T2["field"]>
    },
    {
      tagN: tag("tagN"),
      field: Codec<TN["field"]>
    }
  ]
) =&gt;
  Codec&lt;T1 | T2 | TN&gt;</pre></td>
<td>object</td>
<td><code>T1 | T2 | TN</code></td>
</tr>
<tr>
<th><a href="#tuple">tuple</a></th>
<td><pre>(mapping: [
  Codec&lt;T1&gt;,
  Codec&lt;T2&gt;,
  Codec&lt;TN&gt;
]) =&gt;
  Codec&lt;[T1, T2, TN]&gt;</pre></td>
<td>array</td>
<td><code>[T1, T2, TN]</code></td>
</tr>
<tr>
<th><a href="#multi">multi</a></th>
<td><pre>(types: Array<"undefined" | "null" | "boolean" | "number" | "string" | "array" | "object">) =&gt;
  Codec&lt;T&gt;</pre></td>
<td>you decide</td>
<td><code>{ type: "undefined"; value: undefined }
| { type: "null"; value: null }
| { type: "boolean"; value: boolean }
| { type: "number"; value: number }
| { type: "string"; value: string }
| { type: "array"; value: Array<unknown> }
| { type: "object"; value: Record<string, unknown> }
</code></td>
</tr>
<tr>
<th><a href="#recursive">recursive</a></th>
<td><pre>(callback: () => Codec&lt;T&gt;) =&gt;
  Codec&lt;T&gt;</pre></td>
<td>you choose</td>
<td><code>T</code></td>
</tr>
<tr>
<th><a href="#optional">optional</a></th>
<td><pre>(codec: Codec&lt;T&gt;) =&gt;
  Codec&lt;T | undefined&gt;</pre></td>
<td>missing or …</td>
<td><code>T | undefined</code></td>
</tr>
<tr>
<th><a href="#nullable">nullable</a></th>
<td><pre>(codec: Codec&lt;T&gt;) =&gt;
  Codec&lt;T | null&gt;</pre></td>
<td>null or …</td>
<td><code>T | null</code></td>
</tr>
<tr>
<th><a href="#chain">chain</a></th>
<td><pre>(
  codec: Codec&lt;T&gt;,
  transform: {
    decoder: (value: T) => U;,
    encoder: (value: U) => T;
  }
) =&gt;
  Codec&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
<tr>
<th><a href="#singlefield">singleField</a></th>
<td><pre>(
  field: string,
  codec: Codec&lt;T&gt;
) =&gt;
  Codec&lt;T&gt;</pre></td>
<td>object</td>
<td><code>T</code></td>
</tr>
</tbody>
</table>

### unknown

```ts
const unknown: Codec<unknown>;
```

Decodes any JSON value into a TypeScript `unknown`.

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
function stringUnion<T extends Record<string, unknown>>(
  mapping: T,
): Decoder<keyof T>;
```

Decodes a set of specific JSON strings into a TypeScript union of those strings.

The `mapping` is an object where the keys are the strings you want. The keys must be strings (not numbers) and you must provide at least one key.

The values in the object can be anything – they don’t matter. The convention is to use `null` as values. If you already have an object with the correct keys but non-null values, then it can be handy to be able to use that object – that’s why any values are allowed. There’s an example of that in the [type inference file](examples/type-inference.test.ts).

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
function array<T>(decoder: Decoder<T>): Decoder<Array<T>>;
```

Decodes a JSON array into a TypeScript `Array`.

The passed `decoder` is for each item of the array.

For example, `array(string)` decodes an array of strings (into `Array<string>`).

### record

```ts
function record<T>(decoder: Decoder<T>): Decoder<Record<string, T>>;
```

Decodes a JSON object into a TypeScript `Record`. (Yes, this function is named after TypeScript’s type. Other languages call this a “dict”.)

The passed `decoder` is for each value of the object.

For example, `record(number)` decodes an object where the keys can be anything and the values are numbers (into `Record<string, number>`).

### fields

```ts
function fieldsAuto<T extends Record<string, unknown>>(
  mapping: { [P in keyof T]: Decoder<T[P]> },
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
): Decoder<T> {
```

Decodes a JSON object with certain fields into a TypeScript object type/interface with known fields.

This is for situations where the JSON keys and your TypeScript type keys have the same names, and you don’t need any advanced features from [fields](#fields).

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
- `"throw"` throws a `DecoderError` for extra properties.

More examples:

- [Extra fields](examples/extra-fields.test.ts).
- [Renaming fields](examples/renaming-fields.test.ts).

### fieldsUnion

```ts
type Values<T> = T[keyof T];

function fieldsUnion<T extends Record<string, Decoder<unknown>>>(
  key: string,
  mapping: T,
): Decoder<
  Values<{ [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never }>
>;
```

Decodes JSON objects with a common string field (that tells them apart) into a TypeScript union type.

The `key` is the name of the common string field.

The `mapping` is an object where the keys are the strings of the `key` field and the values are decoders. The decoders are usually `fields` or `fieldsAuto`. The keys must be strings (not numbers) and you must provide at least one key.

You _can_ use [fields](#fields) to accomplish the same thing, but it’s easier with `fieldsUnion`. You also get better error messages and type inference with `fieldsUnion`.

```ts
type Shape =
  | { tag: "Circle"; radius: number }
  | { tag: "Rectangle"; width: number; height: number };

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
```

See also the [renaming union field example](examples/renaming-union-field.test.ts).

### tuple

```ts
function tuple<T extends ReadonlyArray<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Decoder<T[P]> }],
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
  T7 = never,
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

### recursive

TODO: Re-order! Last?

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
  (arr) => new Set(arr),
);
```

See the [chain example](examples/chain.test.ts) for more.

### singleField

TODO: Re-order? After fieldsUnion?

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
      | (DecoderErrorVariant & { key?: Key }),
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
    // `error.format()` gives a nicer error message than `error.message`.
    console.error(error.format());
  } else {
    console.error(error);
  }
}
```

### constructor

The constructor either takes a `DecoderErrorVariant` or a `{ message, value, key }` object.

When creating a `DecoderError` you generally want to pass `{ message, value, key }` rather than one of the existing `DecoderErrorVariant`s.

- `message` is a string saying what went wrong.
- `value` is the value being decoded that caused the error.
- `key` is optional. If you’re at an object key or an array index you can pass that key to let the `DecoderError` know where the error occurred.

### static at

`DecoderError.at(error, key)` returns a `DecoderError` from `error` and marks it as having happened at `key`.

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
    }),
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
  }: ReprOptions = {},
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

## Error messages

**If you just use `error.message`, you’re missing out!**

`error.message` example:

```
Expected a string
Got: number
(Actual values are hidden in sensitive mode.)
```

`error.format()` example:

```
At root["details"]["ssn"]:
Expected a string
Got: 123456789
```

`error.format({ sensitive: true })` example:

```
At root["details"]["ssn"]:
Expected a string
Got: number
(Actual values are hidden in sensitive mode.)
```

It’s helpful when errors show you the actual values that failed decoding to make it easier to understand what happened. However, if you’re dealing with sensitive data, such as email addresses, passwords or social security numbers, you might not want that data to potentially appear in error logs.

- `error.message` hides potentially sensitive data so accidental uncaught errors don’t leak anything.
- `error.format()` defaults to showing actual values. It also shows the “path” to the problematic value (which isn’t available at the time `error` is constructed, which is why `error.message` doesn’t contain the path).
- `error.format({ sensitive: true })` can be used to hide potentially sensitive data. (See `ReprOptions`.)

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
  }),
);

// Annotate the generic.
const personDecoderAuto = fieldsAuto<Person>({
  name: string,
  age: optional(number),
});
```

That gives the best TypeScript error messages, and the most type safety.

See the [type annotations example](examples/type-annotations.test.ts) for more details.

## Type inference

Rather than first defining the type and then defining the decoder (which often feels like writing the type twice), you can _only_ define the decoder and then infer the type.

```ts
const personDecoder = fields((field) => ({
  name: field("name", string),
  age: field("age", optional(number)),
}));

const personDecoderAuto = fieldsAuto({
  name: string,
  age: optional(number),
});

type Person1 = ReturnType<typeof personDecoder>;

type Person2 = ReturnType<typeof personDecoderAuto>;
```

See the [type inference example](examples/type-inference.test.ts) for more details.

## Things left out

Here are some decoders I’ve left out. They are rarely needed or not needed at all, and/or too trivial to be included in a decoding library _for the minimalist._

### succeed

A `succeed` _decoder_ would ignore its input and always “succeed” with a given value. But what is the reasonable _encoder?_ Return the same value? But that means that decoding followed by encoding “invents” a new value that wasn’t there from the start. That may or may not be what you want, but can also be surprising. An encoder in this case could also return `undefined` or `null`, but how to choose? It might be unexpected that the encoder adds a field set to `undefined` or `null` as well. I think it usually makes more sense to use `chain` to define how to “add and remove” some hard coded value.

### either

An `either` decoder would take two decoders, and try the first one. If it fails, go on and try the second one. If that also fails, present both errors.

The problems here are:

1. It would complicate the [DecoderError](#decodererror) type and the error messages. Without `either`, since there’s never a need to present something like “decoding failed in the following 2 ways: …”.

2. What to do for the encoder? The `either` function wouldn’t know which codec’s encoder to use.

I consider `either` a blunt tool.

- If you want either a string or a number, use [multi](#multi). This let’s you switch between any JSON types.
- For objects that can be decoded in different ways, use [fieldsUnion](#fieldsunion). If that’s not possible, see the [backwards compatibility example](examples/backwards-compatibility.test.ts) for how to deal with complicated formats.
