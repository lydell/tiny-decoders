// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Decoder<T, U = unknown> = (value: U) => DecoderResult<T>;

export type DecoderResult<T> =
  | {
      tag: "DecoderError";
      error: DecoderError;
    }
  | {
      tag: "Valid";
      value: T;
    };

export type Infer<T extends Decoder<any>> = Extract<
  ReturnType<T>,
  { tag: "Valid" }
>["value"];

// Make VSCode show `{ a: string; b?: number }` instead of `{ a: string } & { b?: number }`.
// https://stackoverflow.com/a/57683652/2010616
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export function boolean(value: unknown): DecoderResult<boolean> {
  return typeof value === "boolean"
    ? { tag: "Valid", value }
    : {
        tag: "DecoderError",
        error: { tag: "boolean", got: value, path: [] },
      };
}

export function number(value: unknown): DecoderResult<number> {
  return typeof value === "number"
    ? { tag: "Valid", value }
    : {
        tag: "DecoderError",
        error: { tag: "number", got: value, path: [] },
      };
}

export function string(value: unknown): DecoderResult<string> {
  return typeof value === "string"
    ? { tag: "Valid", value }
    : {
        tag: "DecoderError",
        error: { tag: "string", got: value, path: [] },
      };
}

export function stringUnion<
  const T extends readonly [string, ...Array<string>],
>(variants: T): Decoder<T[number]> {
  return (value) => {
    const stringResult = string(value);
    if (stringResult.tag === "DecoderError") {
      return stringResult;
    }
    const str = stringResult.value;
    return variants.includes(str)
      ? { tag: "Valid", value: str }
      : {
          tag: "DecoderError",
          error: {
            tag: "unknown stringUnion variant",
            knownVariants: variants as unknown as Array<string>,
            got: str,
            path: [],
          },
        };
  };
}

function unknownArray(value: unknown): DecoderResult<Array<unknown>> {
  return Array.isArray(value)
    ? { tag: "Valid", value }
    : {
        tag: "DecoderError",
        error: { tag: "array", got: value, path: [] },
      };
}

function unknownRecord(value: unknown): DecoderResult<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { tag: "Valid", value: value as Record<string, unknown> }
    : {
        tag: "DecoderError",
        error: { tag: "object", got: value, path: [] },
      };
}

export function array<T>(decoder: Decoder<T>): Decoder<Array<T>> {
  return (value) => {
    const arrResult = unknownArray(value);
    if (arrResult.tag === "DecoderError") {
      return arrResult;
    }
    const arr = arrResult.value;
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      const decoderResult = decoder(arr[index]);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              path: [index, ...decoderResult.error.path],
            },
          };
        case "Valid":
          result.push(decoderResult.value);
          break;
      }
    }
    return { tag: "Valid", value: result };
  };
}

export function record<T>(decoder: Decoder<T>): Decoder<Record<string, T>> {
  return (value) => {
    const objectResult = unknownRecord(value);
    if (objectResult.tag === "DecoderError") {
      return objectResult;
    }
    const object = objectResult.value;
    const keys = Object.keys(object);
    const result: Record<string, T> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      const decoderResult = decoder(object[key]);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              path: [key, ...decoderResult.error.path],
            },
          };
        case "Valid":
          result[key] = decoderResult.value;
          break;
      }
    }

    return { tag: "Valid", value: result };
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
  return (value) => {
    const objectResult = unknownRecord(value);
    if (objectResult.tag === "DecoderError") {
      return objectResult;
    }
    const object = objectResult.value;
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
          return {
            tag: "DecoderError",
            error: {
              tag: "missing field",
              field: encodedFieldName,
              got: object,
              path: [],
            },
          };
        }
        continue;
      }
      const decoderResult = decoder(object[encodedFieldName]);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              path: [encodedFieldName, ...decoderResult.error.path],
            },
          };
        case "Valid":
          result[key] = decoderResult.value;
          break;
      }
    }

    if (!allowExtraFields) {
      const unknownFields = Object.keys(object).filter(
        (key) => !knownFields.has(key),
      );
      if (unknownFields.length > 0) {
        return {
          tag: "DecoderError",
          error: {
            tag: "exact fields",
            knownFields: Array.from(knownFields),
            got: unknownFields,
            path: [],
          },
        };
      }
    }

    return { tag: "Valid", value: result as InferFields<Mapping> };
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

  return (value) => {
    const encodedNameResult = fieldsAuto({ [encodedCommonField]: string })(
      value,
    );
    if (encodedNameResult.tag === "DecoderError") {
      return encodedNameResult;
    }
    const encodedName = encodedNameResult.value[encodedCommonField];
    const decoder = decoderMap.get(encodedName);
    if (decoder === undefined) {
      return {
        tag: "DecoderError",
        error: {
          tag: "unknown fieldsUnion tag",
          knownTags: Array.from(decoderMap.keys()),
          got: encodedName,
          path: [encodedCommonField],
        },
      };
    }
    return decoder(value);
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
    decoder: (value) => {
      const strResult = string(value);
      if (strResult.tag === "DecoderError") {
        return strResult;
      }
      const str = strResult.value;
      return str === encoded
        ? { tag: "Valid", value: decoded }
        : {
            tag: "DecoderError",
            error: {
              tag: "wrong tag",
              expected: encoded,
              got: str,
              path: [],
            },
          };
    },
    renameFrom: encodedFieldName,
    tag: { decoded, encoded },
  };
}

