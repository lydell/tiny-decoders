// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Decoder<T, U = unknown> = (value: U) => T;

export type Infer<T extends Decoder<any>> = ReturnType<T>;

// Make VSCode show `{ a: string; b?: number }` instead of `{ a: string } & { b?: number }`.
// https://stackoverflow.com/a/57683652/2010616
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new DecoderError({ tag: "boolean", got: value });
  }
  return value;
}

export function number(value: unknown): number {
  if (typeof value !== "number") {
    throw new DecoderError({ tag: "number", got: value });
  }
  return value;
}

export function string(value: unknown): string {
  if (typeof value !== "string") {
    throw new DecoderError({ tag: "string", got: value });
  }
  return value;
}

export function stringUnion<
  const T extends readonly [string, ...Array<string>],
>(variants: T): Decoder<T[number]> {
  return function stringUnionDecoder(value: unknown): T[number] {
    const str = string(value);
    if (!variants.includes(str)) {
      throw new DecoderError({
        tag: "unknown stringUnion variant",
        knownVariants: variants as unknown as Array<string>,
        got: str,
      });
    }
    return str;
  };
}

function unknownArray(value: unknown): Array<unknown> {
  if (!Array.isArray(value)) {
    throw new DecoderError({ tag: "array", got: value });
  }
  return value;
}

function unknownRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DecoderError({ tag: "object", got: value });
  }
  return value as Record<string, unknown>;
}

export function array<T>(decoder: Decoder<T>): Decoder<Array<T>> {
  return function arrayDecoder(value: unknown): Array<T> {
    const arr = unknownArray(value);
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      try {
        result.push(decoder(arr[index]));
      } catch (error) {
        throw DecoderError.at(error, index);
      }
    }
    return result;
  };
}

export function record<T>(decoder: Decoder<T>): Decoder<Record<string, T>> {
  return function recordDecoder(value: unknown): Record<string, T> {
    const object = unknownRecord(value);
    const keys = Object.keys(object);
    const result: Record<string, T> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      try {
        result[key] = decoder(object[key]);
      } catch (error) {
        throw DecoderError.at(error, key);
      }
    }

    return result;
  };
}

type Field<Decoded, Meta extends FieldMeta> = Meta & {
  decoder: Decoder<Decoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: string; encoded: string } | undefined;
};

type FieldsMapping = Record<string, Decoder<any> | Field<any, FieldMeta>>;

type InferField<T extends Decoder<any> | Field<any, FieldMeta>> =
  T extends Field<any, FieldMeta>
    ? Infer<T["decoder"]>
    : T extends Decoder<any>
    ? Infer<T>
    : never;

type InferFields<Mapping extends FieldsMapping> = Expand<
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
  {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? never
      : Key]: InferField<Mapping[Key]>;
  } & {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? Key
      : never]?: InferField<Mapping[Key]>;
  }
>;

export function fieldsAuto<Mapping extends FieldsMapping>(
  mapping: Mapping,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Decoder<InferFields<Mapping>> {
  return function fieldsAutoDecoder(value): InferFields<Mapping> {
    const object = unknownRecord(value);
    const keys = Object.keys(mapping);
    const knownFields = new Set<string>();
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      const fieldOrDecoder = mapping[key];
      const field_: Field<any, FieldMeta> =
        "decoder" in fieldOrDecoder
          ? fieldOrDecoder
          : { decoder: fieldOrDecoder };
      const {
        decoder,
        renameFrom: encodedFieldName = key,
        optional: isOptional = false,
      } = field_;
      if (encodedFieldName === "__proto__") {
        continue;
      }
      knownFields.add(encodedFieldName);
      if (!(encodedFieldName in object)) {
        if (!isOptional) {
          throw new DecoderError({
            tag: "missing field",
            field: encodedFieldName,
            got: object,
          });
        }
        continue;
      }
      try {
        result[key] = decoder(object[encodedFieldName]);
      } catch (error) {
        throw DecoderError.at(error, key);
      }
    }

    if (!allowExtraFields) {
      const unknownFields = Object.keys(object).filter(
        (key) => !knownFields.has(key),
      );
      if (unknownFields.length > 0) {
        throw new DecoderError({
          tag: "exact fields",
          knownFields: Array.from(knownFields),
          got: unknownFields,
        });
      }
    }

    return result as InferFields<Mapping>;
  };
}

