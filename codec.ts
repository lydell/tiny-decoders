// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Codec<T, U = unknown> = {
  decoder: (value: U) => T;
  encoder: (value: T) => U;
};

export type Infer<T> = T extends Codec<infer U>
  ? WithUndefinedAsOptional<U>
  : never;

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

function identity<T>(value: T): T {
  return value;
}

// TODO: Check which type annotations are redundant. For example, decoder and encoder functions inside.
// TODO: Check if we can type the return value of .encoder better? Is it useful to know that you get a boolean, an Array<unknown> etc?
export const boolean: Codec<boolean> = {
  decoder: function booleanDecoder(value: unknown): boolean {
    if (typeof value !== "boolean") {
      throw new DecoderError({ tag: "boolean", got: value });
    }
    return value;
  },
  encoder: identity,
};

export const number: Codec<number> = {
  decoder: function numberDecoder(value: unknown): number {
    if (typeof value !== "number") {
      throw new DecoderError({ tag: "number", got: value });
    }
    return value;
  },
  encoder: identity,
};

export const string: Codec<string> = {
  decoder: function stringDecoder(value: unknown): string {
    if (typeof value !== "string") {
      throw new DecoderError({ tag: "string", got: value });
    }
    return value;
  },
  encoder: identity,
};

export function stringUnion<T extends ReadonlyArray<string>>(
  values: T[number] extends never
    ? "stringUnion must have at least one variant"
    : [...T]
): Codec<T[number]> {
  return {
    decoder: function stringUnionDecoder(value: unknown): T[number] {
      const str = string.decoder(value);
      if (!values.includes(str)) {
        throw new DecoderError({
          tag: "unknown stringUnion variant",
          knownVariants: values as Array<string>,
          got: str,
        });
      }
      return str;
    },
    encoder: identity,
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

export function array<T>(codec: Codec<T>): Codec<Array<T>> {
  return {
    decoder: function arrayDecoder(value: unknown): Array<T> {
      const arr = unknownArray(value);
      const result = [];
      for (let index = 0; index < arr.length; index++) {
        try {
          result.push(codec.decoder(arr[index]));
        } catch (error) {
          throw DecoderError.at(error, index);
        }
      }
      return result;
    },
    encoder: function arrayEncoder(arr: Array<T>): Array<unknown> {
      const result: Array<unknown> = [];
      for (const item of arr) {
        result.push(codec.encoder(item));
      }
      return result;
    },
  };
}

export function record<T>(codec: Codec<T>): Codec<Record<string, T>> {
  return {
    decoder: function recordDecoder(value: unknown): Record<string, T> {
      const object = unknownRecord(value);
      const keys = Object.keys(object);
      const result: Record<string, T> = {};

      for (const key of keys) {
        if (key === "__proto__") {
          continue;
        }
        try {
          result[key] = codec.decoder(object[key]);
        } catch (error) {
          throw DecoderError.at(error, key);
        }
      }

      return result;
    },
    encoder: function recordEncoder(
      object: Record<string, T>
    ): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(object)) {
        result[key] = codec.encoder(value);
      }
      return result;
    },
  };
}

export function fields<T extends Record<string, unknown>>(
  mapping: {
    [P in keyof T]: P extends "__proto__"
      ? never
      : Codec<T[P]> & { field?: string };
  },
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
): Codec<T> {
  return {
    decoder: function fieldsAutoDecoder(value: unknown): T {
      const object = unknownRecord(value);
      const keys = Object.keys(mapping);
      const result: Record<string, unknown> = {};

      for (const key of keys) {
        if (key === "__proto__") {
          continue;
        }
        const { decoder, field = key } = mapping[key];
        try {
          result[key] = decoder(object[field]);
        } catch (error) {
          throw DecoderError.at(error, key);
        }
      }

      if (exact === "throw") {
        const unknownFields = Object.keys(object).filter(
          (key) => !Object.prototype.hasOwnProperty.call(mapping, key)
        );
        if (unknownFields.length > 0) {
          throw new DecoderError({
            tag: "exact fields",
            knownFields: keys,
            got: unknownFields,
          });
        }
      }

      return result as T;
    },
    encoder: function fieldsAutoEncoder(object: T): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      const keys = Object.keys(mapping);
      for (const key of keys) {
        if (key === "__proto__") {
          continue;
        }
        const { encoder, field = key } = mapping[key];
        result[field] = encoder(object[key] as T[string]);
      }
      return result;
    },
  };
}

