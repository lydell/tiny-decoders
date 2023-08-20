// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Codec<
  Decoded,
  Encoded = unknown,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Options extends CodecOptions = {},
> = Options & {
  decoder: (value: unknown) => Decoded;
  encoder: (value: Decoded) => Encoded;
};

export type CodecOptions = {
  encodedFieldName?: string;
  optional?: boolean;
  tag?: { decoded: string; encoded: string } | undefined;
};

type MergeOptions<A extends CodecOptions, B extends CodecOptions> = Expand<
  A & B
>;

// Make VSCode show `{ a: string; b?: number }` instead of `{ a: string } & { b?: number }`.
// https://stackoverflow.com/a/57683652/2010616
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type Infer<T extends Codec<any>> = ReturnType<T["decoder"]>;

export type InferEncoded<T extends Codec<any>> = ReturnType<T["encoder"]>;

export function parse<Decoded>(
  codec: Codec<Decoded>,
  jsonString: string,
): Decoded | DecoderError {
  let json: unknown;
  try {
    json = JSON.parse(jsonString);
  } catch (error) {
    return new DecoderError({
      tag: "custom",
      message: error instanceof Error ? error.message : String(error),
      got: jsonString,
      cause: error,
    });
  }
  try {
    return codec.decoder(json);
  } catch (error) {
    return DecoderError.at(error);
  }
}

export function parseUnknown<Decoded>(
  codec: Codec<Decoded>,
  value: unknown,
): Decoded | DecoderError {
  try {
    return codec.decoder(value);
  } catch (error) {
    return DecoderError.at(error);
  }
}

export function stringify<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
  value: Decoded,
  space?: number | string,
): string {
  return JSON.stringify(codec.encoder(value), null, space);
}

export const parseWithoutCodec: (
  text: string,
  reviver?: (this: unknown, key: string, value: unknown) => unknown,
) => unknown = JSON.parse;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const stringifyWithoutCodec: {
  (
    // eslint-disable-next-line @typescript-eslint/ban-types
    value: Function | symbol | undefined,
    replacer?: Array<number | string> | null,
    space?: number | string,
  ): undefined;
  (
    value: unknown,
    replacer?: Array<number | string> | null,
    space?: number | string,
  ): string;
  (
    value: unknown,
    replacer: (this: unknown, key: string, value: unknown) => unknown,
    space?: number | string,
  ): string | undefined;
} = JSON.stringify as any;

function identity<T>(value: T): T {
  return value;
}

export const unknown: Codec<unknown> = {
  decoder: identity,
  encoder: identity,
};

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

