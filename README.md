# tiny-decoders

Type-safe data decoding for the minimalist.

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
<!-- prettier-ignore-end -->

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
- Some decoders support [pushing errors to an array](#TODO).

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

### number

### string

### constant

### stringUnion

### array

### record

### fields

### fieldsAuto

### fieldsUnion

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