export function field<Decoded, const Meta extends Omit<FieldMeta, "tag">>(
  decoder: Decoder<Decoded>,
  meta: Meta,
): Field<Decoded, Meta> {
  return {
    decoder,
    ...meta,
  };
}

type InferFieldsUnion<MappingsUnion extends FieldsMapping> =
  MappingsUnion extends any ? InferFields<MappingsUnion> : never;

type Variant<DecodedCommonField extends number | string | symbol> = Record<
  DecodedCommonField,
  Field<any, { tag: { decoded: string; encoded: string } }>
> &
  Record<string, Decoder<any> | Field<any, FieldMeta>>;

export function fieldsUnion<
  const DecodedCommonField extends keyof Variants[number],
  Variants extends readonly [
    Variant<DecodedCommonField>,
    ...ReadonlyArray<Variant<DecodedCommonField>>,
  ],
>(
  decodedCommonField: DecodedCommonField,
  variants: Variants,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Decoder<InferFieldsUnion<Variants[number]>> {
  if (decodedCommonField === "__proto__") {
    throw new Error("fieldsUnion: commonField cannot be __proto__");
  }

  const decoderMap = new Map<string, Decoder<any>>(); // encodedName -> decoder

  let maybeEncodedCommonField: number | string | symbol | undefined = undefined;

  for (const [index, variant] of variants.entries()) {
    const field_: Field<
      any,
      FieldMeta & { tag: { decoded: string; encoded: string } }
    > = variant[decodedCommonField];
    const { renameFrom: encodedFieldName = decodedCommonField } = field_;
    if (maybeEncodedCommonField === undefined) {
      maybeEncodedCommonField = encodedFieldName;
    } else if (maybeEncodedCommonField !== encodedFieldName) {
      throw new Error(
        `fieldsUnion: Variant at index ${index}: Key ${JSON.stringify(
          decodedCommonField,
        )}: Got a different encoded field name (${JSON.stringify(
          encodedFieldName,
        )}) than before (${JSON.stringify(maybeEncodedCommonField)}).`,
      );
    }
    const fullDecoder = fieldsAuto(variant, { allowExtraFields });
    decoderMap.set(field_.tag.encoded, fullDecoder);
  }

  if (typeof maybeEncodedCommonField !== "string") {
    throw new Error(
      `fieldsUnion: Got unusable encoded common field: ${repr(
        maybeEncodedCommonField,
      )}`,
    );
  }

  const encodedCommonField = maybeEncodedCommonField;

  return function fieldsUnionDecoder(
    value: unknown,
  ): InferFieldsUnion<Variants[number]> {
    const encodedName = fieldsAuto({ [encodedCommonField]: string })(value)[
      encodedCommonField
    ];
    const decoder = decoderMap.get(encodedName);
    if (decoder === undefined) {
      throw new DecoderError({
        tag: "unknown fieldsUnion tag",
        knownTags: Array.from(decoderMap.keys()),
        got: encodedName,
        key: encodedCommonField,
      });
    }
    return decoder(value) as InferFieldsUnion<Variants[number]>;
  };
}

export function tag<const Decoded extends string>(
  decoded: Decoded,
): Field<Decoded, { tag: { decoded: string; encoded: string } }>;

export function tag<const Decoded extends string, const Encoded extends string>(
  decoded: Decoded,
  options: {
    renameTagFrom: Encoded;
  },
): Field<Decoded, { tag: { decoded: string; encoded: string } }>;

export function tag<
  const Decoded extends string,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  options: {
    renameFieldFrom: EncodedFieldName;
  },
): Field<
  Decoded,
  { renameFrom: EncodedFieldName; tag: { decoded: string; encoded: string } }
>;

export function tag<
  const Decoded extends string,
  const Encoded extends string,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  options: {
    renameTagFrom: Encoded;
    renameFieldFrom: EncodedFieldName;
  },
): Field<
  Decoded,
  { renameFrom: EncodedFieldName; tag: { decoded: string; encoded: string } }
>;

