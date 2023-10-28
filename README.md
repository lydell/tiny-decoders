# tiny-decoders [![minified size](https://img.shields.io/bundlephobia/min/tiny-decoders.svg)](https://bundlephobia.com/result?p=tiny-decoders)

Type-safe data decoding for the minimalist.

## Installation

```
npm install tiny-decoders
```

- 👉 [Decoders summary](#decoders)

## TypeScript requirements

tiny-decoders requires TypeScript 5+ (because it uses [const type parameters](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#const-type-parameters)).

It is recommended to enable the [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes) option in `tsconfig.json` – see the note at the [field](#field) function.

Note that it is possible to use tiny-decoders in plain JavaScript without type checking as well.

## Example

```ts
import {
  array,
  boolean,
  DecoderError,
  field,
  fieldsAuto,
  format,
  type Infer,
  number,
  string,
} from "tiny-decoders";

// You can also import into a namespace if you want:
import * as Decode from "tiny-decoders";

type User = {
  name: string;
  active: boolean;
  age?: number;
  interests: Array<string>;
};

const userDecoder: Decoder<User> = fieldsAuto({
  name: string,
  active: field(boolean, { renameFrom: "is_active" }),
  age: field(number, { optional: true }),
  interests: array(string),
});

const payload: unknown = getSomeJSON();

const userResult: User = userDecoder(payload);

switch (userResult.tag) {
  case "DecoderError":
    console.error(format(userResult.error));
    break;

  case "Valid":
    console.log(userResult.value);
    break;
}
```

Here’s an example error message:

```
At root["age"]:
Expected a number
Got: "30"
```

You can even [infer the type from the decoder](#type-inference) instead of writing it manually!

```ts
type User2 = Infer<typeof userDecoder2>;
```

`User2` above is equivalent to the `User` type already shown earlier.

## Decoder&lt;T&gt; and DecoderResult&lt;T&gt;

```ts
type Decoder<T> = (value: unknown) => DecoderResult<T>;

type DecoderResult<T> =
  | {
      tag: "DecoderError";
      error: DecoderError;
    }
  | {
      tag: "Valid";
      value: T;
    };
```

A decoder is a function that:

- Takes an `unknown` value and refines it to any type you want (`T`).
- Returns a `DecoderResult`: Either that refined `T` or a [DecoderError](#decodererror).

That’s it!

tiny-decoders ships with a bunch of decoders, and a few functions to combine decoders. This way you can describe the shape of any data!

### Advanced variant

```ts
type Decoder<T, U = unknown> = (value: U) => DecoderResult<T>;
```

The above is the _full_ definition of a decoder. The input value can be some other type (`U`) than `unknown` if you want.

Most of the time you don’t need to think about this, though!

## Decoders

Here’s a summary of all decoders (with slightly simplified type annotations):

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
<td><pre>(variants: [
  "string1",
  "string2",
  "stringN"
]) =&gt;
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
<th><a href="#fieldsauto">fieldsAuto</a></th>
<td><pre>(mapping: {
  field1: Decoder&lt;T1&gt;,
  field2: Field&lt;T2, {optional: true}&gt;,
  field3: Field&lt;T3, {renameFrom: "field_3"}&gt;,
  fieldN: Decoder&lt;TN&gt;
}) =&gt;
  Decoder&lt;{
    field1: T1,
    field2?: T2,
    field3: T3,
    fieldN: TN
  }&gt;</pre></td>
<td><pre>{
  "field1": ...,
  "field2": ...,
  "field_3": ...,
  "fieldN": ...
}</pre> or: <pre>{
  "field1": ...,
  "field_3": ...,
  "fieldN": ...
}</pre></td>
<td><pre>{
  field1: T1,
  field2?: T2,
  field3: T3,
  fieldN: TN
}</pre></td>
</tr>
<tr>
<th><a href="#field">field</a></th>
<td><pre>(
  decoder: Decoder&lt;Decoded&gt;,
  meta: Meta,
): Field&lt;Decoded, Meta&gt;</pre></td>
<td>n/a</td>
<td>n/a, only used with <code>fieldsAuto</code></td>
</tr>
<tr>
<th><a href="#fieldsunion">fieldsUnion</a></th>
<td><pre>(
  decodedCommonField: string,
  variants: Array&lt;
    Parameters&lt;typeof fieldsAuto&gt;[0]
  &gt;,
) =&gt;
  Decoder&lt;T1 | T2 | TN&gt;</pre></td>
<td>object</td>
<td><code>T1 | T2 | TN</code></td>
</tr>
<tr>
<th><a href="#tag">tag</a></th>
<td><pre>(
  decoded: "string literal",
  options?: Options,
): Field&lt;"string literal", Meta&gt;</pre></td>
<td>string</td>
<td><code>"string literal"</code></td>
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
<td><pre>(types: [
  "type1",
  "type2",
  "type7"
]) =&gt;
  Decoder&lt;
    { type: "type1", value: type1 }
    | { type: "type2", value: type2 }
    | { type: "type7", value: type7 }
  &gt;</pre></td>
<td>you decide</td>
<td>A subset of: <pre>{ type: "undefined"; value: undefined }
| { type: "null"; value: null }
| { type: "boolean"; value: boolean }
| { type: "number"; value: number }
| { type: "string"; value: string }
| { type: "array"; value: Array<unknown> }
| { type: "object"; value: Record<string, unknown> }</pre></td>
</tr>
<tr>
<th><a href="#recursive">recursive</a></th>
<td><pre>(callback: () => Decoder&lt;T&gt;) =&gt;
  Decoder&lt;T&gt;</pre></td>
<td>n/a</td>
<td><code>T</code></td>
</tr>
<tr>
<th><a href="#undefinedor">undefinedOr</a></th>
<td><pre>(decoder: Decoder&lt;T&gt;) =&gt;
  Decoder&lt;T | undefined&gt;</pre></td>
<td>undefined or …</td>
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
  transform: (value: T) =&gt; U,
) =&gt;
  Decoder&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
<tr>
<th><a href="#flatmap">flatMap</a></th>
<td><pre>(
  decoder: Decoder&lt;T&gt;,
  transform: (value: T) =&gt; DecoderResult&lt;U&gt;,
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
function stringUnion<T extends [string, ...Array<string>]>(
  variants: T,
): Decoder<T[number]>;
```

Decodes a set of specific JSON strings into a TypeScript union of those strings.

The `variants` is an array of the strings you want. You must provide at least one variant.

If you have an object and want to use its keys for a string union there’s an example of that in the [type inference file](examples/type-inference.test.ts).

Example:

```ts
type Color = "green" | "red";

const colorDecoder: Decoder<Color> = stringUnion(["green", "red"]);
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

### fieldsAuto

```ts
function fieldsAuto<Mapping extends FieldsMapping>(
  mapping: Mapping,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Decoder<InferFields<Mapping>>;

type FieldsMapping = Record<string, Decoder<any> | Field<any, FieldMeta>>;

type Field<Decoded, Meta extends FieldMeta> = Meta & {
  decoder: Decoder<Decoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: string; encoded: string } | undefined;
};

type InferFields<Mapping extends FieldsMapping> = magic;
```

Decodes a JSON object with certain fields into a TypeScript object type/interface with known fields.

The `mapping` parameter is an object with the keys you want in your TypeScript object. The values are either `Decoder`s or `Field`s. A `Field` is just a `Decoder` with some metadata: Whether the field is optional, and whether the field has a different name in the JSON object. Passing a plain `Decoder` instead of a `Field` is just a convenience shortcut for passing a `Field` with the default metadata (the field is required, and has the same name both in TypeScript and in JSON).

Use the [field](#field) function to create a `Field` – use it when you need to mark a field as optional, or when it has a different name in JSON than in TypeScript.

Example:

```ts
type User = {
  name: string;
  age?: number;
  active: boolean;
};

const userDecoder: Decoder<User> = fieldsAuto({
  name: string,
  age: field(number, { optional: true }),
  active: field(boolean, { renameFrom: "is_active" }),
});
```

The `allowExtraFields` option lets you choose between ignoring extraneous fields and making it an error.

- `true` (default) allows extra fields on the object.
- `false` returns a `DecoderError` for extra fields.

See also the [Extra fields](examples/extra-fields.test.ts) example.

### field

```ts
function field<Decoded, const Meta extends Omit<FieldMeta, "tag">>(
  decoder: Decoder<Decoded>,
  meta: Meta,
): Field<Decoded, Meta>;

type Field<Decoded, Meta extends FieldMeta> = Meta & {
  decoder: Decoder<Decoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: string; encoded: string } | undefined;
};
```

This function takes a decoder and lets you:

- Mark a field as optional: `field(string, { optional: true })`
- Rename a field: `field(string, { renameFrom: "some_name" })`
- Both: `field(string, { optional: true, renameFrom: "some_name" })`

Use it with [fieldsAuto](#fieldsAuto).

The `tag` thing is handled by the [tag](#tag) function. It’s not something you’ll set manually using `field`. (That’s why the type annotation says `Omit<FieldMeta, "tag">`.)

Here’s an example illustrating the difference between `field(string, { optional: true })` and `undefinedOr(string)`:

```ts
const exampleDecoder = fieldsAuto({
  // Required field.
  a: string,

  // Optional field.
  b: field(string, { optional: true }),

  // Required field that can be set to `undefined`:
  c: undefinedOr(string),

  // Optional field that can be set to `undefined`:
  d: field(undefinedOr(string), { optional: true }),
});
```

The inferred type of `exampleDecoder` is:

```ts
type Example = {
  a: string;
  b?: string;
  c: string | undefined;
  d?: string | undefined;
};
```

> **Warning**  
> It is recommended to enable the [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes) option in `tsconfig.json`.
>
> Why? Let’s take this decoder as an example:
>
> ```ts
> const exampleDecoder = fieldsAuto({
>   name: field(string, { optional: true }),
> });
> ```
>
> With `exactOptionalPropertyTypes` enabled, the inferred type of `exampleDecoder` is:
>
> ```ts
> type Example = { name?: string };
> ```
>
> That type allows constructing `{}` or `{ name: "some string" }`. If you pass either of those to `exampleDecoder` (such as `exampleDecoder({ name: "some string" })`), the decoder will succeed. It makes sense that a decoder accepts things that it has produced itself (when no transformation is involved).
>
> With `exactOptionalPropertyTypes` turned off (which is the default), the inferred type of `exampleDecoder` is:
>
> ```ts
> type Example = { name?: string | undefined };
> ```
>
> Notice the added `| undefined`. That allows also constructing `{ name: undefined }`. But if you run `exampleDecoder({ name: undefined })`, the decoder will fail. The decoder only supports `name` existing and being set to a string, or `name` being missing. It does not support it being set to `undefined` explicitly. If you wanted to support that, use `undefinedOr`:
>
> ```ts
> const exampleDecoder = fieldsAuto({
>   name: field(undefinedOr(string), { optional: true }),
> });
> ```
>
> That gives the same inferred type, but also supports decoding the `name` field being set to `undefined` explicitly.
>
> All in all, you avoid a slight gotcha with optional fields and inferred types if you enable `exactOptionalPropertyTypes`.

### fieldsUnion

```ts
function fieldsUnion<
  const DecodedCommonField extends keyof Variants[number],
  Variants extends readonly [
    Variant<DecodedCommonField>,
    ...ReadonlyArray<Variant<DecodedCommonField>>,
  ],
>(
  decodedCommonField: DecodedCommonField,
  variants: Variants,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Decoder<InferFieldsUnion<Variants[number]>>;

type Variant<DecodedCommonField extends string> = Record<
  DecodedCommonField,
  Field<any, { tag: { decoded: string; encoded: string } }>
> &
  Record<string, Decoder<any> | Field<any, FieldMeta>>;

type InferFieldsUnion<MappingsUnion extends FieldsMapping> = magic;

// See `fieldsAuto` for the definitions of `Field`, `FieldMeta` and `FieldsMapping`.
```

Decodes JSON objects with a common string field (that tells them apart) into a TypeScript union type.

The `decodedCommonField` is the name of the common string field.

`variants` is an array of objects. Those objects are “`fieldsAuto` objects” – they fit when passed to `fieldsAuto` as well. All of those objects must have `decodedCommonField` as a key, and use the [tag](#tag) function on that key.

```ts
type Shape =
  | { tag: "Circle"; radius: number }
  | { tag: "Rectangle"; width: number; height: number };

const shapeDecoder: Decoder<Shape> = fieldsUnion("tag", [
  {
    tag: tag("Circle"),
    radius: number,
  },
  {
    tag: tag("Rectangle"),
    width: field(number, { renameFrom: "width_px" }),
    height: field(number, { renameFrom: "height_px" }),
  },
]);
```

The `allowExtraFields` option works just like for [fieldsAuto](#fieldsauto).

See also the [renaming union field example](examples/renaming-union-field.test.ts).

### tag

```ts
export function tag<
  const Decoded extends string,
  const Encoded extends string,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  {
    renameTagFrom = decoded,
    renameFieldFrom,
  }: {
    renameTagFrom?: Encoded;
    renameFieldFrom?: EncodedFieldName;
  } = {},
): Field<
  Decoded,
  {
    renameFrom: EncodedFieldName | undefined;
    tag: { decoded: string; encoded: string };
  }
>;
```

Used with [fieldsUnion](#fieldsunion), once for each variant of the union.

`tag("MyTag")` returns a `Field` with a decoder that requires the input `"MyTag"` and returns `"MyTag"`. The metadata of the `Field` also advertises that the tag value is `"MyTag"`, which `fieldsUnion` uses to know what to do.

`tag("MyTag", { renameTagFrom: "my_tag" })` returns a `Field` with a decoder that requires the input `"my_tag"` but returns `"MyTag"`.

For `renameFieldFrom`, see [fieldsUnion](#fieldsunion).

### tuple

```ts
function tuple<T extends Array<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Decoder<T[P]> }],
): Decoder<[...T]>;
```

Decodes a JSON array into a TypeScript tuple. They both must have the exact same length, otherwise the decoder fails.

Example:

```ts
type Point = [number, number];

const pointDecoder: Decoder<Point> = tuple([number, number]);
```

See the [tuples example](examples/tuples.test.ts) for more details.

### multi

```ts
function multi<Types extends [MultiTypeName, ...Array<MultiTypeName>]>(
  types: Types,
): Decoder<Multi<Types[number]>>;

type MultiTypeName =
  | "array"
  | "boolean"
  | "null"
  | "number"
  | "object"
  | "string"
  | "undefined";

type Multi<Types> = Types extends any
  ? Types extends "undefined"
    ? { type: "undefined"; value: undefined }
    : Types extends "null"
    ? { type: "null"; value: null }
    : Types extends "boolean"
    ? { type: "boolean"; value: boolean }
    : Types extends "number"
    ? { type: "number"; value: number }
    : Types extends "string"
    ? { type: "string"; value: string }
    : Types extends "array"
    ? { type: "array"; value: Array<unknown> }
    : Types extends "object"
    ? { type: "object"; value: Record<string, unknown> }
    : never
  : never;
```

Decode multiple JSON types into a TypeScript type of choice.

This is useful for supporting stuff that can be either a string or a number, for example.

The type annotation for `multi` is a bit wacky, but it’s not that complicated to use. The `types` parameter is an array of strings – the wanted JSON types. For example, you can say `["string", "number"]`. Then the decoder will give you back either `{ type: "string", value: string }` or `{ type: "number", value: number }`. You can use [map](#map) to map that to some type of choice, or [flatMap](#flatmap) to decode further.

Example:

```ts
type Id = { tag: "Id"; id: string } | { tag: "LegacyId"; id: number };

const idDecoder: Decoder<Id> = map(multi(["string", "number"]), (value) => {
  switch (value.type) {
    case "string":
      return { tag: "Id" as const, id: value.value };
    case "number":
      return { tag: "LegacyId" as const, id: value.value };
  }
});
```

### recursive

```ts
function recursive<T>(callback: () => Decoder<T>): Decoder<T>;
```

When you make a decoder for a recursive data structure, you might end up with errors like:

```
ReferenceError: Cannot access 'myDecoder' before initialization
```

The solution is to wrap `myDecoder` in `recursive`: `recursive(() => myDecoder)`. The unnecessary-looking arrow function delays the reference to `myDecoder` so we’re able to define it.

See the [recursive example](examples/recursive.test.ts) for more information.

### undefinedOr

```ts
function undefinedOr<T>(decoder: Decoder<T>): Decoder<T | undefined>;
```

Returns a new decoder that also accepts `undefined`.

Notes:

- Using `undefinedOr` does _not_ make a field in an object optional. It only allows the field to be `undefined`. Similarly, using the [field](#field) function to mark a field as optional does not allow setting the field to `undefined`, only omitting it.
- JSON does not have `undefined` (only `null`). So `undefinedOr` is more useful when you are decoding something that does not come from JSON. However, even when working with JSON `undefinedOr` still has a use: If you infer types from decoders, using `undefinedOr` on object fields results in `| undefined` for the type of the field, which allows you to assign `undefined` to it which is occasionally useful.

### nullable

```ts
function nullable<T>(decoder: Decoder<T>): Decoder<T | null>;
```

Returns a new decoder that also accepts `null`.

### map

```ts
function map<T, U>(decoder: Decoder<T>, transform: (value: T) => U): Decoder<U>;
```

Run a function after a decoder (if it succeeds). The function transforms the decoded data.

Example:

```ts
const numberSetDecoder: Decoder<Set<number>> = map(
  array(number),
  (arr) => new Set(arr),
);
```

### flatMap

```ts
function flatMap<T, U>(
  decoder: Decoder<T>,
  transform: (value: T) => DecoderResult<U>,
): Decoder<U>;
```

Run a function after a decoder (if it succeeds). The function decodes the decoded data further, returning another `DecoderResult` which is then “flattened” (so you don’t end up with a `DecoderResult` inside a `DecoderResult`).

Example:

```ts
const regexDecoder: Decoder<RegExp> = flatMap(string, (str) => {
  try {
    return { tag: "Valid", value: RegExp(str, "u") };
  } catch (error) {
    return {
      tag: "DecoderError",
      error: {
        tag: "custom",
        message: error instanceof Error ? error.message : String(error),
        got: str,
        path: [],
      },
    };
  }
});
```

Note: Sometimes TypeScript has trouble inferring the return type of the `transform` function. No matter what you do, it keeps complaining. In such cases it helps to add return type annotation on the `transform` function.

## DecoderError

```ts
type DecoderError = {
  path: Array<number | string>;
  orExpected?: "null or undefined" | "null" | "undefined";
} & (
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
      tag: "missing field";
      field: string;
      got: Record<string, unknown>;
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
  | {
      tag: "wrong tag";
      expected: string;
      got: string;
    }
  | { tag: "array"; got: unknown }
  | { tag: "boolean"; got: unknown }
  | { tag: "number"; got: unknown }
  | { tag: "object"; got: unknown }
  | { tag: "string"; got: unknown }
);
```

The error returned by all decoders. It keeps track of where in the JSON the error occurred.

Use the [format](#format) function to get a nice string explaining what went wrong.

```ts
const myDecoder = array(string);

const decoderResult = myDecoder(someUnknownValue);
switch (decoderResult.tag) {
  case "DecoderError":
    console.error(format(decoderResult.error));
    break;
  case "Valid":
    console.log(decoderResult.value);
    break;
}
```

When creating your own `DecoderError`, you probably want to do something like this:

```ts
const myError: DecoderError = {
  tag: "custom", // You probably want "custom".
  message: "my message", // What you expected, or what went wrong.
  got: theValueYouTriedToDecode,
  // Usually the empty array; put the object key or array index you’re at if
  // that makes sense. This will show up as for example `At root["myKey"]`.
  path: [],
};
```

`orExpected` exists so that `undefinedOr` and `nullable` can say that `undefined` and/or `null` also are expected values.

## format

```ts
function format(error: DecoderError, options?: ReprOptions): string;
```

Turn the `DecoderError` into a nicely formatted string. It uses [repr](#repr) under the hood and takes the same options.

## repr

```ts
type ReprOptions = {
  depth?: number | undefined;
  indent?: string | undefined;
  maxArrayChildren?: number | undefined;
  maxObjectChildren?: number | undefined;
  maxLength?: number | undefined;
  sensitive?: boolean | undefined;
};

function repr(
  value: unknown,
  {
    depth = 0,
    indent = "  ",
    maxArrayChildren = 5,
    maxObjectChildren = 5,
    maxLength = 100,
    sensitive = false,
  }: ReprOptions = {},
): string;
```

Takes any value, and returns a string representation of it for use in error messages. [DecoderError.prototype.format](#format) uses it behind the scenes. If you want to do your own formatting, `repr` can be useful.

Options:

| name | type | default | description |
| --- | --- | --- | --- |
| depth | `number` | `0` | How deep to recursively call `repr` on array items and object values. |
| indent | `string` | `"  "` (two spaces) | The indentation to use for nested values when `depth` is larger than 0. |
| maxArrayChildren | `number` | `5` | The number of array items to print. |
| maxObjectChildren | `number` | `5` | The number of object key-values to print. |
| maxLength | `number` | `100` | The maximum length of literals, such as strings, before truncating them. |
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

## Type inference

Rather than first defining the type and then defining the decoder (which often feels like writing the type twice), you can _only_ define the decoder and then infer the type.

```ts
const personDecoder = fieldsAuto({
  name: string,
  age: number,
});

type Person = Infer<typeof personDecoder>;
// equivalent to:
type Person = {
  name: string;
  age: number;
};
```

The `Infer` utility type is currently basically just an alias to the TypeScript built-in `ReturnType` utility type, but it’s recommended to use `Infer` because in a future version of tiny-decoders it’ll need to do a little bit more than just `ReturnType` and then you don’t need to migrate.

See the [type inference example](examples/type-inference.test.ts) for more details.

## Things left out

Here are some decoders I’ve left out. They are rarely needed or not needed at all, and/or too trivial to be included in a decoding library _for the minimalist._

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
  decoder2: Decoder<U>,
): Decoder<T | U>;
```

This decoder would try `decoder1` first. If it fails, go on and try `decoder2`. If that fails, present both errors. I consider this a blunt tool.

- If you want either a string or a number, use [multi](#multi). This let’s you switch between any JSON types.
- For objects that can be decoded in different ways, use [fieldsUnion](#fieldsunion). If that’s not possible, see the [untagged union example](examples/untagged-union.test.ts) for how you can approach the problem.

The above approaches result in a much simpler [DecoderError](#decodererror) type, and also results in much better error messages, since there’s never a need to present something like “decoding failed in the following 2 ways: …”