export function tuple<T extends Array<unknown>>(
  mapping: [...{ [P in keyof T]: Decoder<T[P]> }],
): Decoder<T> {
  return (value) => {
    const arrResult = unknownArray(value);
    if (arrResult.tag === "DecoderError") {
      return arrResult;
    }
    const arr = arrResult.value;
    if (arr.length !== mapping.length) {
      return {
        tag: "DecoderError",
        error: {
          tag: "tuple size",
          expected: mapping.length,
          got: arr.length,
          path: [],
        },
      };
    }
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      const decoder = mapping[index];
      const decoderResult = decoder(arr[index]);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              path: [index, ...decoderResult.error.path],
            },
          };
        case "Valid":
          result.push(decoderResult.value);
          break;
      }
    }
    return { tag: "Valid", value: result as T };
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
  return (value) => {
    if (value === undefined) {
      if (types.includes("undefined")) {
        return {
          tag: "Valid",
          value: { type: "undefined", value } as unknown as Multi<
            Types[number]
          >,
        };
      }
    } else if (value === null) {
      if (types.includes("null")) {
        return {
          tag: "Valid",
          value: { type: "null", value } as unknown as Multi<Types[number]>,
        };
      }
    } else if (typeof value === "boolean") {
      if (types.includes("boolean")) {
        return {
          tag: "Valid",
          value: { type: "boolean", value } as unknown as Multi<Types[number]>,
        };
      }
    } else if (typeof value === "number") {
      if (types.includes("number")) {
        return {
          tag: "Valid",
          value: { type: "number", value } as unknown as Multi<Types[number]>,
        };
      }
    } else if (typeof value === "string") {
      if (types.includes("string")) {
        return {
          tag: "Valid",
          value: { type: "string", value } as unknown as Multi<Types[number]>,
        };
      }
    } else if (Array.isArray(value)) {
      if (types.includes("array")) {
        return {
          tag: "Valid",
          value: { type: "array", value } as unknown as Multi<Types[number]>,
        };
      }
    } else {
      if (types.includes("object")) {
        return {
          tag: "Valid",
          value: { type: "object", value } as unknown as Multi<Types[number]>,
        };
      }
    }
    return {
      tag: "DecoderError",
      error: {
        tag: "unknown multi type",
        knownTypes: types as unknown as Array<"undefined">, // Type checking hack.
        got: value,
        path: [],
      },
    };
  };
}

export function recursive<T>(callback: () => Decoder<T>): Decoder<T> {
  return (value) => callback()(value);
}

export function undefinedOr<T>(decoder: Decoder<T>): Decoder<T | undefined> {
  return (value) => {
    if (value === undefined) {
      return { tag: "Valid", value: undefined };
    }
    const decoderResult = decoder(value);
    switch (decoderResult.tag) {
      case "DecoderError":
        return decoderResult.error.path.length === 0
          ? {
              tag: "DecoderError",
              error: {
                ...decoderResult.error,
                orExpected:
                  decoderResult.error.orExpected === "null"
                    ? "null or undefined"
                    : "undefined",
              },
            }
          : decoderResult;
      case "Valid":
        return decoderResult;
    }
  };
}

export function nullable<T>(decoder: Decoder<T>): Decoder<T | null> {
  return (value) => {
    if (value === null) {
      return { tag: "Valid", value: null };
    }
    const decoderResult = decoder(value);
    switch (decoderResult.tag) {
      case "DecoderError":
        return decoderResult.error.path.length === 0
          ? {
              tag: "DecoderError",
              error: {
                ...decoderResult.error,
                orExpected:
                  decoderResult.error.orExpected === "undefined"
                    ? "null or undefined"
                    : "null",
              },
            }
          : decoderResult;
      case "Valid":
        return decoderResult;
    }
  };
}

export function map<T, U>(
  decoder: Decoder<T>,
  transform: (value: T) => U,
): Decoder<U> {
  return (value) => {
    const decoderResult = decoder(value);
    switch (decoderResult.tag) {
      case "DecoderError":
        return decoderResult;
      case "Valid":
        return { tag: "Valid", value: transform(decoderResult.value) };
    }
  };
}

export function flatMap<T, U>(
  decoder: Decoder<T>,
  transform: (value: T) => DecoderResult<U>,
): Decoder<U> {
  return (value) => {
    const decoderResult = decoder(value);
    switch (decoderResult.tag) {
      case "DecoderError":
        return decoderResult;
      case "Valid":
        return transform(decoderResult.value);
    }
  };
}

export type DecoderError = {
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

export function format(error: DecoderError, options?: ReprOptions): string {
  const path = error.path.map((part) => `[${JSON.stringify(part)}]`).join("");
  const variant = formatDecoderErrorVariant(error, options);
  const orExpected =
    error.orExpected === undefined ? "" : `\nOr expected: ${error.orExpected}`;
  return `At root${path}:\n${variant}${orExpected}`;
}

function formatDecoderErrorVariant(
  variant: DecoderError,
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

  switch (variant.tag) {
    case "boolean":
    case "number":
    case "string":
      return `Expected a ${variant.tag}\nGot: ${formatGot(variant.got)}`;

    case "array":
    case "object":
      return `Expected an ${variant.tag}\nGot: ${formatGot(variant.got)}`;

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
      return `${variant.message}\nGot: ${formatGot(variant.got)}`;
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