type Extract<T> = T extends any
  ? { [P in keyof T]: T[P] extends Codec<infer U> ? U : never }
  : never;

const tagSymbol: unique symbol = Symbol("fieldsUnion tag");

type TagCodec<Name extends string> = Codec<Name> & {
  field: string;
  _private: {
    tag: typeof tagSymbol;
    encodedName: Name;
    originalName: string;
  };
};

export function fieldsUnion<
  T extends ReadonlyArray<Record<string, Codec<any>>>
>(
  commonField: string,
  callback: T[number] extends never
    ? "fieldsUnion must have at least one variant"
    : (
        tag: <Name extends string>(
          name: Name,
          originalName?: string
        ) => Codec<Name>
      ) => [...T],
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
): Codec<Extract<T[number]>> {
  function tag<Name extends string>(
    name: Name,
    originalName: string = name
  ): TagCodec<Name> {
    return {
      decoder: () => name,
      encoder: () => originalName,
      field: commonField,
      _private: {
        tag: tagSymbol,
        encodedName: name,
        originalName,
      },
    };
  }

  const variants = (callback as (tag_: typeof tag) => [...T])(tag);

  const decoderMap = new Map<string, Codec<any>["decoder"]>();
  const encoderMap = new Map<string, Codec<any>["encoder"]>();

  let encodedCommonField: string | undefined = undefined;

  for (const variant of variants) {
    let seenTag = false;
    for (const [key, codec] of Object.entries(variant)) {
      if ("_private" in codec) {
        const data = codec._private as TagCodec<never>["_private"];
        if (data.tag === tagSymbol) {
          if (seenTag) {
            throw new Error("TODO already called tag()");
          }
          seenTag = true;
          if (encodedCommonField === undefined) {
            encodedCommonField = key;
          } else if (encodedCommonField !== key) {
            throw new Error("TODO used another key for a previous tag() call");
          }
          if (decoderMap.has(data.originalName)) {
            throw new Error("TODO duplicate originalName");
          }
          if (encoderMap.has(data.encodedName)) {
            throw new Error("TODO duplicate encodedName");
          }
          const fullCodec = fields(variant, { exact });
          decoderMap.set(data.originalName, fullCodec.decoder);
          encoderMap.set(data.encodedName, fullCodec.encoder);
        }
      }
    }
    if (!seenTag) {
      throw new Error("TODO didn't call tag()");
    }
  }

  return {
    decoder: function fieldsUnionDecoder(value: unknown) {
      const object = unknownRecord(value);
      let originalName;
      try {
        originalName = string.decoder(object[commonField]);
      } catch (error) {
        throw DecoderError.at(error, commonField);
      }
      const decoder = decoderMap.get(originalName);
      if (decoder === undefined) {
        throw new DecoderError({
          tag: "unknown fieldsUnion tag",
          knownTags: Array.from(decoderMap.keys()),
          got: originalName,
          key: commonField,
        });
      }
      return decoder(object) as Extract<T[number]>;
    },
    encoder: function fieldsUnionEncoder(value) {
      const encodedName = value[encodedCommonField as string] as string;
      const encoder = encoderMap.get(encodedName);
      if (encoder === undefined) {
        throw new Error("TODO encoder was unexpectedly undefined");
      }
      return encoder(value);
    },
  };
}

