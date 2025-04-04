# tiny-decoders [![minified size](https://img.shields.io/bundlephobia/min/tiny-decoders.svg)](https://bundlephobia.com/result?p=tiny-decoders)

Type-safe data decoding and encoding for the minimalist.

## Installation

```
npm install tiny-decoders
```

👉 [Codecs summary](#codecs)

## TypeScript requirements

tiny-decoders requires TypeScript 5+ (because it uses [const type parameters](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#const-type-parameters)).

It is recommended to enable the following `tsconfig.json` options:

- [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes) – see the note at the [field](#field) function.
- [strictFunctionTypes](https://www.typescriptlang.org/tsconfig#strictFunctionTypes) – see [issue 50](https://github.com/lydell/tiny-decoders/issues/50) (which also contains a workaround if you aren’t able to turn this option on). This option is included in the [strict](https://www.typescriptlang.org/tsconfig/#strict) option.

Note that it is possible to use tiny-decoders in plain JavaScript without type checking as well.

## Example

```ts
import {
  array,
  boolean,
  field,
  fields,
  format,
  type Infer,
  number,
  string,
} from "tiny-decoders";

// You can also import into a namespace if you want (conventionally called `Codec`):
import * as Codec from "tiny-decoders";

const userCodec = fields({
  name: string,
  active: field(boolean, { renameFrom: "is_active" }),
  age: field(number, { optional: true }),
  interests: array(string),
});

type User = Infer<typeof userCodec>;
// equivalent to:
type User = {
  name: string;
  active: boolean;
  age?: number;
  interests: Array<string>;
};

const payload: unknown = getSomeJSON();

const userResult: DecoderResult<User> = userCodec.decoder(payload);

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

## Codec&lt;T&gt; and DecoderResult&lt;T&gt;

```ts
type Codec<Decoded, Encoded = unknown> = {
  decoder: (value: unknown) => DecoderResult<Decoded>;
  encoder: (value: Decoded) => Encoded;
};

type DecoderResult<Decoded> =
  | {
      tag: "DecoderError";
      error: DecoderError;
    }
  | {
      tag: "Valid";
      value: Decoded;
    };
```

A codec is an object with a decoder and an encoder.

A decoder is a function that:

- Takes an `unknown` value and refines it to any type you want (`Decoded`).
- Returns a `DecoderResult`: Either that refined `Decoded` or a [DecoderError](#decodererror).

An encoder is a function that turns `Decoded` back into what the input looked like. You can think of it as “turning `Decoded` back into `unknown`”, but usually the `Encoded` type variable is inferred to something more precise.

That’s it!

tiny-decoders ships with a bunch of codecs, and a few functions to combine codecs. This way you can describe the shape of any data!

> tiny-decoders used to only have decoders, and not encoders. That’s why it’s called tiny-<strong>decoders</strong> and not tiny-<strong>codecs</strong>. Decoders are still the most interesting part.

## Codecs

Here’s a summary of all codecs (with slightly simplified type annotations) and related functions.

- Codec type: [Codec and DecoderResult](#codect-and-decoderresultt)
- Primitives: [unknown](#unknown), [boolean](#boolean), [number](#number), [bigint](#bigint), [string](#string)
- Collections: [array](#array), [record](#record), [tuple](#tuple)
- Object literals: [fields](#fields) with [field](#field)
- Unions:
  - Of primitive literals: [primitiveUnion](#primitiveunion)
  - Of different types: [multi](#multi)
  - Of tagged objects: [taggedUnion](#taggedunion) with [tag](#tag)
  - With undefined: [undefinedOr](#undefinedor)
  - With null: [nullOr](#nullOr)
  - Other unions: [untagged union example](examples/untagged-union.test.ts)
- Intersections: [intersection example](examples/taggedUnion-with-common-fields.test.ts)
- Transformation: [map](#map), [flatMap](#flatmap)
- Recursion: [recursive](#recursive)
- Errors: [DecoderError](#decodererror), [format](#format), [repr](#repr)
- JSON: [Replacement for JSON.parse and JSON.stringify](#replacement-for-jsonparse-and-jsonstringify)
- Tips: [Type inference](#type-inference), [things left out](#things-left-out)

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
<td>any</td>
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
<th><a href="#bigint">bigint</a></th>
<td><code>Codec&lt;bigint&gt;</code></td>
<td>n/a</td>
<td><code>bigint</code></td>
</tr>
<tr>
<th><a href="#string">string</a></th>
<td><code>Codec&lt;string&gt;</code></td>
<td>string</td>
<td><code>string</code></td>
</tr>
<th><a href="#primitiveunion">primitiveUnion</a></th>
<td><pre>(variants: [
  "string1",
  "string2",
  "stringN",
  1,
  2,
  true
]) =&gt; Codec&lt;
 "string1"
 | "string2"
 | "stringN"
 | 1
 | 2
 | true
&gt;</pre></td>
<td>string, number, boolean, null</td>
<td><pre>"string1"
| "string2"
| "stringN"
| 1
| 2
| true</pre></td>
</tr>
<tr>
<th><a href="#array">array</a></th>
<td><pre>(decoder: Codec&lt;T&gt;) =&gt;
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
 field2: Field&lt;
  T2,
  { optional: true }
 &gt;,
 field3: Field&lt;
  T3,
  { renameFrom: "field_3" }
 &gt;,
 fieldN: Codec&lt;TN&gt;
}) =&gt; Codec&lt;{
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
 codec: Codec&lt;Decoded&gt;,
 meta: Meta,
) =&gt; Field&lt;Decoded, Meta&gt;</pre></td>
<td>n/a</td>
<td>n/a, only used with <code>fields</code></td>
</tr>
<tr>
<th><a href="#taggedunion">taggedUnion</a></th>
<td><pre>(
 decodedCommonField: string,
 variants: Array&lt;
  Parameters&lt;typeof fields&gt;[0]
 &gt;,
) =&gt; Codec&lt;T1 | T2 | TN&gt;</pre></td>
<td>object</td>
<td><code>T1 | T2 | TN</code></td>
</tr>
<tr>
<th><a href="#tag">tag</a></th>
<td><pre>(
 decoded: "string literal",
 options?: Options,
) =&gt;
 Field&lt;"string literal", Meta&gt;</pre></td>
<td>string</td>
<td><code>"string literal"</code></td>
</tr>
<tr>
<th><a href="#tuple">tuple</a></th>
<td><pre>(codecs: [
 Codec&lt;T1&gt;,
 Codec&lt;T2&gt;,
 Codec&lt;TN&gt;
]) =&gt; Codec&lt;[T1, T2, TN]&gt;</pre></td>
<td>array</td>
<td><code>[T1, T2, TN]</code></td>
</tr>
<tr>
<th><a href="#multi">multi</a></th>
<td><pre>(types: [
 "type1",
 "type2",
 "type10"
]) =&gt; Codec&lt;
   { type: "type1",
     value: type1 }
 | { type: "type2",
     value: type2 }
 | { type: "type10",
     value: type10 }
&gt;</pre></td>
<td>you decide</td>
<td>A subset of: <pre>  { type: "undefined";
    value: undefined }
| { type: "null";
    value: null }
| { type: "boolean";
    value: boolean }
| { type: "number";
    value: number }
| { type: "bigint";
    value: bigint }
| { type: "string";
    value: string }
| { type: "symbol";
    value: symbol }
| { type: "function";
    value: Function }
| { type: "array";
    value: Array<unknown> }
| { type: "object";
    value: Record<string, unknown> }</pre></td>
</tr>
<tr>
<th><a href="#recursive">recursive</a></th>
<td><pre>(callback: () =&gt; Codec&lt;T&gt;) =&gt;
 Codec&lt;T&gt;</pre></td>
<td>n/a</td>
<td><code>T</code></td>
</tr>
<tr>
<th><a href="#undefinedor">undefinedOr</a></th>
<td><pre>(codec: Codec&lt;T&gt;) =&gt;
 Codec&lt;T | undefined&gt;</pre></td>
<td>undefined or …</td>
<td><code>T | undefined</code></td>
</tr>
<tr>
<th><a href="#nullOr">nullOr</a></th>
<td><pre>(codec: Codec&lt;T&gt;) =&gt;
 Codec&lt;T | null&gt;</pre></td>
<td>null or …</td>
<td><code>T | null</code></td>
</tr>
<tr>
<th><a href="#map">map</a></th>
<td><pre>(
 codec: Codec&lt;T&gt;,
 transform: {
  decoder: (value: T) =&gt; U;
  encoder: (value: U) =&gt; T;
 },
) =&gt; Codec&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
<tr>
<th><a href="#flatmap">flatMap</a></th>
<td><pre>(
 decoder: Codec&lt;T&gt;,
 transform: {
  decoder: (value: T) =&gt;
   DecoderResult&lt;U&gt;;
  encoder: (value: U) =&gt; T;
 },
) =&gt; Codec&lt;U&gt;</pre></td>
<td>n/a</td>
<td><code>U</code></td>
</tr>
</tbody>
</table>

### unknown

```ts
const unknown: Codec<unknown>;
```

Codec for any JSON value, and a TypeScript `unknown`. Basically, both the decoder and encoder are identity functions.

### boolean

```ts
const boolean: Codec<boolean, boolean>;
```

Codec for a JSON boolean, and a TypeScript `boolean`.

### number

```ts
const number: Codec<number, number>;
```

Codec for a JSON number, and a TypeScript `number`.

### bigint

```ts
const bigint: Codec<bigint, bigint>;
```

Codec for a JavaScript `bigint`, and a TypeScript `bigint`.

Note: JSON does not have bigint. You need to serialize them to strings, and then parse them to bigint. This function does _not_ do that for you. It is only useful when you are decoding values that already are JavaScript bigint, but are `unknown` to TypeScript.

### string

```ts
const string: Codec<string, string>;
```

Codec for a JSON string, and a TypeScript `string`.

### primitiveUnion

```ts
function primitiveUnion<
  const Variants extends readonly [primitive, ...Array<primitive>],
>(variants: Variants): Codec<Variants[number], Variants[number]>;

type primitive = bigint | boolean | number | string | symbol | null | undefined;
```

Codec for a set of specific primitive values, and a TypeScript union of those values.

The `variants` is an array of the values you want. You must provide at least one variant. If you provide exactly one variant, you get a codec for a single, constant, exact value (a union with just one variant).

If you have an object and want to use its keys for a string union there’s an example of that in the [type inference example](examples/type-inference.test.ts).

Example:

```ts
type Color = "green" | "red";

const colorCodec: Codec<Color> = primitiveUnion(["green", "red"]);
```

### array

```ts
function array<DecodedItem, EncodedItem>(
  codec: Codec<DecodedItem, EncodedItem>,
): Codec<Array<DecodedItem>, Array<EncodedItem>>;
```

Codec for a JSON array, and a TypeScript `Array`.

The passed `codec` is for each item of the array.

For example, `array(string)` is a codec for an array of strings (`Array<string>`).

### record

```ts
function record<DecodedValue, EncodedValue>(
  codec: Codec<DecodedValue, EncodedValue>,
): Codec<Record<string, DecodedValue>, Record<string, EncodedValue>>;
```

Codec for a JSON object, and a TypeScript `Record`. (Yes, this function is named after TypeScript’s type. Other languages call this a “dict”.)

The passed `codec` is for each value of the object.

For example, `record(number)` is a codec for an object where the keys can be anything and the values are numbers (`Record<string, number>`).

### fields

```ts
function fields<Mapping extends FieldsMapping>(
  mapping: Mapping,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Codec<InferFields<Mapping>, InferEncodedFields<Mapping>>;

type FieldsMapping = Record<string, Codec<any> | Field<any, any, FieldMeta>>;

type Field<Decoded, Encoded, Meta extends FieldMeta> = Meta & {
  codec: Codec<Decoded, Encoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: primitive; encoded: primitive } | undefined;
};

type primitive = bigint | boolean | number | string | symbol | null | undefined;

type InferFields<Mapping extends FieldsMapping> = magic;

type InferEncodedFields<Mapping extends FieldsMapping> = magic;
```

Codec for a JSON object with certain fields, and a TypeScript object type/interface with known fields.

The `mapping` parameter is an object with the keys you want in your TypeScript object. The values are either `Codec`s or `Field`s. A `Field` is just a `Codec` with some metadata: Whether the field is optional, and whether the field has a different name in the JSON object. Passing a plain `Codec` instead of a `Field` is just a convenience shortcut for passing a `Field` with the default metadata (the field is required, and has the same name both in TypeScript and in JSON).

Use the [field](#field) function to create a `Field` – use it when you need to mark a field as optional, or when it has a different name in JSON than in TypeScript.

Example:

```ts
type User = {
  name: string;
  age?: number;
  active: boolean;
};

const userCodec: Codec<User> = fields({
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
function field<Decoded, Encoded, const Meta extends Omit<FieldMeta, "tag">>(
  codec: Codec<Decoded, Encoded>,
  meta: Meta,
): Field<Decoded, Encoded, Meta>;

type Field<Decoded, Encoded, Meta extends FieldMeta> = Meta & {
  codec: Codec<Decoded, Encoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: primitive; encoded: primitive } | undefined;
};

type primitive = bigint | boolean | number | string | symbol | null | undefined;
```

This function takes a codec and lets you:

- Mark a field as optional: `field(string, { optional: true })`
- Rename a field: `field(string, { renameFrom: "some_name" })`
- Both: `field(string, { optional: true, renameFrom: "some_name" })`

Use it with [fields](#fields).

The `tag` thing is handled by the [tag](#tag) function. It’s not something you’ll set manually using `field`. (That’s why the type annotation says `Omit<FieldMeta, "tag">`.)

Here’s an example illustrating the difference between `field(string, { optional: true })` and `undefinedOr(string)`:

```ts
const exampleCodec = fields({
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

The inferred type from `exampleCodec` is:

```ts
type Example = {
  a: string;
  b?: string;
  c: string | undefined;
  d?: string | undefined;
};
```

> [!WARNING]  
> It is recommended to enable the [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes) option in `tsconfig.json`.
>
> Why? Let’s take this codec as an example:
>
> ```ts
> const exampleCodec = fields({
>   name: field(string, { optional: true }),
> });
> ```
>
> With `exactOptionalPropertyTypes` enabled, the inferred type for `exampleCodec` is:
>
> ```ts
> type Example = { name?: string };
> ```
>
> That type allows constructing `{}` or `{ name: "some string" }`. If you pass either of those to `exampleCodec.decoder` (such as `exampleCodec.decoder({ name: "some string" })`), the decoder will succeed. It makes sense that a decoder accepts things that it has produced itself (when no transformation is involved).
>
> With `exactOptionalPropertyTypes` turned off (which is the default), the inferred type for `exampleCodec` is:
>
> ```ts
> type Example = { name?: string | undefined };
> ```
>
> Notice the added `| undefined`. That allows also constructing `{ name: undefined }`. But if you run `exampleCodec.decoder({ name: undefined })`, the decoder will fail. The decoder only supports `name` existing and being set to a string, or `name` being missing. It does not support it being set to `undefined` explicitly. If you wanted to support that, use `undefinedOr`:
>
> ```ts
> const exampleCodec = fields({
>   name: field(undefinedOr(string), { optional: true }),
> });
> ```
>
> That gives the same inferred type, but also supports decoding the `name` field being set to `undefined` explicitly.
>
> All in all, you avoid a slight gotcha with optional fields and inferred types if you enable `exactOptionalPropertyTypes`.

### taggedUnion

```ts
function taggedUnion<
  const DecodedCommonField extends keyof Variants[number],
  Variants extends readonly [
    Variant<DecodedCommonField>,
    ...Array<Variant<DecodedCommonField>>,
  ],
>(
  decodedCommonField: DecodedCommonField,
  variants: Variants,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Codec<
  InferFieldsUnion<Variants[number]>,
  InferEncodedFieldsUnion<Variants[number]>
>;

type Variant<DecodedCommonField extends number | string | symbol> = Record<
  DecodedCommonField,
  Field<any, any, { tag: { decoded: primitive; encoded: primitive } }>
> &
  Record<string, Codec<any> | Field<any, any, FieldMeta>>;

type primitive = bigint | boolean | number | string | symbol | null | undefined;

type InferFieldsUnion<MappingsUnion extends FieldsMapping> = magic;

type InferEncodedFieldsUnion<MappingsUnion extends FieldsMapping> = magic;

// See `fields` for the definitions of `Field`, `FieldMeta` and `FieldsMapping`.
```

Codec for JSON objects with a common field (that tells them apart), and a TypeScript tagged union type.

The `decodedCommonField` is the name of the common field.

`variants` is an array of objects. Those objects are “`fields` objects” – they fit when passed to `fields` as well. All of those objects must have `decodedCommonField` as a key, and use the [tag](#tag) function on that key.

```ts
type Shape =
  | { tag: "Circle"; radius: number }
  | { tag: "Rectangle"; width: number; height: number };

const shapeCodec: Codec<Shape> = taggedUnion("tag", [
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

The `allowExtraFields` option works just like for [fields](#fields).

See also these examples:

- [Renaming union field](examples/renaming-union-field.test.ts)
- [`taggedUnion` with common fields](examples/taggedUnion-with-common-fields.test.ts)

Note: If you use the same tag value twice, the last one wins. TypeScript infers a type with two variants with the same tag (which is a valid type), but tiny-decoders can’t tell them apart. Nothing will ever decode to the first one, only the last one will succeed. Trying to encode the first one might result in bad data.

### tag

```ts
function tag<
  const Decoded extends primitive,
  const Encoded extends primitive,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  options: {
    renameTagFrom?: Encoded;
    renameFieldFrom?: EncodedFieldName;
  } = {},
): Field<
  Decoded,
  Encoded,
  {
    renameFrom: EncodedFieldName | undefined;
    tag: { decoded: primitive; encoded: primitive };
  }
>;

type primitive = bigint | boolean | number | string | symbol | null | undefined;
```

Used with [taggedUnion](#taggedunion), once for each variant of the union.

`tag("MyTag")` returns a `Field` with a codec that requires the input `"MyTag"` and returns `"MyTag"`. The metadata of the `Field` also advertises that the tag value is `"MyTag"`, which `taggedUnion` uses to know what to do.

`tag("MyTag", { renameTagFrom: "my_tag" })` returns a `Field` with a codec that requires the input `"my_tag"` but returns `"MyTag"`.

For `renameFieldFrom`, see the [Renaming union field](examples/renaming-union-field.test.ts) example.

You will typically use string tags for your tagged unions, but other primitive types such as `boolean` and `number` are supported too.

### tuple

```ts
function tuple<const Codecs extends ReadonlyArray<Codec<any>>>(
  codecs: Codecs,
): Codec<InferTuple<Codecs>, InferEncodedTuple<Codecs>>;

type InferTuple<Codecs extends ReadonlyArray<Codec<any>>> = magic;

type InferEncodedTuple<Codecs extends ReadonlyArray<Codec<any>>> = magic;
```

Codec for a JSON array, and a TypeScript tuple. They both must have the exact same length, otherwise the decoder fails.

Example:

```ts
type Point = [number, number];

const pointCodec: Codec<Point> = tuple([number, number]);
```

See the [tuples example](examples/tuples.test.ts) for more details.

### multi

```ts
function multi<Types extends readonly [MultiTypeName, ...Array<MultiTypeName>]>(
  types: Types,
): Codec<Multi<Types[number]>, Multi<Types[number]>["value"]>;

type MultiTypeName =
  | "array"
  | "bigint"
  | "boolean"
  | "function"
  | "null"
  | "number"
  | "object"
  | "string"
  | "symbol"
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
          : Types extends "bigint"
            ? { type: "bigint"; value: bigint }
            : Types extends "string"
              ? { type: "string"; value: string }
              : Types extends "symbol"
                ? { type: "symbol"; value: symbol }
                : Types extends "function"
                  ? { type: "function"; value: Function }
                  : Types extends "array"
                    ? { type: "array"; value: Array<unknown> }
                    : Types extends "object"
                      ? { type: "object"; value: Record<string, unknown> }
                      : never
  : never;
```

Codec for multiple types, and a TypeScript tagged union for those types.

This is useful for supporting stuff that can be either a string or a number, for example. It lets you do a JavaScript `typeof`, basically.

The type annotation for `multi` is a bit wacky, but it’s not that complicated to use. The `types` parameter is an array of strings – the wanted types. For example, you can say `["string", "number"]`. Then the decoder will give you back either `{ type: "string", value: string }` or `{ type: "number", value: number }`. You can use [map](#map) to map that to some type of choice, or [flatMap](#flatmap) to decode further.

The `types` strings are the same as the JavaScript [typeof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof) returns, with two exceptions:

- `null` is `"null"` instead of `"object"` (because `typeof null === "object"` is a famous mistake).
- `array` is `"array"` instead of `"object"` (because arrays are very common).

If you need to tell other objects apart, write a custom codec.

Example:

```ts
type Id = { tag: "Id"; id: string } | { tag: "LegacyId"; id: number };

const idCodec: Codec<Id> = map(multi(["string", "number"]), {
  decoder: (value) => {
    switch (value.type) {
      case "string":
        return { tag: "Id" as const, id: value.value };
      case "number":
        return { tag: "LegacyId" as const, id: value.value };
    }
  },
  encoder: (id) => {
    switch (id.tag) {
      case "Id":
        return { type: "string", value: id.id };
      case "LegacyId":
        return { type: "number", value: id.id };
    }
  },
});
```

### recursive

```ts
function recursive<Decoded, Encoded>(
  callback: () => Codec<Decoded, Encoded>,
): Codec<Decoded, Encoded>;
```

When you make a codec for a recursive data structure, you might end up with errors like:

```
ReferenceError: Cannot access 'myCodec' before initialization
```

The solution is to wrap `myCodec` in `recursive`: `recursive(() => myCodec)`. The unnecessary-looking arrow function delays the reference to `myCodec` so we’re able to define it.

See the [recursive example](examples/recursive.test.ts) for more information.

### undefinedOr

```ts
function undefinedOr<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | undefined, Encoded | undefined>;
```

Returns a new codec that also accepts `undefined`.

Notes:

- Using `undefinedOr` does _not_ make a field in an object optional. It only allows the field to be `undefined`. Similarly, using the [field](#field) function to mark a field as optional does not allow setting the field to `undefined`, only omitting it.
- JSON does not have `undefined` (only `null`). So `undefinedOr` is more useful when you are decoding something that does not come from JSON. However, even when working with JSON `undefinedOr` still has a use: If you infer types from codecs, using `undefinedOr` on object fields results in `| undefined` for the type of the field, which allows you to assign `undefined` to it which is occasionally useful.

### nullOr

```ts
function nullOr<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | null, Encoded | null>;
```

Returns a new codec that also accepts `null`.

### map

```ts
function map<const Decoded, Encoded, NewDecoded>(
  codec: Codec<Decoded, Encoded>,
  transform: {
    decoder: (value: Decoded) => NewDecoded;
    encoder: (value: NewDecoded) => Readonly<Decoded>;
  },
): Codec<NewDecoded, Encoded>;
```

Run a function (`transform.decoder`) after a decoder (if it succeeds). The function transforms the decoded data. `transform.encoder` turns the transformed data back again.

Example:

```ts
const numberSetCodec: Codec<Set<number>> = map(array(number), {
  decoder: (arr) => new Set(arr),
  encoder: Array.from,
});
```

### flatMap

```ts
function flatMap<const Decoded, Encoded, NewDecoded>(
  codec: Codec<Decoded, Encoded>,
  transform: {
    decoder: (value: Decoded) => DecoderResult<NewDecoded>;
    encoder: (value: NewDecoded) => Readonly<Decoded>;
  },
): Codec<NewDecoded, Encoded>;
```

Run a function (`transform.decoder`) after a decoder (if it succeeds). The function decodes the decoded data further, returning another `DecoderResult` which is then “flattened” (so you don’t end up with a `DecoderResult` inside a `DecoderResult`). `transform.encoder` turns the transformed data back again.

Example:

```ts
const regexCodec: Codec<RegExp> = flatMap(string, {
  decoder: (str) => {
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
  },
  encoder: (regex) => regex.source,
});
```

Note: Sometimes TypeScript has trouble inferring the return type of the `transform.decoder` function. No matter what you do, it keeps complaining. In such cases it helps to add return type annotation on the `transform.decoder` function.

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
      tag: "unknown taggedUnion tag";
      knownTags: Array<primitive>;
      got: unknown;
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
      tag: "unknown primitiveUnion variant";
      knownVariants: Array<primitive>;
      got: unknown;
    }
  | {
      tag: "wrong tag";
      expected: primitive;
      got: unknown;
    }
  | { tag: "array"; got: unknown }
  | { tag: "bigint"; got: unknown }
  | { tag: "boolean"; got: unknown }
  | { tag: "number"; got: unknown }
  | { tag: "object"; got: unknown }
  | { tag: "string"; got: unknown }
);

type primitive = bigint | boolean | number | string | symbol | null | undefined;
```

The error returned by all decoders. It keeps track of where in the JSON the error occurred.

Use the [format](#format) function to get a nice string explaining what went wrong.

```ts
const myCodec = array(string);

const decoderResult = myCodec.decoder(someUnknownValue);
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

`orExpected` exists so that `undefinedOr` and `nullOr` can say that `undefined` and/or `null` also are expected values.

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

Takes any value, and returns a string representation of it for use in error messages. [format](#format) uses it behind the scenes. If you want to do your own formatting, `repr` can be useful.

Options:

| name | type | default | description |
| --- | --- | --- | --- |
| depth | `number` | `0` | How deep to recursively call `repr` on array items and object values. |
| indent | `string` | `"  "` (two spaces) | The indentation to use for nested values when `depth` is larger than 0. |
| maxArrayChildren | `number` | `5` | The number of array items to print. |
| maxObjectChildren | `number` | `5` | The number of object key-values to print. |
| maxLength | `number` | `100` | The maximum length of literals, such as strings, before truncating them. |
| sensitive | `boolean` | `false` | Set it to `true` if you deal with sensitive data to avoid leaks. See below. |

`format(someDecoderError)` example:

```
At root["details"]["ssn"]:
Expected a string
Got: 123456789
```

`format(someDecoderError, { sensitive: true })` example:

```
At root["details"]["ssn"]:
Expected a string
Got: number
(Actual values are hidden in sensitive mode.)
```

It’s helpful when errors show you the actual values that failed decoding to make it easier to understand what happened. However, if you’re dealing with sensitive data, such as email addresses, passwords or social security numbers, you might not want that data to potentially appear in error logs.

## Replacement for JSON.parse and JSON.stringify

```ts
const JSON: {
  parse<Decoded>(
    codec: Codec<Decoded>,
    jsonString: string,
  ): DecoderResult<Decoded>;

  stringify<Decoded, Encoded>(
    codec: Codec<Decoded, Encoded>,
    value: Decoded,
    space?: number | string,
  ): string;
};
```

tiny-decoders exports a `JSON` object with `parse` and `stringify` methods, similar to the standard global `JSON` object. The difference is that tiny-decoder’s versions also take a `Codec`, which makes them safer.

You can use ESLint’s [no-restricted-globals](https://eslint.org/docs/latest/rules/no-restricted-globals) rule to forbid the global `JSON` object, for maximum safety:

```json
{
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "name": "JSON",
        "message": "Import JSON from tiny-decoders and use its JSON.parse and JSON.stringify with a codec instead."
      }
    ]
  }
}
```

> [!NOTE]  
> The standard `JSON.stringify` can return `undefined` (if you try to stringify `undefined` itself, or a function or a symbol). tiny-decoder’s `JSON.stringify` _always_ returns a string – it returns `"null"` for `undefined`, functions and symbols.

## Type inference

Rather than first defining the type and then defining the codec (which often feels like writing the type twice), you can _only_ define the decoder and then infer the type.

```ts
const personCodec = fields({
  name: string,
  age: number,
});

type Person = Infer<typeof personCodec>;
// equivalent to:
type Person = {
  name: string;
  age: number;
};
```

This is a nice pattern (naming the type and the codec the same):

```ts
type Person = Infer<typeof Person>;
const Person = fields({
  name: string,
  age: number,
});
```

Note that if you don’t annotate a codec, TypeScript infers both type parameters of `Codec<Decoded, Encoded>`. But if you annotate it with `Codec<MyType>`, TypeScript does _not_ infer `Encoded` – it will become `unknown`. If you specify one type parameter, TypeScript stops inferring them altogether and requires you to specify _all_ of them – except the ones with defaults. `Encoded` defaults to `unknown`, which is usually fine, but occasionally you need to work with a more precise type for `Encoded`. Then it might even be easier to leave out the type annotation!

See the [type inference example](examples/type-inference.test.ts) for more details.

## Things left out

### either

```ts
// 🚨 Does not exist!
function either<T, U>(codec1: Codec<T>, codec2: Codec<U>): Codec<T | U>;
```

The decoder of this codec would try `codec1.decoder` first. If it fails, go on and try `codec2.decoder`. If that fails, present both errors. I consider this a blunt tool.

- If you want either a string or a number, use [multi](#multi). This let’s you switch between any JSON types.
- For objects that can be decoded in different ways, use [taggedUnion](#taggedunion). If that’s not possible, see the [untagged union example](examples/untagged-union.test.ts) for how you can approach the problem.

The above approaches result in a much simpler [DecoderError](#decodererror) type, and also results in much better error messages, since there’s never a need to present something like “decoding failed in the following 2 ways: …”
