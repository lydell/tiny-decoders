/* eslint-disable prefer-arrow-callback */
/* eslint eqeqeq: ["error", "always", {null: "ignore"}] */

export type Decoder<T, U = unknown> = (
  value: U,
  errors?: Array<DecoderError>
) => T;

export type WithUndefinedAsOptional<T> = Expand<
  { [P in OptionalKeys<T>]?: T[P] } & { [P in RequiredKeys<T>]: T[P] }
>;

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

export function constant<
  T extends boolean | number | string | null | undefined
>(constantValue: T): Decoder<T> {
  return function constantDecoder(value: unknown): T {
    if (value !== constantValue) {
      throw new DecoderError({
        tag: "constant",
        expected: constantValue,
        got: value,
      });
    }
    return constantValue;
  };
}

export function stringUnion<T extends Record<string, null>>(
  mapping: keyof T extends string
    ? keyof T extends never
      ? "stringUnion must have at least one key"
      : T
    : {
        [P in keyof T]: P extends number
          ? "stringUnion keys must be strings, not numbers"
          : T[P];
      }
): Decoder<keyof T> {
  return function stringUnionDecoder(value: unknown): keyof T {
    const str = string(value);
    if (!Object.prototype.hasOwnProperty.call(mapping, str)) {
      throw new DecoderError({
        tag: "unknown stringUnion variant",
        knownVariants: Object.keys(mapping),
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

export function array<T, U = never>(
  decoder: Decoder<T>,
  { mode = "throw" }: { mode?: "skip" | "throw" | { default: U } } = {}
): Decoder<Array<T | U>> {
  return function arrayDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): Array<T | U> {
    const arr = unknownArray(value);
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      try {
        const localErrors: Array<DecoderError> = [];
        result.push(decoder(arr[index], localErrors));
        if (errors != null) {
          errors.push(
            ...localErrors.map((error) => DecoderError.at(error, index))
          );
        }
      } catch (error) {
        if (mode === "throw") {
          throw DecoderError.at(error, index);
        }
        if (errors != null) {
          errors.push(DecoderError.at(error, index));
        }
        if (typeof mode !== "string") {
          result.push(mode.default);
        }
      }
    }
    return result;
  };
}

export function record<T, U = never>(
  decoder: Decoder<T>,
  { mode = "throw" }: { mode?: "skip" | "throw" | { default: U } } = {}
): Decoder<Record<string, T | U>> {
  return function recordDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): Record<string, T | U> {
    const object = unknownRecord(value);
    const keys = Object.keys(object);
    const result: Record<string, T | U> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      try {
        const localErrors: Array<DecoderError> = [];
        result[key] = decoder(object[key], localErrors);
        if (errors != null) {
          errors.push(
            ...localErrors.map((error) => DecoderError.at(error, key))
          );
        }
      } catch (error) {
        if (mode === "throw") {
          throw DecoderError.at(error, key);
        }
        if (errors != null) {
          errors.push(DecoderError.at(error, key));
        }
        if (typeof mode !== "string") {
          result[key] = mode.default;
        }
      }
    }

    return result;
  };
}

export function fields<T>(
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
): Decoder<T> {
  return function fieldsDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): T {
    const object: Record<string, unknown> =
      allow === "array"
        ? ((unknownArray(value) as unknown) as Record<string, unknown>)
        : unknownRecord(value);
    const knownFields = Object.create(null) as Record<string, null>;

    function field<U, V = never>(
      key: string,
      decoder: Decoder<U>,
      { mode = "throw" }: { mode?: "throw" | { default: V } } = {}
    ): U | V {
      try {
        const localErrors: Array<DecoderError> = [];
        const result = decoder(object[key], localErrors);
        if (errors != null) {
          errors.push(
            ...localErrors.map((error) => DecoderError.at(error, key))
          );
        }
        knownFields[key] = null;
        return result;
      } catch (error) {
        if (mode === "throw") {
          throw DecoderError.at(error, key);
        }
        if (errors != null) {
          errors.push(DecoderError.at(error, key));
        }
        return mode.default;
      }
    }

    const result = callback(field, object, errors);

    if (exact !== "allow extra") {
      const unknownFields = Object.keys(object).filter(
        (key) => !Object.prototype.hasOwnProperty.call(knownFields, key)
      );
      if (unknownFields.length > 0) {
        const error = new DecoderError({
          tag: "exact fields",
          knownFields: Object.keys(knownFields),
          got: unknownFields,
        });
        if (exact === "throw") {
          throw error;
        } else if (errors != null) {
          errors.push(error);
        }
      }
    }

    return result;
  };
}