export function stringUnion<const Variants extends ReadonlyArray<string>>(
  variants: Variants[number] extends never
    ? "stringUnion must have at least one variant"
    : readonly [...Variants],
): Codec<Variants[number], Variants[number]> {
  return {
    decoder: function stringUnionDecoder(value) {
      const str = string.decoder(value);
      if (!variants.includes(str)) {
        throw new DecoderError({
          tag: "unknown stringUnion variant",
          knownVariants: variants as Array<string>,
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

export function array<DecodedItem, EncodedItem>(
  codec: Codec<DecodedItem, EncodedItem>,
): Codec<Array<DecodedItem>, Array<EncodedItem>> {
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

export function record<DecodedValue, EncodedValue>(
  codec: Codec<DecodedValue, EncodedValue>,
): Codec<Record<string, DecodedValue>, Record<string, EncodedValue>> {
  return {
    decoder: function recordDecoder(value) {
      const object = unknownRecord(value);
      const keys = Object.keys(object);
      const result: Record<string, DecodedValue> = {};

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
      const result: Record<string, EncodedValue> = {};
      for (const [key, value] of Object.entries(object)) {
        if (key === "__proto__") {
          continue;
        }
        result[key] = codec.encoder(value);
      }
      return result;
    },
  };
}

type FieldsMapping = Record<string, Codec<any, any, CodecOptions>>;

type InferFields<Mapping extends FieldsMapping> = Expand<
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
  {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? never
      : Key]: Infer<Mapping[Key]>;
  } & {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? Key
      : never]?: Infer<Mapping[Key]>;
  }
>;

type InferEncodedFields<Mapping extends FieldsMapping> = Expand<
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
  {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? never
      : Mapping[Key] extends { encodedFieldName: infer Name }
      ? Name extends string
        ? Name
        : Key
      : Key]: InferEncoded<Mapping[Key]>;
  } & {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? Mapping[Key] extends { encodedFieldName: infer Name }
        ? Name extends string
          ? Name
          : Key
        : Key
      : never]?: InferEncoded<Mapping[Key]>;
  }
>;

export function fields<Mapping extends FieldsMapping>(
  mapping: Mapping,
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {},
): Codec<InferFields<Mapping>, InferEncodedFields<Mapping>> {
  return {
    decoder: function fieldsDecoder(value) {
      const object = unknownRecord(value);
      const keys = Object.keys(mapping);
      const knownFields = new Set<string>();
      const result: Record<string, unknown> = {};

      for (const key of keys) {
        if (key === "__proto__") {
          continue;
        }
        const {
          decoder,
          encodedFieldName: field = key,
          optional: isOptional = false,
        } = mapping[key];
        if (field === "__proto__") {
          continue;
        }
        knownFields.add(field);
        if (!(field in object)) {
          if (isOptional) {
            continue;
          }
          throw new DecoderError({
            tag: "missing field",
            field,
            got: object,
          });
        }
        try {
          const decoded: unknown = decoder(object[field]);
          result[key] = decoded;
        } catch (error) {
          throw DecoderError.at(error, key);
        }
      }

      if (exact === "throw") {
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
    },
    encoder: function fieldsEncoder(object) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(mapping)) {
        if (key === "__proto__") {
          continue;
        }
        const {
          encoder,
          encodedFieldName: field = key,
          optional: isOptional = false,
        } = mapping[key];
        if (field === "__proto__" || (isOptional && !(key in object))) {
          continue;
        }
        const value = object[key as keyof InferFields<Mapping>];
        result[field] = encoder(value);
      }
      return result as InferEncodedFields<Mapping>;
    },
  };
}

type InferFieldsUnion<MappingsUnion extends FieldsMapping> =
  MappingsUnion extends any ? InferFields<MappingsUnion> : never;

type InferEncodedFieldsUnion<MappingsUnion extends FieldsMapping> =
  MappingsUnion extends any ? InferEncodedFields<MappingsUnion> : never;

export function fieldsUnion<
  DecodedCommonField extends keyof Variants[number],
  Variants extends ReadonlyArray<
    Record<
      DecodedCommonField,
      Codec<any, any, { tag: { decoded: string; encoded: string } }>
    > &
      Record<string, Codec<any, any, CodecOptions>>
  >,
>(
  decodedCommonField: Variants[number] extends never
    ? "fieldsUnion must have at least one variant"
    : keyof InferEncodedFieldsUnion<Variants[number]> extends never
    ? "fieldsUnion variants must have a field in common, and their encoded field names must be the same"
    : DecodedCommonField,
  variants: [...Variants],
  { exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {},
): Codec<
  InferFieldsUnion<Variants[number]>,
  InferEncodedFieldsUnion<Variants[number]>
> {
  if (decodedCommonField === "__proto__") {
    throw new Error("fieldsUnion: commonField cannot be __proto__");
  }

  type VariantCodec = Codec<any, any>;
  const decoderMap = new Map<string, VariantCodec["decoder"]>(); // encodedName -> decoder
  const encoderMap = new Map<string, VariantCodec["encoder"]>(); // decodedName -> encoder

  let maybeEncodedCommonField: number | string | symbol | undefined = undefined;

  for (const [index, variant] of variants.entries()) {
    const codec = variant[decodedCommonField];
    const { encodedFieldName = decodedCommonField } = codec;
    if (maybeEncodedCommonField === undefined) {
      maybeEncodedCommonField = encodedFieldName;
    } else if (maybeEncodedCommonField !== encodedFieldName) {
      throw new Error(
        `Codec.fieldsUnion: Variant at index ${index}: Key ${JSON.stringify(
          decodedCommonField,
        )}: Got a different encoded field name (${JSON.stringify(
          encodedFieldName,
        )}) than before (${JSON.stringify(maybeEncodedCommonField)}).`,
      );
    }
    const fullCodec: Codec<
      InferFields<Variants[number]>,
      InferEncodedFields<Variants[number]>
    > = fields(variant, { exact });
    decoderMap.set(codec.tag.encoded, fullCodec.decoder);
    encoderMap.set(codec.tag.decoded, fullCodec.encoder);
  }

  if (typeof maybeEncodedCommonField !== "string") {
    throw new Error(
      `Codec.fieldsUnion: Got unusable encoded common field: ${repr(
        maybeEncodedCommonField,
      )}`,
    );
  }

  const encodedCommonField = maybeEncodedCommonField;

  return {
    decoder: function fieldsUnionDecoder(value) {
      const encodedName = singleField(encodedCommonField, string).decoder(
        value,
      );
      const decoder = decoderMap.get(encodedName);
      if (decoder === undefined) {
        throw new DecoderError({
          tag: "unknown fieldsUnion tag",
          knownTags: Array.from(decoderMap.keys()),
          got: encodedName,
          key: encodedCommonField,
        });
      }
      try {
        return decoder(value) as InferFieldsUnion<Variants[number]>;
      } catch (error) {
        const newError = DecoderError.at(error);
        if (newError.path.length === 0) {
          newError.fieldsUnionEncodedCommonField = {
            key: encodedCommonField,
            value: encodedName,
          };
        }
        throw newError;
      }
    },
    encoder: function fieldsUnionEncoder(value) {
      const decodedName = (value as Record<number | string | symbol, string>)[
        decodedCommonField
      ];
      const encoder = encoderMap.get(decodedName);
      if (encoder === undefined) {
        throw new Error(
          `Codec.fieldsUnion: Unexpectedly found no encoder for decoded variant name: ${JSON.stringify(
            decodedName,
          )} at key ${JSON.stringify(decodedCommonField)}`,
        );
      }
      return encoder(value) as InferEncodedFieldsUnion<Variants[number]>;
    },
  };
}

// TODO: Good name
export function named<
  Decoded,
  Encoded,
  EncodedFieldName extends string,
  Options extends CodecOptions,
>(
  encodedFieldName: EncodedFieldName,
  codec: Codec<Decoded, Encoded, Options>,
): Codec<
  Decoded,
  Encoded,
  MergeOptions<Options, { encodedFieldName: EncodedFieldName }>
> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    ...codec,
    encodedFieldName,
  } as Codec<
    Decoded,
    Encoded,
    MergeOptions<Options, { encodedFieldName: EncodedFieldName }>
  >;
}

export function tuple<Decoded extends ReadonlyArray<unknown>, EncodedItem>(
  mapping: readonly [
    ...{ [Key in keyof Decoded]: Codec<Decoded[Key], EncodedItem> },
  ],
): Codec<[...Decoded], Array<EncodedItem>> {
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
      return result as [...Decoded];
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

export function multi<
  Types extends ReadonlyArray<
    "array" | "boolean" | "null" | "number" | "object" | "string" | "undefined"
  >,
>(
  types: Types[number] extends never
    ? "multi must have at least one type"
    : [...Types],
): Codec<Multi<Types[number]>, Multi<Types[number]>["value"]> {
  return {
    decoder: function multiDecoder(value) {
      if (value === undefined) {
        if (types.includes("undefined")) {
          return { type: "undefined", value } as unknown as Multi<
            Types[number]
          >;
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
        knownTypes: types as Array<"undefined">, // Type checking hack.
        got: value,
      });
    },
    encoder: function multiEncoder(value) {
      return value.value;
    },
  };
}

export function recursive<Decoded, Encoded>(
  callback: () => Codec<Decoded, Encoded>,
): Codec<Decoded, Encoded> {
  return {
    decoder: function lazyDecoder(value) {
      return callback().decoder(value);
    },
    encoder: function lazyEncoder(value) {
      return callback().encoder(value);
    },
  };
}

export function optional<Decoded, Encoded, Options extends CodecOptions>(
  codec: Codec<Decoded, Encoded, Options>,
): Codec<
  Decoded,
  Encoded,
  // @ts-expect-error TypeScript does not like `Omit` on `Options` for
  // some reason, but it still works.
  MergeOptions<Omit<Options, "tag">, { optional: true }>
> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    ...codec,
    optional: true,
  } as Codec<Decoded, Encoded, MergeOptions<Options, { optional: true }>>;
}

