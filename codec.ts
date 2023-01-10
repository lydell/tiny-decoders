// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: Better type variable names.
export type Codec<T, U> = {
  decoder: (value: unknown) => T;
  encoder: (value: T) => U;
};

export type Infer<T extends Codec<any, any>> = T extends Codec<infer U, any>
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

export const boolean: Codec<boolean, boolean> = {
  decoder: function booleanDecoder(value) {
    if (typeof value !== "boolean") {
      throw new DecoderError({ tag: "boolean", got: value });
    }
    return value;
  },
  encoder: identity,
};

export const number: Codec<number, number> = {
  decoder: function numberDecoder(value) {
    if (typeof value !== "number") {
      throw new DecoderError({ tag: "number", got: value });
    }
    return value;
  },
  encoder: identity,
};

export const string: Codec<string, string> = {
  decoder: function stringDecoder(value) {
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
): Codec<T[number], T[number]> {
  return {
    decoder: function stringUnionDecoder(value) {
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

export function array<T, U>(codec: Codec<T, U>): Codec<Array<T>, Array<U>> {
  return {
    decoder: function arrayDecoder(value) {
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
    encoder: function arrayEncoder(arr) {
      const result = [];
      for (const item of arr) {
        result.push(codec.encoder(item));
      }
      return result;
    },
  };
}

export function record<T, U>(
  codec: Codec<T, U>
): Codec<Record<string, T>, Record<string, U>> {
  return {
    decoder: function recordDecoder(value) {
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
    encoder: function recordEncoder(object) {
      const result: Record<string, U> = {};
      for (const [key, value] of Object.entries(object)) {
        result[key] = codec.encoder(value);
      }
      return result;
    },
  };
}

export function fields<T extends Record<string, unknown>, U>(
  mapping: {
    [P in keyof T]: P extends "__proto__"
      ? never
      : Codec<T[P], U> & { field?: string };
  },
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
): Codec<T, Record<string, U>> {
  return {
    decoder: function fieldsAutoDecoder(value) {
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
    encoder: function fieldsAutoEncoder(object) {
      const result: Record<string, U> = {};
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
  ? { [P in keyof T]: T[P] extends Codec<infer U, any> ? U : never }
  : never;

const tagSymbol: unique symbol = Symbol("fieldsUnion tag");

type TagCodec<Name extends string> = Codec<Name, string> & {
  field: string;
  _private: TagData;
};

type TagData = {
  tag: typeof tagSymbol;
  encodedName: string;
  originalName: string;
};

export function fieldsUnion<
  T extends ReadonlyArray<Record<string, Codec<any, any>>>,
  U
>(
  commonField: string,
  callback: T[number] extends never
    ? "fieldsUnion must have at least one variant"
    : (
        tag: <Name extends string>(
          name: Name,
          originalName?: string
        ) => Codec<Name, string>
      ) => [...T],
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
): Codec<Extract<T[number]>, Record<string, U>> {
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

  type VariantCodec = Codec<any, Record<string, U>>;
  const decoderMap = new Map<string, VariantCodec["decoder"]>();
  const encoderMap = new Map<string, VariantCodec["encoder"]>();

  let encodedCommonField: string | undefined = undefined;

  for (const variant of variants) {
    let seenTag = false;
    for (const [key, codec] of Object.entries(variant)) {
      if ("_private" in codec) {
        const data = codec._private as TagData;
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
          const fullCodec: Codec<
            Record<string, unknown>,
            Record<string, U>
          > = fields(variant, { exact });
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
    decoder: function fieldsUnionDecoder(value) {
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

export function tuple<T extends ReadonlyArray<unknown>, U>(
  mapping: readonly [...{ [P in keyof T]: Codec<T[P], U> }]
): Codec<[...T], Array<unknown>> {
  return {
    decoder: function tupleDecoder(value) {
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
    encoder: function tupleEncoder(value) {
      const result = [];
      for (let index = 0; index < mapping.length; index++) {
        const { encoder } = mapping[index];
        result.push(encoder(value[index]));
      }
      return result;
    },
  };
}

type Multi<T> = T extends any
  ? T extends "undefined"
    ? { type: "undefined"; value: undefined }
    : T extends "null"
    ? { type: "null"; value: null }
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

export function multi<
  T extends ReadonlyArray<
    "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined"
  >
>(
  types: T[number] extends never ? "multi must have at least one type" : [...T]
): Codec<Multi<T[number]>, Multi<T[number]>["value"]> {
  return {
    decoder: function multiDecoder(value) {
      if (value === undefined) {
        if (types.includes("undefined")) {
          return { type: "undefined", value } as unknown as Multi<T[number]>;
        }
      } else if (value === null) {
        if (types.includes("null")) {
          return { type: "null", value } as unknown as Multi<T[number]>;
        }
      } else if (typeof value === "boolean") {
        if (types.includes("boolean")) {
          return { type: "boolean", value } as unknown as Multi<T[number]>;
        }
      } else if (typeof value === "number") {
        if (types.includes("number")) {
          return { type: "number", value } as unknown as Multi<T[number]>;
        }
      } else if (typeof value === "string") {
        if (types.includes("string")) {
          return { type: "string", value } as unknown as Multi<T[number]>;
        }
      } else if (Array.isArray(value)) {
        if (types.includes("array")) {
          return { type: "array", value } as unknown as Multi<T[number]>;
        }
      } else {
        if (types.includes("object")) {
          return { type: "object", value } as unknown as Multi<T[number]>;
        }
      }
      throw new DecoderError({
        tag: "unknown multi type",
        knownTypes: types as Array<"undefined">, // Type checking hack.
        got: value,
      });
    },
    encoder: function multiEncoder(value) {
      return value.value;
    },
  };
}

const bar = chain(
  multi(["number", "string"]),
  (value) => {
    switch (value.type) {
      case "number":
        return value.value.toString();
      case "string":
        return value.value;
    }
  },
  (value) => ({ type: "string" as const, value })
);
void bar;
type bar = Infer<typeof bar>;

type Result<Value, Err> =
  | {
      type: "error";
      error: Err;
    }
  | {
      type: "ok";
      value: Value;
    };

const resultCodec = function <Value, Err>(
  decodeValue: Codec<Value, unknown>,
  decodeError: Codec<Err, unknown>
): Codec<Result<Value, Err>, unknown> {
  return fieldsUnion("type", (tag) => [
    {
      type: tag("ok"),
      value: decodeValue,
    },
    {
      type: tag("error"),
      error: decodeError,
    },
  ]);
};

const foo = resultCodec(number, string);
void foo;
type foo = Infer<typeof foo>;

type Dict = { [key: string]: Dict | number };

const dictCodec: Codec<Dict, Record<string, unknown>> = record(
  chain(
    multi(["number", "object"]),
    (value) => {
      switch (value.type) {
        case "number":
          return value.value;
        case "object":
          return dictCodec.decoder(value.value);
      }
    },
    (value) => {
      if (typeof value === "number") {
        return { type: "number" as const, value };
      } else {
        return {
          type: "object" as const,
          value: dictCodec.encoder(value),
        };
      }
    }
  )
);

const dictFoo: Codec<Record<string, string>, Record<string, unknown>> = record(
  string
);
void dictFoo;

const fieldsFoo: Codec<
  { name: string; age: number },
  Record<string, number | string>
> = fields({
  name: string,
  age: number,
});
void fieldsFoo;

export function recursive<T, U>(callback: () => Codec<T, U>): Codec<T, U> {
  return {
    decoder: function lazyDecoder(value) {
      return callback().decoder(value);
    },
    encoder: function lazyEncoder(value) {
      return callback().encoder(value);
    },
  };
}

type Person = {
  name: string;
  friends: Array<Person>;
};

const personCodec: Codec<Person, Record<string, unknown>> = fields({
  name: string,
  friends: array(recursive(() => personCodec)),
});

export function optional<T, V>(
  decoder: Codec<T, V>
): Codec<T | undefined, V | undefined>;

export function optional<T, V, U>(
  codec: Codec<T, V>,
  defaultValue: U
): Codec<T | U, V | undefined>;

export function optional<T, V, U = undefined>(
  codec: Codec<T, V>,
  defaultValue?: U
): Codec<T | U, V | undefined> {
  return {
    decoder: function optionalDecoder(value) {
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
    encoder: function optionalEncoder(value) {
      return value === defaultValue ? undefined : codec.encoder(value as T);
    },
  };
}

export function nullable<T, V>(decoder: Codec<T, V>): Codec<T | null, V | null>;

export function nullable<T, V, U>(
  codec: Codec<T, V>,
  defaultValue: U
): Codec<T | U, V | null>;

export function nullable<T, V, U = null>(
  codec: Codec<T, V>,
  ...rest: Array<unknown>
): Codec<T | U, V | null> {
  const defaultValue = rest.length === 0 ? null : rest[0];
  return {
    decoder: function nullableDecoder(value) {
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
    encoder: function nullableEncoder(value) {
      return value === defaultValue ? null : codec.encoder(value as T);
    },
  };
}

export function chain<T, U, V>(
  codec: Codec<T, V>,
  decoder: (value: T) => U,
  encoder: (value: U) => T
): Codec<U, V> {
  return {
    decoder: function chainDecoder(value) {
      return decoder(codec.decoder(value));
    },
    encoder: function chainEncoder(value) {
      return codec.encoder(encoder(value));
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