export function autoFields<T extends Record<string, unknown>>(
  mapping: { [P in keyof T]: P extends "__proto__" ? never : Decoder<T[P]> },
  { exact = "allow extra" }: { exact?: "allow extra" | "push" | "throw" } = {}
): Decoder<T> {
  return function autoFieldsDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): T {
    const object = unknownRecord(value);
    const keys = Object.keys(mapping);
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      if (key === "__proto__") {
        continue;
      }
      const decoder = mapping[key];
      try {
        const localErrors: Array<DecoderError> = [];
        result[key] = decoder(object[key], localErrors);
        if (errors != null) {
          errors.push(
            ...localErrors.map((error) => DecoderError.at(error, key))
          );
        }
      } catch (error) {
        throw DecoderError.at(error, key);
      }
    }

    if (exact !== "allow extra") {
      const unknownFields = Object.keys(object).filter(
        (key) => !Object.prototype.hasOwnProperty.call(mapping, key)
      );
      if (unknownFields.length > 0) {
        const error = new DecoderError({
          tag: "exact fields",
          knownFields: keys,
          got: unknownFields,
        });
        if (exact === "throw") {
          throw error;
        } else if (errors != null) {
          errors.push(error);
        }
      }
    }

    return result as T;
  };
}

export function tuple<T extends ReadonlyArray<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Decoder<T[P]> }]
): Decoder<[...T]> {
  return function tupleDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): [...T] {
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
        const localErrors: Array<DecoderError> = [];
        result.push(decoder(arr[index], localErrors));
        if (errors != null) {
          errors.push(
            ...localErrors.map((error) => DecoderError.at(error, index))
          );
        }
      } catch (error) {
        throw DecoderError.at(error, index);
      }
    }
    return result as [...T];
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
      }
): Decoder<
  Expand<
    Values<
      { [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never }
    >
  >
> {
  return fields(function fieldsUnionFields(field, object, errors) {
    const tag = field(key, string);
    if (Object.prototype.hasOwnProperty.call(mapping, tag)) {
      const decoder = (mapping as T)[tag];
      return decoder(object, errors) as Expand<
        Values<
          { [P in keyof T]: T[P] extends Decoder<infer U, infer _> ? U : never }
        >
      >;
    }
    throw new DecoderError({
      tag: "unknown fieldsUnion tag",
      knownTags: Object.keys(mapping),
      got: tag,
      key,
    });
  });
}

export function multi<
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
}): Decoder<T1 | T2 | T3 | T4 | T5 | T6 | T7> {
  return function multiDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): T1 | T2 | T3 | T4 | T5 | T6 | T7 {
    if (value === undefined) {
      if (mapping.undefined !== undefined) {
        return mapping.undefined(value, errors);
      }
    } else if (value === null) {
      if (mapping.null !== undefined) {
        return mapping.null(value, errors);
      }
    } else if (typeof value === "boolean") {
      if (mapping.boolean !== undefined) {
        return mapping.boolean(value, errors);
      }
    } else if (typeof value === "number") {
      if (mapping.number !== undefined) {
        return mapping.number(value, errors);
      }
    } else if (typeof value === "string") {
      if (mapping.string !== undefined) {
        return mapping.string(value, errors);
      }
    } else if (Array.isArray(value)) {
      if (mapping.array !== undefined) {
        return mapping.array(value, errors);
      }
    } else {
      if (mapping.object !== undefined) {
        return mapping.object(value as Record<string, unknown>, errors);
      }
    }
    throw new DecoderError({
      tag: "unknown multi type",
      knownTypes: Object.keys(mapping),
      got: value,
    });
  };
}

export function optional<T, U = undefined>(
  decoder: Decoder<T>,
  defaultValue?: U
): Decoder<T | U> {
  return function optionalDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): T | U {
    if (value === undefined) {
      return defaultValue as T | U;
    }
    try {
      return decoder(value, errors);
    } catch (error) {
      throw DecoderError.at(error, undefined);
    }
  };
}

export function nullable<T, U = undefined>(
  decoder: Decoder<T>,
  defaultValue?: U
): Decoder<T | U> {
  return function optionalDecoder(
    value: unknown,
    errors?: Array<DecoderError>
  ): T | U {
    if (value === null) {
      return defaultValue as T | U;
    }
    try {
      return decoder(value, errors);
    } catch (error) {
      throw DecoderError.at(error, undefined);
    }
  };
}

export function map<T, U>(decoder: Decoder<T>, f: Decoder<U, T>): Decoder<U> {
  return function mapDecoder(value: unknown, errors?: Array<DecoderError>): U {
    return f(decoder(value, errors), errors);
  };
}

export function lazy<T>(callback: () => Decoder<T>): Decoder<T> {
  return function lazyDecoder(value: unknown, errors?: Array<DecoderError>): T {
    return callback()(value, errors);
  };
}

export type DecoderErrorVariant =
  | {
      tag: "constant";
      expected: boolean | number | string | null | undefined;
      got: unknown;
    }
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
      knownTypes: Array<string>;
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