export function undefinable<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | undefined, Encoded | undefined> {
  return {
    decoder: function undefinedOrDecoder(value) {
      if (value === undefined) {
        return undefined;
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
    encoder: function undefinedOrEncoder(value) {
      return value === undefined ? undefined : codec.encoder(value);
    },
  };
}

export function nullable<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | null, Encoded | null> {
  return {
    decoder: function nullOrDecoder(value) {
      if (value === null) {
        return null;
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
    encoder: function nullOrEncoder(value) {
      return value === null ? null : codec.encoder(value);
    },
  };
}

export function chain<const Decoded, Encoded, NewDecoded>(
  codec: Codec<Decoded, Encoded>,
  transform: {
    decoder: (value: Decoded) => NewDecoded;
    encoder: (value: NewDecoded) => Readonly<Decoded>;
  },
): Codec<NewDecoded, Encoded> {
  return {
    decoder: function chainDecoder(value) {
      return transform.decoder(codec.decoder(value));
    },
    encoder: function chainEncoder(value) {
      return codec.encoder(transform.encoder(value));
    },
  };
}

export function singleField<Decoded, Encoded>(
  field: string,
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded, Record<string, Encoded>> {
  return chain(fields({ [field]: codec }), {
    decoder: (value) => value[field],
    encoder: (value) => ({ [field]: value }),
  });
}

export function tag<const Decoded extends string>(
  decoded: Decoded,
): Codec<Decoded, Decoded, { tag: { decoded: string; encoded: string } }>;

export function tag<const Decoded extends string, const Encoded extends string>(
  decoded: Decoded,
  encoded: Encoded,
): Codec<Decoded, Encoded, { tag: { decoded: string; encoded: string } }>;

export function tag<const Decoded extends string, const Encoded extends string>(
  decoded: Decoded,
  encoded: Encoded = decoded as unknown as Encoded,
): Codec<Decoded, Encoded, { tag: { decoded: string; encoded: string } }> {
  return {
    decoder: function stringUnionDecoder(value) {
      const str = string.decoder(value);
      if (str !== encoded) {
        throw new DecoderError({
          tag: "wrong tag",
          expected: encoded,
          got: str,
        });
      }
      return decoded;
    },
    encoder: () => encoded,
    tag: { decoded, encoded },
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
  options: ReprOptions = {},
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

  const untrustedStringList = (strings: Array<string>): string =>
    formatGot(strings).replace(/^\[|\]$/g, "");

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

    case "wrong tag":
      return `Expected this string: ${JSON.stringify(
        variant.expected,
      )}\nGot: ${formatGot(variant.got)}`;

    case "missing field": {
      const { maxObjectChildren = MAX_OBJECT_CHILDREN_DEFAULT } = options;
      const keys = Object.keys(variant.got);
      return `Expected an object with a field called: ${JSON.stringify(
        variant.field,
      )}\nGot: ${formatGot(variant.got)}${
        keys.length > maxObjectChildren
          ? `\nMore fields: ${untrustedStringList(
              keys.slice(maxObjectChildren),
            )}`
          : ""
      }`;
    }

    case "exact fields":
      return `Expected only these fields: ${stringList(
        variant.knownFields,
      )}\nFound extra fields: ${untrustedStringList(variant.got)}`;

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

  fieldsUnionEncodedCommonField:
    | {
        key: string;
        value: string;
      }
    | undefined;

  // Unnecessary if using `"lib": ["ES2022"]` in tsconfig.json.
  // For those who don’t, this allows `.cause` to be used anyway.
  override cause?: unknown;

  constructor(
    options:
      | { message: string; value: unknown; key?: Key; cause?: unknown }
      | (DecoderErrorVariant & { key?: Key; cause?: unknown }),
  ) {
    const { key, cause, ...params } = options;
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
      "cause" in options ? { cause } : {},
    );
    this.path = key === undefined ? [] : [key];
    this.variant = variant;
    this.nullable = false;
    this.optional = false;
    this.fieldsUnionEncodedCommonField = undefined;

    // For older environments which don’t support the `cause` option.
    if ("cause" in options && !("cause" in this)) {
      this.cause = cause;
    }
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
      cause: error,
      ...(key === undefined ? {} : { key }),
    });
  }

  format(options?: ReprOptions): string {
    const path = this.path.map((part) => `[${JSON.stringify(part)}]`).join("");
    const nullableString = this.nullable ? " (nullable)" : "";
    const optionalString = this.optional ? " (optional)" : "";
    const fieldsUnionString =
      this.fieldsUnionEncodedCommonField === undefined
        ? ""
        : ` (for ${JSON.stringify(
            this.fieldsUnionEncodedCommonField.key,
          )}: ${JSON.stringify(this.fieldsUnionEncodedCommonField.value)})`;
    const variant = formatDecoderErrorVariant(this.variant, options);
    return `At root${path}${nullableString}${optionalString}${fieldsUnionString}:\n${variant}`;
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
            truncatedKey.length + valueRepr.length > maxLength
              ? `\n${indent.repeat(level + 2)}`
              : " ";
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
