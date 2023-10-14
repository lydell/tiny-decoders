export type Decoder<T, U = unknown> = (value: U) => T;

type WithUndefinedAsOptional<T> = T extends Record<string, unknown>
  ? Expand<{ [P in OptionalKeys<T>]?: T[P] } & { [P in RequiredKeys<T>]: T[P] }>
  : T;

type RequiredKeys<T> = {
  [P in keyof T]: undefined extends T[P] ? never : P;
}[keyof T];

type OptionalKeys<T> = {
  [P in keyof T]: undefined extends T[P] ? P : never;
}[keyof T];

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

export function stringUnion<T extends [string, ...Array<string>]>(
  variants: readonly [...T],
): Decoder<T[number]> {
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

export function fields<T>(
  callback: (
    field: <U>(key: string, decoder: Decoder<U>) => U,
    object: Record<string, unknown>,
  ) => T,
  {
    exact = "allow extra",
    allow = "object",
  }: {
    exact?: "allow extra" | "throw";
    allow?: "array" | "object";
  } = {},
): Decoder<WithUndefinedAsOptional<T>> {
  return function fieldsDecoder(value: unknown): WithUndefinedAsOptional<T> {
    const object: Record<string, unknown> =
      allow === "array"
        ? (unknownArray(value) as unknown as Record<string, unknown>)
        : unknownRecord(value);
    const knownFields = Object.create(null) as Record<string, null>;

    function field<U>(key: string, decoder: Decoder<U>): U {
      try {
        const result = decoder(object[key]);
        knownFields[key] = null;
        return result;
      } catch (error) {
        throw DecoderError.at(error, key);
      }
    }

    const result = callback(field, object);

    if (exact !== "allow extra") {
      const unknownFields = Object.keys(object).filter(
        (key) => !Object.prototype.hasOwnProperty.call(knownFields, key),
      );
      if (unknownFields.length > 0) {
        throw new DecoderError({
          tag: "exact fields",
          knownFields: Object.keys(knownFields),
          got: unknownFields,
        });
      }
    }

    return result as WithUndefinedAsOptional<T>;
  };
}

export function fieldsAuto<T extends Record<string, unknown>>(
  mapping: { [P in keyof T]: P extends "__proto__" ? never : Decoder<T[P]> },
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {},
): Decoder<WithUndefinedAsOptional<T>> {
  return function fieldsAutoDecoder(
    value: unknown,
  ): WithUndefinedAsOptional<T> {
    const object = unknownRecord(value);
    const keys = Object.keys(mapping);
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      const decoder = mapping[key];
      try {
        result[key] = decoder(object[key]);
      } catch (error) {
        throw DecoderError.at(error, key);
      }
    }

    if (exact !== "allow extra") {
      const unknownFields = Object.keys(object).filter(
        (key) => !Object.prototype.hasOwnProperty.call(mapping, key),
      );
      if (unknownFields.length > 0) {
        throw new DecoderError({
          tag: "exact fields",
          knownFields: keys,
          got: unknownFields,
        });
      }
    }

    return result as WithUndefinedAsOptional<T>;
  };
}

type Values<T> = T[keyof T];

export function fieldsUnion<T extends Record<string, Decoder<unknown>>>(
  key: string,
  mapping: keyof T extends string
    ? keyof T extends never
      ? "fieldsUnion must have at least one member"
      : T
    : {
        [P in keyof T]: P extends number
          ? "fieldsUnion keys must be strings, not numbers"
          : T[P];
      },
): Decoder<
  Expand<
    Values<{
      [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never;
    }>
  >
> {
  // eslint-disable-next-line prefer-arrow-callback
  return fields(function fieldsUnionFields(field, object) {
    const tag = field(key, string);
    if (Object.prototype.hasOwnProperty.call(mapping, tag)) {
      const decoder = (mapping as T)[tag];
      return decoder(object);
    }
    throw new DecoderError({
      tag: "unknown fieldsUnion tag",
      knownTags: Object.keys(mapping),
      got: tag,
      key,
    });
  }) as Decoder<
    Expand<
      Values<{
        [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never;
      }>
    >
  >;
}

export function tuple<T extends Array<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Decoder<T[P]> }],
): Decoder<[...T]> {
  return function tupleDecoder(value: unknown): [...T] {
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
    return result as [...T];
  };
}

export function multi<
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
}): Decoder<T1 | T2 | T3 | T4 | T5 | T6 | T7> {
  return function multiDecoder(
    value: unknown,
  ): T1 | T2 | T3 | T4 | T5 | T6 | T7 {
    if (value === undefined) {
      if (mapping.undefined !== undefined) {
        return mapping.undefined(value);
      }
    } else if (value === null) {
      if (mapping.null !== undefined) {
        return mapping.null(value);
      }
    } else if (typeof value === "boolean") {
      if (mapping.boolean !== undefined) {
        return mapping.boolean(value);
      }
    } else if (typeof value === "number") {
      if (mapping.number !== undefined) {
        return mapping.number(value);
      }
    } else if (typeof value === "string") {
      if (mapping.string !== undefined) {
        return mapping.string(value);
      }
    } else if (Array.isArray(value)) {
      if (mapping.array !== undefined) {
        return mapping.array(value);
      }
    } else {
      if (mapping.object !== undefined) {
        return mapping.object(value as Record<string, unknown>);
      }
    }
    throw new DecoderError({
      tag: "unknown multi type",
      knownTypes: Object.keys(mapping) as Array<"undefined">, // Type checking hack.
      got: value,
    });
  };
}

export function optional<T>(decoder: Decoder<T>): Decoder<T | undefined>;

export function optional<T, U>(
  decoder: Decoder<T>,
  defaultValue: U,
): Decoder<T | U>;

export function optional<T, U = undefined>(
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

  const stringList = (strings: Array<string>): string =>
    strings.length === 0
      ? "(none)"
      : strings.map((s) => JSON.stringify(s)).join(", ");

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
      return `Expected one of these tags: ${stringList(
        variant.knownTags,
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown stringUnion variant":
      return `Expected one of these variants: ${stringList(
        variant.knownVariants,
      )}\nGot: ${formatGot(variant.got)}`;

    case "exact fields":
      return `Expected only these fields: ${stringList(
        variant.knownFields,
      )}\nFound extra fields: ${formatGot(variant.got).replace(
        /^\[|\]$/g,
        "",
      )}`;

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
    | { message: string; value: unknown; key?: Key }
    | (DecoderErrorVariant & { key?: Key })) {
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

const MAX_OBJECT_CHILDREN_DEFAULT = 5;

export type ReprOptions = {
  depth?: number;
  indent?: string;
  maxArrayChildren?: number;
  maxObjectChildren?: number;
  maxLength?: number;
  sensitive?: boolean;
};

export function repr(
  value: unknown,
  {
    depth = 0,
    indent = "  ",
    maxArrayChildren = 5,
    maxObjectChildren = MAX_OBJECT_CHILDREN_DEFAULT,
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

function reprHelper(
  value: unknown,
  options: Required<ReprOptions>,
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