export function formatDecoderErrorVariant(
  variant: DecoderErrorVariant,
  {
    formatExpected = (value) =>
      repr(value, {
        maxArrayChildren: 20,
        recurseMaxLength: 50,
        sensitive: false,
      }),
    formatGot = repr,
  }: {
    formatExpected?: (value: unknown) => string;
    formatGot?: (value: unknown) => string;
  } = {}
): string {
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

    case "constant":
      return got(
        `Expected the value ${formatExpected(variant.expected)}`,
        variant.got
      );

    case "unknown multi type":
      return `Expected one of these types: ${formatExpected(
        variant.knownTypes
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown fieldsUnion tag":
      return `Expected one of these tags: ${formatExpected(
        variant.knownTags
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown stringUnion variant":
      return `Expected one of these variants: ${formatExpected(
        variant.knownVariants
      )}\nGot: ${formatGot(variant.got)}`;

    case "exact fields":
      return `Expected only these fields: ${formatExpected(
        variant.knownFields
      )}\nFound extra fields: ${formatGot(variant.got)}`;

    case "tuple size":
      return `Expected ${variant.expected} items\nGot: ${variant.got}`;

    case "custom":
      return got(variant.message, variant.got);
  }
}

export class DecoderError extends TypeError {
  path: Array<number | string | null | undefined>;

  variant: DecoderErrorVariant;

  constructor(
    params:
      | { message: string; value: unknown; key?: number | string }
      | (DecoderErrorVariant & { key?: number | string })
  ) {
    const variant: DecoderErrorVariant =
      "tag" in params
        ? params
        : { tag: "custom", message: params.message, got: params.value };
    super(
      formatDecoderErrorVariant(variant, {
        // Default to sensitive so accidental uncaught errors don’t leak
        // anything. Explicit `.format()` defaults to non-sensitive.
        formatGot: (value) => repr(value, { sensitive: true }),
      })
    );
    this.path = params.key === undefined ? [] : [params.key];
    this.variant = variant;
  }

  static MISSING_VALUE = {};

  static at(
    error: unknown,
    key: number | string | null | undefined
  ): DecoderError {
    if (error instanceof DecoderError) {
      error.path.unshift(key);
      return error;
    }
    return new DecoderError({
      tag: "custom",
      message: error instanceof Error ? error.message : String(error),
      got: DecoderError.MISSING_VALUE,
      key: key === null ? undefined : key,
    });
  }

  format(
    formatVariant:
      | ReprOptions
      | ((variant: DecoderErrorVariant) => string) = formatDecoderErrorVariant
  ): string {
    const path = this.path
      .filter(
        (part, index) =>
          !(
            part == null &&
            index < this.path.length - 1 &&
            this.path[index + 1] == null
          )
      )
      .map((part) => (part == null ? "?" : `[${JSON.stringify(part)}]`))
      .join("");
    const variant =
      typeof formatVariant === "function"
        ? formatVariant(this.variant)
        : formatDecoderErrorVariant(this.variant, {
            formatGot: (value) => repr(value, formatVariant),
          });
    return `At root${path}:\n${variant}`;
  }
}

export type ReprOptions = {
  recurse?: boolean;
  maxArrayChildren?: number;
  maxObjectChildren?: number;
  maxLength?: number;
  recurseMaxLength?: number;
  sensitive?: boolean;
};

export function repr(
  value: unknown,
  {
    recurse = true,
    maxArrayChildren = 5,
    maxObjectChildren = 3,
    maxLength = 100,
    recurseMaxLength = 20,
    sensitive = false,
  }: ReprOptions = {}
): string {
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
      if (!recurse && arr.length > 0) {
        return `${toStringType}(${arr.length})`;
      }

      const lastIndex = arr.length - 1;
      const items = [];

      const end = Math.min(maxArrayChildren - 1, lastIndex);

      for (let index = 0; index <= end; index++) {
        const item =
          index in arr
            ? repr(arr[index], { recurse: false, maxLength: recurseMaxLength })
            : "<empty>";
        items.push(item);
      }

      if (end < lastIndex) {
        items.push(`(${lastIndex - end} more)`);
      }

      return `[${items.join(", ")}]`;
    }

    if (toStringType === "Object") {
      const object = value as Record<string, unknown>;
      const keys = Object.keys(object);

      // `class Foo {}` has `toStringType === "Object"` and `name === "Foo"`.
      const { name } = object.constructor;

      if (!recurse && keys.length > 0) {
        return `${name}(${keys.length})`;
      }

      const numHidden = Math.max(0, keys.length - maxObjectChildren);

      const items = keys
        .slice(0, maxObjectChildren)
        .map(
          (key2) =>
            `${truncate(JSON.stringify(key2), recurseMaxLength)}: ${repr(
              object[key2],
              {
                recurse: false,
                maxLength: recurseMaxLength,
              }
            )}`
        )
        .concat(numHidden > 0 ? `(${numHidden} more)` : []);

      const prefix = name === "Object" ? "" : `${name} `;
      return `${prefix}{${items.join(", ")}}`;
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