export function tuple<T extends ReadonlyArray<unknown>>(
  mapping: readonly [...{ [P in keyof T]: Codec<T[P]> }]
): Codec<[...T]> {
  return {
    decoder: function tupleDecoder(value: unknown): [...T] {
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
          const { decoder } = mapping[index];
          result.push(decoder(arr[index]));
        } catch (error) {
          throw DecoderError.at(error, index);
        }
      }
      return result as [...T];
    },
    encoder: function tupleEncoder(value: [...T]): Array<unknown> {
      const result = [];
      for (let index = 0; index < mapping.length; index++) {
        const { encoder } = mapping[index];
        result.push(encoder(value[index]));
      }
      return result;
    },
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
  Mapping extends {
    undefined?: Codec<T1, undefined>;
    null?: Codec<T2, null>;
    boolean?: Codec<T3, boolean>;
    number?: Codec<T4, number>;
    string?: Codec<T5, string>;
    array?: Codec<T6, Array<unknown>>;
    object?: Codec<T7, Record<string, unknown>>;
  } = never
>(
  mapping: Mapping,
  encoder: (
    encoders: {
      [P in keyof Mapping]: Mapping[P] extends Codec<infer U, infer V>
        ? Codec<U, V>["encoder"]
        : never;
    },
    value: T1 | T2 | T3 | T4 | T5 | T6 | T7
  ) => unknown
): Codec<T1 | T2 | T3 | T4 | T5 | T6 | T7> {
  return {
    decoder: function multiDecoder(
      value: unknown
    ): T1 | T2 | T3 | T4 | T5 | T6 | T7 {
      if (value === undefined) {
        if (mapping.undefined !== undefined) {
          return mapping.undefined.decoder(value);
        }
      } else if (value === null) {
        if (mapping.null !== undefined) {
          return mapping.null.decoder(value);
        }
      } else if (typeof value === "boolean") {
        if (mapping.boolean !== undefined) {
          return mapping.boolean.decoder(value);
        }
      } else if (typeof value === "number") {
        if (mapping.number !== undefined) {
          return mapping.number.decoder(value);
        }
      } else if (typeof value === "string") {
        if (mapping.string !== undefined) {
          return mapping.string.decoder(value);
        }
      } else if (Array.isArray(value)) {
        if (mapping.array !== undefined) {
          return mapping.array.decoder(value);
        }
      } else {
        if (mapping.object !== undefined) {
          return mapping.object.decoder(value as Record<string, unknown>);
        }
      }
      throw new DecoderError({
        tag: "unknown multi type",
        knownTypes: Object.keys(mapping) as Array<"undefined">, // Type checking hack.
        got: value,
      });
    },
    encoder: function multiEncoder(value) {
      const encoders: Record<string, unknown> = {};
      for (const [key, codec] of Object.entries(mapping)) {
        encoders[key] = codec.encoder;
      }
      return encoder(encoders as Parameters<typeof encoder>[0], value);
    },
  };
}

type Mash<T> = T extends any
  ? T extends "undefined"
    ? { type: "undefined" }
    : T extends "null"
    ? { type: "null" }
    : T extends "boolean"
    ? { type: "boolean"; value: boolean }
    : T extends "number"
    ? { type: "number"; value: number }
    : T extends "string"
    ? { type: "string"; value: string }
    : T extends "array"
    ? { type: "array"; value: Array<unknown> }
    : T extends "object"
    ? { type: "object"; value: Record<string, unknown> }
    : never
  : never;

export function multi2<
  T extends ReadonlyArray<
    "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined"
  >