export function tag<
  const Decoded extends string,
  const Encoded extends string,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  {
    renameTagFrom: encoded = decoded as unknown as Encoded,
    renameFieldFrom: encodedFieldName,
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
> {
  return {
    decoder: function tagDecoder(value: unknown): Decoded {
      const str = string(value);
      if (str !== encoded) {
        throw new DecoderError({
          tag: "wrong tag",
          expected: encoded,
          got: str,
        });
      }
      return decoded;
    },
    renameFrom: encodedFieldName,
    tag: { decoded, encoded },
  };
}

export function tuple<T extends Array<unknown>>(
  mapping: [...{ [P in keyof T]: Decoder<T[P]> }],
): Decoder<T> {
  return function tupleDecoder(value: unknown): T {
    const arr = unknownArray(value);
    if (arr.length !== mapping.length) {
      throw new DecoderError({
        tag: "tuple size",
        expected: mapping.length,
        got: arr.length,
      });
    }
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      try {
        const decoder = mapping[index];
        result.push(decoder(arr[index]));
      } catch (error) {
        throw DecoderError.at(error, index);
      }
    }
    return result as T;
  };
}

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

type MultiTypeName =
  | "array"
  | "boolean"
  | "null"
  | "number"
  | "object"
  | "string"
  | "undefined";

export function multi<
  Types extends readonly [MultiTypeName, ...Array<MultiTypeName>],
>(types: Types): Decoder<Multi<Types[number]>> {
  return function multiDecoder(value): Multi<Types[number]> {
    if (value === undefined) {
      if (types.includes("undefined")) {
        return { type: "undefined", value } as unknown as Multi<Types[number]>;
      }
    } else if (value === null) {
      if (types.includes("null")) {
        return { type: "null", value } as unknown as Multi<Types[number]>;
      }
    } else if (typeof value === "boolean") {
      if (types.includes("boolean")) {
        return { type: "boolean", value } as unknown as Multi<Types[number]>;
      }
    } else if (typeof value === "number") {
      if (types.includes("number")) {
        return { type: "number", value } as unknown as Multi<Types[number]>;
      }
    } else if (typeof value === "string") {
      if (types.includes("string")) {
        return { type: "string", value } as unknown as Multi<Types[number]>;
      }
    } else if (Array.isArray(value)) {
      if (types.includes("array")) {
        return { type: "array", value } as unknown as Multi<Types[number]>;
      }
    } else {
      if (types.includes("object")) {
        return { type: "object", value } as unknown as Multi<Types[number]>;
      }
    }
    throw new DecoderError({
      tag: "unknown multi type",
      knownTypes: types as unknown as Array<"undefined">, // Type checking hack.
      got: value,
    });
  };
}

export function recursive<T>(callback: () => Decoder<T>): Decoder<T> {
  return function recursiveDecoder(value: unknown): T {
    return callback()(value);
  };
}

export function undefinedOr<T>(decoder: Decoder<T>): Decoder<T | undefined>;

export function undefinedOr<T, U>(
  decoder: Decoder<T>,
  defaultValue: U,
): Decoder<T | U>;

export function undefinedOr<T, U = undefined>(
  decoder: Decoder<T>,
  defaultValue?: U,
): Decoder<T | U> {
  return function optionalDecoder(value: unknown): T | U {
    if (value === undefined) {
      return defaultValue as T | U;
    }
    try {
      return decoder(value);
    } catch (error) {
      const newError = DecoderError.at(error);
      if (newError.path.length === 0) {
        newError.optional = true;
      }
      throw newError;
    }
  };
}

export function nullable<T>(decoder: Decoder<T>): Decoder<T | null>;

export function nullable<T, U>(
  decoder: Decoder<T>,
  defaultValue: U,
): Decoder<T | U>;

export function nullable<T, U = null>(
  decoder: Decoder<T>,
  ...rest: Array<unknown>
): Decoder<T | U> {
  const defaultValue = rest.length === 0 ? null : rest[0];
  return function nullableDecoder(value: unknown): T | U {
    if (value === null) {
      return defaultValue as T | U;
    }
    try {
      return decoder(value);
    } catch (error) {
      const newError = DecoderError.at(error);
      if (newError.path.length === 0) {
        newError.nullable = true;
      }
      throw newError;
    }
  };
}

export function chain<T, U>(
  decoder: Decoder<T>,
  next: Decoder<U, T>,
): Decoder<U> {
  return function chainDecoder(value: unknown): U {
    return next(decoder(value));
  };
}

