# tiny-decoders

Type-safe data decoding for the minimalist.

## Installation

```
npm install tiny-decoders
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
<tr>
<th><a href="#constant">constant</a></th>
<td><pre>(value: T) =&gt;
  Decoder&lt;T&gt;</pre></td>
<td>boolean,<br>number,<br>string,<br>null,<br>missing</td>
<td><pre>T extends
  | boolean
  | number
  | string
  | null
  | undefined</pre></td>
</tr>
<tr>
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
<td><pre>(callback: FieldsCallback) =&gt;
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
<td><pre>(mapping: MultiMapping) =&gt;
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
<th><a href="#map">map</a></th>
<td><pre>(
  decoder: Decoder&lt;T&gt;,
  mapper: Decoder&lt;U, T&gt;
) =&gt;
  Decoder&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
<tr>
<th><a href="#lazy">lazy</a></th>
<td><pre>(callback: () =&gt; Decoder&lt;T&gt;) =&gt;
  Decoder&lt;T&gt;</pre></td>
<td>n/a</td>
<td><code>T</code></td>
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

### constant

```ts
function constant<T extends boolean | number | string | null | undefined>(
  constantValue: T
): Decoder<T>;
```

Decodes a specific JSON value into the same TypeScript value.

Commonly used with [fieldsUnion](#fieldsunion).

For example, `constant(5)` requires the value `5` and nothing else.

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

// Plucking a single field out of an object:
const ageDecoder: Decoder<number> = fields((field) => field("age", number));
```

`field("key", decoder)` essentially runs `decoder(obj["key"])` but with better error messages and automatic handling of the `errors` array, if provided. The nice thing about `field` is that it does _not_ return a new decoder – but the value of that field! This means that you can do for instance `const type: string = field("type", string)` and then use `type` however you want inside your callback.

`object` and `errors` are passed in case you’d need them for some edge case, such as if you need to check stuff like `"my-key" in object`.

Note that if your input object and the decoded object look exactly the same and you don’t need any advanced features it’s often more convenient to use [fieldsAuto](#fieldsauto).

Also note that you can return any type from the callback, not just objects. If you’d rather have a tuple you could return that – see the [tuples example](https://github.com/lydell/tiny-decoders/blob/master/examples/tuples.test.ts).

The `exact` option let’s you choose between ignoring extraneous data and making it a hard error.

- `"allow extra"` (default) allows extra properties on the object (or extra indexes on an array).
- `"push"` pushes a `DecoderError` for extra properties to the `errors` array, if present.
- `"throw"` throws a `DecoderError` for extra properties.

The `allow` option defaults to only allowing JSON objects. Set it to `"array"` if you are decoding an array.

For the `mode` option, see [Tolerant decoding](#tolerant-decoding).

More examples:

- [Extra fields](https://github.com/lydell/tiny-decoders/blob/master/examples/extra-fields.test.ts).
- [Renaming fields](https://github.com/lydell/tiny-decoders/blob/master/examples/renaming-fields.test.ts).
- [Tuples](https://github.com/lydell/tiny-decoders/blob/master/examples/tuples.test.ts).

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

const userDecoder = autoFields<User>({
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

- [Extra fields](https://github.com/lydell/tiny-decoders/blob/master/examples/extra-fields.test.ts).
- [Renaming fields](https://github.com/lydell/tiny-decoders/blob/master/examples/renaming-fields.test.ts).

### fieldsUnion

```ts
type Values<T> = T[keyof T];

export function fieldsUnion<T extends Record<string, Decoder<unknown>>>(
  key: string,
  mapping: T
): Decoder<
  Values<{ [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never }>
>;
```

Decodes JSON objects with a common string field (that tells them apart) and a TypeScript union type.

The `key` is the name of the common string field.

The `mapping` is an object where the keys are the strings of the `key` field and the values are decoders for the keys. The keys must be strings (not numbers) and you must provide at least one key.

You _can_ use [fields](#fields) to accomplish the same thing, but it’s easier with `fieldsUnion`. You also get better error messages and type inference with `fieldsUnion`.

TODO example

TODO link to type annotations?

TODO link to tag-vs-type example (extract from tests?)

TODO remove constant?

### tuple

### multi

### optional

### nullable

### map

### lazy

## DecoderError

```ts
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

  static MISSING_VALUE: UniqueValue;

  static at(error: unknown, key: Key): DecoderError;

  format(options?: ReprOptions): string;
}
```

TODO text

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

Takes any value, and returns a string representation of it for use in error messages. `DecoderError.prototype.format` uses it behind the scenes. If you want to do your own formatting, `repr` can be useful.

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

See the [tolerant decoding example](https://github.com/lydell/tiny-decoders/blob/master/examples/tolerant-decoding.test.ts) for more information.

## Type annotations and type inference

TODO