>(
  types: T[number] extends never ? "multi must have at least one type" : [...T]
): Codec<Mash<T[number]>> {
  return {
    decoder: function multiDecoder(value: unknown): Mash<T[number]> {
      if (value === undefined) {
        if (types.includes("undefined")) {
          return { type: "undefined" } as unknown as Mash<T[number]>;
        }
      } else if (value === null) {
        if (types.includes("null")) {
          return { type: "null" } as unknown as Mash<T[number]>;
        }
      } else if (typeof value === "boolean") {
        if (types.includes("boolean")) {
          return { type: "boolean", value } as unknown as Mash<T[number]>;
        }
      } else if (typeof value === "number") {
        if (types.includes("number")) {
          return { type: "number", value } as unknown as Mash<T[number]>;
        }
      } else if (typeof value === "string") {
        if (types.includes("string")) {
          return { type: "string", value } as unknown as Mash<T[number]>;
        }
      } else if (Array.isArray(value)) {
        if (types.includes("array")) {
          return { type: "array", value } as unknown as Mash<T[number]>;
        }
      } else {
        if (types.includes("object")) {
          return { type: "object", value } as unknown as Mash<T[number]>;
        }
      }
      throw new DecoderError({
        tag: "unknown multi type",
        knownTypes: types as Array<"undefined">, // Type checking hack.
        got: value,
      });
    },
    encoder: function multiEncoder(value: Mash<T[number]>): unknown {
      switch (value.type) {
        case "undefined":
          return undefined;
        case "null":
          return null;
        case "boolean":
        case "number":
        case "string":
        case "array":
        case "object":
          return value.value;
      }
    },
  };
}

const bar = chain(multi2(["number", "string"]), {
  decoder: (value) => {
    switch (value.type) {
      case "number":
        return value.value.toString();
      case "string":
        return value.value;
    }
  },
  encoder: (value) => ({ type: "string" as const, value }),
});

export function optional<T>(decoder: Codec<T>): Codec<T | undefined>;

export function optional<T, U>(codec: Codec<T>, defaultValue: U): Codec<T | U>;

export function optional<T, U = undefined>(
  codec: Codec<T>,
  defaultValue?: U
): Codec<T | U> {
  return {
    decoder: function optionalDecoder(value: unknown): T | U {
      if (value === undefined) {
        return defaultValue as T | U;
      }
      try {
        return codec.decoder(value);
      } catch (error) {
        const newError = DecoderError.at(error);
        if (newError.path.length === 0) {
          newError.optional = true;
        }
        throw newError;
      }
    },
    encoder: function optionalEncoder(value: T | U): unknown {
      return value === defaultValue ? undefined : codec.encoder(value as T);
    },
  };
}

export function nullable<T>(decoder: Codec<T>): Codec<T | null>;

export function nullable<T, U>(codec: Codec<T>, defaultValue: U): Codec<T | U>;

export function nullable<T, U = null>(
  codec: Codec<T>,
  ...rest: Array<unknown>
): Codec<T | U> {
  const defaultValue = rest.length === 0 ? null : rest[0];
  return {
    decoder: function nullableDecoder(value: unknown): T | U {
      if (value === null) {
        return defaultValue as T | U;
      }
      try {
        return codec.decoder(value);
      } catch (error) {
        const newError = DecoderError.at(error);
        if (newError.path.length === 0) {
          newError.nullable = true;
        }
        throw newError;
      }
    },
    encoder: function nullableEncoder(value: T | U): unknown {
      return value === defaultValue ? null : codec.encoder(value as T);
    },
  };
}

export function chain<T, U>(codec: Codec<T>, next: Codec<U, T>): Codec<U> {
  return {
    decoder: function chainDecoder(value: unknown): U {
      return next.decoder(codec.decoder(value));
    },
    encoder: function chainEncoder(value: U): unknown {
      return codec.encoder(next.encoder(value));
    },
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
  options?: ReprOptions
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
        variant.knownTags
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown stringUnion variant":
      return `Expected one of these variants: ${stringList(
        variant.knownVariants
      )}\nGot: ${formatGot(variant.got)}`;

    case "exact fields":
      return `Expected only these fields: ${stringList(
        variant.knownFields
      )}\nFound extra fields: ${formatGot(variant.got).replace(
        /^\[|\]$/g,
        ""
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
        { sensitive: true }
      )}\n\nFor better error messages, see https://github.com/lydell/tiny-decoders#error-messages`
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
            ? repr(arr[index], {
                recurse: false,
                maxLength: recurseMaxLength,
                sensitive,
              })
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
                sensitive,
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