export type DecoderErrorVariant =
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
  | { tag: "string"; got: unknown };

function formatDecoderErrorVariant(
  variant: DecoderErrorVariant,
  options?: ReprOptions,
): string {
  const formatGot = (value: unknown): string => {
    const formatted = repr(value, options);
    return options?.sensitive === true
      ? `${formatted}\n(Actual values are hidden in sensitive mode.)`
      : formatted;
  };

  const removeBrackets = (formatted: string): string =>
    formatted.replace(/^\[|\s*\]$/g, "");

  const stringList = (strings: Array<string>): string =>
    strings.length === 0
      ? " (none)"
      : removeBrackets(
          repr(strings, {
            maxLength: Infinity,
            maxArrayChildren: Infinity,
            indent: options?.indent,
          }),
        );

  const got = (message: string, value: unknown): string =>
    value === DecoderError.MISSING_VALUE
      ? message
      : `${message}\nGot: ${formatGot(value)}`;

  switch (variant.tag) {
    case "boolean":
    case "number":
    case "string":
      return got(`Expected a ${variant.tag}`, variant.got);

    case "array":
    case "object":
      return got(`Expected an ${variant.tag}`, variant.got);

    case "unknown multi type":
      return `Expected one of these types: ${
        variant.knownTypes.length === 0
          ? "never"
          : variant.knownTypes.join(", ")
      }\nGot: ${formatGot(variant.got)}`;

    case "unknown fieldsUnion tag":
      return `Expected one of these tags:${stringList(
        variant.knownTags,
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown stringUnion variant":
      return `Expected one of these variants:${stringList(
        variant.knownVariants,
      )}\nGot: ${formatGot(variant.got)}`;

    case "missing field":
      return `Expected an object with a field called: ${JSON.stringify(
        variant.field,
      )}\nGot: ${formatGot(variant.got)}`;

    case "wrong tag":
      return `Expected this string: ${JSON.stringify(
        variant.expected,
      )}\nGot: ${formatGot(variant.got)}`;

    case "exact fields":
      return `Expected only these fields:${stringList(
        variant.knownFields,
      )}\nFound extra fields:${removeBrackets(formatGot(variant.got))}`;

    case "tuple size":
      return `Expected ${variant.expected} items\nGot: ${variant.got}`;

    case "custom":
      return got(variant.message, variant.got);
  }
}

type Key = number | string;

export class DecoderError extends TypeError {
  path: Array<Key>;

  variant: DecoderErrorVariant;

  nullable: boolean;

  optional: boolean;

  constructor({
    key,
    ...params
  }:
    | { message: string; value: unknown; key?: Key | undefined }
    | (DecoderErrorVariant & { key?: Key | undefined })) {
    const variant: DecoderErrorVariant =
      "tag" in params
        ? params
        : { tag: "custom", message: params.message, got: params.value };
    super(
      `${formatDecoderErrorVariant(
        variant,
        // Default to sensitive so accidental uncaught errors don’t leak
        // anything. Explicit `.format()` defaults to non-sensitive.
        { sensitive: true },
      )}\n\nFor better error messages, see https://github.com/lydell/tiny-decoders#error-messages`,
    );
    this.path = key === undefined ? [] : [key];
    this.variant = variant;
    this.nullable = false;
    this.optional = false;
  }

  static MISSING_VALUE = Symbol("DecoderError.MISSING_VALUE");

  static at(error: unknown, key?: Key): DecoderError {
    if (error instanceof DecoderError) {
      if (key !== undefined) {
        error.path.unshift(key);
      }
      return error;
    }
    return new DecoderError({
      tag: "custom",
      message: error instanceof Error ? error.message : String(error),
      got: DecoderError.MISSING_VALUE,
      key,
    });
  }

  format(options?: ReprOptions): string {
    const path = this.path.map((part) => `[${JSON.stringify(part)}]`).join("");
    const nullableString = this.nullable ? " (nullable)" : "";
    const optionalString = this.optional ? " (optional)" : "";
    const variant = formatDecoderErrorVariant(this.variant, options);
    return `At root${path}${nullableString}${optionalString}:\n${variant}`;
  }
}

export type ReprOptions = {
  depth?: number | undefined;
  indent?: string | undefined;
  maxArrayChildren?: number | undefined;
  maxObjectChildren?: number | undefined;
  maxLength?: number | undefined;
  sensitive?: boolean | undefined;
};

export function repr(
  value: unknown,
  {
    depth = 0,
    indent = "  ",
    maxArrayChildren = 5,
    maxObjectChildren = 5,
    maxLength = 100,
    sensitive = false,
  }: ReprOptions = {},
): string {
  return reprHelper(
    value,
    {
      depth,
      maxArrayChildren,
      maxObjectChildren,
      maxLength,
      indent,
      sensitive,
    },
    0,
    [],
  );
}

type NonNullableObject<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

function reprHelper(
  value: unknown,
  options: NonNullableObject<ReprOptions>,
  level: number,
  seen: Array<unknown>,
): string {
  const { indent, maxLength, sensitive } = options;
  const type = typeof value;
  const toStringType = Object.prototype.toString
    .call(value)
    .replace(/^\[object\s+(.+)\]$/, "$1");

  try {
    if (
      value == null ||
      type === "number" ||
      type === "boolean" ||
      type === "symbol" ||
      toStringType === "RegExp"
    ) {
      return sensitive
        ? toStringType.toLowerCase()
        : truncate(String(value), maxLength);
    }

    if (type === "string") {
      return sensitive ? type : truncate(JSON.stringify(value), maxLength);
    }

    if (typeof value === "function") {
      return `function ${truncate(JSON.stringify(value.name), maxLength)}`;
    }

    if (Array.isArray(value)) {
      const arr: Array<unknown> = value;
      if (arr.length === 0) {
        return "[]";
      }

      if (seen.includes(arr)) {
        return `circular ${toStringType}(${arr.length})`;
      }

      if (options.depth < level) {
        return `${toStringType}(${arr.length})`;
      }

      const lastIndex = arr.length - 1;
      const items = [];

      const end = Math.min(options.maxArrayChildren - 1, lastIndex);

      for (let index = 0; index <= end; index++) {
        const item =
          index in arr
            ? reprHelper(arr[index], options, level + 1, [...seen, arr])
            : "<empty>";
        items.push(item);
      }

      if (end < lastIndex) {
        items.push(`(${lastIndex - end} more)`);
      }

      return `[\n${indent.repeat(level + 1)}${items.join(
        `,\n${indent.repeat(level + 1)}`,
      )}\n${indent.repeat(level)}]`;
    }

    if (toStringType === "Object") {
      const object = value as Record<string, unknown>;
      const keys = Object.keys(object);

      // `class Foo {}` has `toStringType === "Object"` and `name === "Foo"`.
      const { name } = object.constructor;
      const prefix = name === "Object" ? "" : `${name} `;

      if (keys.length === 0) {
        return `${prefix}{}`;
      }

      if (seen.includes(object)) {
        return `circular ${name}(${keys.length})`;
      }

      if (options.depth < level) {
        return `${name}(${keys.length})`;
      }

      const numHidden = Math.max(0, keys.length - options.maxObjectChildren);

      const items = keys
        .slice(0, options.maxObjectChildren)
        .map((key2) => {
          const truncatedKey = truncate(JSON.stringify(key2), maxLength);
          const valueRepr = reprHelper(object[key2], options, level + 1, [
            ...seen,
            object,
          ]);
          const separator =
            valueRepr.includes("\n") ||
            truncatedKey.length + valueRepr.length + 2 <= maxLength // `2` accounts for the colon and space.
              ? " "
              : `\n${indent.repeat(level + 2)}`;
          return `${truncatedKey}:${separator}${valueRepr}`;
        })
        .concat(numHidden > 0 ? `(${numHidden} more)` : []);

      return `${prefix}{\n${indent.repeat(level + 1)}${items.join(
        `,\n${indent.repeat(level + 1)}`,
      )}\n${indent.repeat(level)}}`;
    }

    return toStringType;
  } catch (_error) {
    return toStringType;
  }
}

function truncate(str: string, maxLength: number): string {
  const half = Math.floor(maxLength / 2);
  return str.length <= maxLength
    ? str
    : `${str.slice(0, half)}…${str.slice(-half)}`;
}
