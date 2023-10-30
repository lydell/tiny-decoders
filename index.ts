// There are some things that cannot be implemented without `any`.
// No `any` “leaks” when _using_ the library, though.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Codec<Decoded, Encoded = unknown> = {
  decoder: (value: unknown) => DecoderResult<Decoded>;
  encoder: (value: Decoded) => Encoded;
};

export type DecoderResult<Decoded> =
  | {
      tag: "DecoderError";
      error: DecoderError;
    }
  | {
      tag: "Valid";
      value: Decoded;
    };

export type Infer<T extends Codec<any>> = Extract<
  ReturnType<T["decoder"]>,
  { tag: "Valid" }
>["value"];

export type InferEncoded<T extends Codec<any>> = ReturnType<T["encoder"]>;

// Make VSCode show `{ a: string; b?: number }` instead of `{ a: string } & { b?: number }`.
// https://stackoverflow.com/a/57683652/2010616
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

const CodecJSON = {
  parse<Decoded>(
    codec: Codec<Decoded>,
    jsonString: string,
  ): DecoderResult<Decoded> {
    let json: unknown;
    try {
      json = JSON.parse(jsonString);
    } catch (unknownError) {
      const error = unknownError as Error; // `JSON.parse` always throws `Error` instances.
      return {
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: `${error.name}: ${error.message}`,
          path: [],
        },
      };
    }
    return codec.decoder(json);
  },

  stringify<Decoded, Encoded>(
    codec: Codec<Decoded, Encoded>,
    value: Decoded,
    space?: number | string,
  ): string {
    return JSON.stringify(codec.encoder(value), null, space) ?? "null";
  },
};

export { CodecJSON as JSON };

function identity<T>(value: T): T {
  return value;
}

export const unknown: Codec<unknown> = {
  decoder: (value) => ({ tag: "Valid", value }),
  encoder: identity,
};

export const boolean: Codec<boolean, boolean> = {
  decoder: (value) =>
    typeof value === "boolean"
      ? { tag: "Valid", value }
      : {
          tag: "DecoderError",
          error: { tag: "boolean", got: value, path: [] },
        },
  encoder: identity,
};

export const number: Codec<number, number> = {
  decoder: (value) =>
    typeof value === "number"
      ? { tag: "Valid", value }
      : {
          tag: "DecoderError",
          error: { tag: "number", got: value, path: [] },
        },
  encoder: identity,
};

export const bigint: Codec<bigint, bigint> = {
  decoder: (value) =>
    typeof value === "bigint"
      ? { tag: "Valid", value }
      : {
          tag: "DecoderError",
          error: { tag: "bigint", got: value, path: [] },
        },
  encoder: identity,
};

export const string: Codec<string, string> = {
  decoder: (value) =>
    typeof value === "string"
      ? { tag: "Valid", value }
      : {
          tag: "DecoderError",
          error: { tag: "string", got: value, path: [] },
        },
  encoder: identity,
};

type primitive = bigint | boolean | number | string | symbol | null | undefined;

export function primitiveUnion<
  const Variants extends readonly [primitive, ...Array<primitive>],
>(variants: Variants): Codec<Variants[number], Variants[number]> {
  return {
    decoder: (value) =>
      variants.includes(value as primitive)
        ? { tag: "Valid", value: value as primitive }
        : {
            tag: "DecoderError",
            error: {
              tag: "unknown primitiveUnion variant",
              knownVariants: variants as unknown as Array<primitive>,
              got: value,
              path: [],
            },
          },
    encoder: identity,
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

export function array<DecodedItem, EncodedItem>(
  codec: Codec<DecodedItem, EncodedItem>,
): Codec<Array<DecodedItem>, Array<EncodedItem>> {
  return {
    decoder: (value) => {
      const arrResult = unknownArray(value);
      if (arrResult.tag === "DecoderError") {
        return arrResult;
      }
      const arr = arrResult.value;
      const result = [];
      for (let index = 0; index < arr.length; index++) {
        const decoderResult = codec.decoder(arr[index]);
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
    },
    encoder: (arr) => {
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
    decoder: (value) => {
      const objectResult = unknownRecord(value);
      if (objectResult.tag === "DecoderError") {
        return objectResult;
      }
      const object = objectResult.value;
      const keys = Object.keys(object);
      const result: Record<string, DecodedValue> = {};

      for (const key of keys) {
        if (key === "__proto__") {
          continue;
        }
        const decoderResult = codec.decoder(object[key]);
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
    },
    encoder: (object) => {
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

type Field<Decoded, Encoded, Meta extends FieldMeta> = Meta & {
  codec: Codec<Decoded, Encoded>;
};

type FieldMeta = {
  renameFrom?: string | undefined;
  optional?: boolean | undefined;
  tag?: { decoded: primitive; encoded: primitive } | undefined;
};

type FieldsMapping = Record<string, Codec<any> | Field<any, any, FieldMeta>>;

type InferField<T extends Codec<any> | Field<any, any, FieldMeta>> =
  T extends Field<any, any, FieldMeta>
    ? Infer<T["codec"]>
    : T extends Codec<any>
    ? Infer<T>
    : never;

type InferEncodedField<T extends Codec<any> | Field<any, any, FieldMeta>> =
  T extends Field<any, any, FieldMeta>
    ? InferEncoded<T["codec"]>
    : T extends Codec<any>
    ? InferEncoded<T>
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

type InferEncodedFields<Mapping extends FieldsMapping> = Expand<
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
  {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? never
      : Mapping[Key] extends { renameFrom: infer Name }
      ? Name extends string
        ? Name
        : Key
      : Key]: InferEncodedField<Mapping[Key]>;
  } & {
    [Key in keyof Mapping as Mapping[Key] extends { optional: true }
      ? Mapping[Key] extends { renameFrom: infer Name }
        ? Name extends string
          ? Name
          : Key
        : Key
      : never]?: InferEncodedField<Mapping[Key]>;
  }
>;

export function fieldsAuto<Mapping extends FieldsMapping>(
  mapping: Mapping,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Codec<InferFields<Mapping>, InferEncodedFields<Mapping>> {
  return {
    decoder: (value) => {
      const objectResult = unknownRecord(value);
      if (objectResult.tag === "DecoderError") {
        return objectResult;
      }
      const object = objectResult.value;
      const knownFields = new Set<string>();
      const result: Record<string, unknown> = {};

      for (const [key, fieldOrCodec] of Object.entries(mapping)) {
        if (key === "__proto__") {
          continue;
        }
        const field_: Field<any, any, FieldMeta> =
          "codec" in fieldOrCodec ? fieldOrCodec : { codec: fieldOrCodec };
        const {
          codec: { decoder },
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
    },
    encoder: (object) => {
      const result: Record<string, unknown> = {};
      for (const [key, fieldOrCodec] of Object.entries(mapping)) {
        if (key === "__proto__") {
          continue;
        }
        const field_: Field<any, any, FieldMeta> =
          "codec" in fieldOrCodec ? fieldOrCodec : { codec: fieldOrCodec };
        const {
          codec: { encoder },
          renameFrom: encodedFieldName = key,
          optional: isOptional = false,
        } = field_;
        if (
          encodedFieldName === "__proto__" ||
          (isOptional && !(key in object))
        ) {
          continue;
        }
        const value = object[key as keyof InferFields<Mapping>];
        result[encodedFieldName] = encoder(value);
      }
      return result as InferEncodedFields<Mapping>;
    },
  };
}

export function field<
  Decoded,
  Encoded,
  const Meta extends Omit<FieldMeta, "tag">,
>(codec: Codec<Decoded, Encoded>, meta: Meta): Field<Decoded, Encoded, Meta> {
  return {
    codec,
    ...meta,
  };
}

type InferFieldsUnion<MappingsUnion extends FieldsMapping> =
  MappingsUnion extends any ? InferFields<MappingsUnion> : never;

type InferEncodedFieldsUnion<MappingsUnion extends FieldsMapping> =
  MappingsUnion extends any ? InferEncodedFields<MappingsUnion> : never;

type Variant<DecodedCommonField extends number | string | symbol> = Record<
  DecodedCommonField,
  Field<any, any, { tag: { decoded: primitive; encoded: primitive } }>
> &
  Record<string, Codec<any> | Field<any, any, FieldMeta>>;

export function fieldsUnion<
  const DecodedCommonField extends keyof Variants[number],
  Variants extends readonly [
    Variant<DecodedCommonField>,
    ...Array<Variant<DecodedCommonField>>,
  ],
>(
  decodedCommonField: keyof InferEncodedFieldsUnion<
    Variants[number]
  > extends never
    ? [
        "fieldsUnion variants must have a field in common, and their encoded field names must be the same",
        never,
      ]
    : DecodedCommonField,
  variants: Variants,
  { allowExtraFields = true }: { allowExtraFields?: boolean } = {},
): Codec<
  InferFieldsUnion<Variants[number]>,
  InferEncodedFieldsUnion<Variants[number]>
> {
  if (decodedCommonField === "__proto__") {
    throw new Error("fieldsUnion: decoded common field cannot be __proto__");
  }

  type VariantCodec = Codec<any, any>;
  const decoderMap = new Map<primitive, VariantCodec["decoder"]>(); // encodedName -> decoder
  const encoderMap = new Map<primitive, VariantCodec["encoder"]>(); // decodedName -> encoder

  let maybeEncodedCommonField: number | string | symbol | undefined = undefined;

  for (const [index, variant] of variants.entries()) {
    const field_: Field<
      any,
      any,
      FieldMeta & { tag: { decoded: primitive; encoded: primitive } }
    > = variant[decodedCommonField];
    const {
      renameFrom: encodedFieldName = decodedCommonField as DecodedCommonField,
    } = field_;
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
    const fullCodec = fieldsAuto(variant, { allowExtraFields });
    decoderMap.set(field_.tag.encoded, fullCodec.decoder);
    encoderMap.set(field_.tag.decoded, fullCodec.encoder);
  }

  if (typeof maybeEncodedCommonField !== "string") {
    throw new Error(
      `fieldsUnion: Got unusable encoded common field: ${repr(
        maybeEncodedCommonField,
      )}`,
    );
  }

  const encodedCommonField = maybeEncodedCommonField;

  return {
    decoder: (value) => {
      const encodedNameResult = fieldsAuto({
        [encodedCommonField]: unknown,
      }).decoder(value);
      if (encodedNameResult.tag === "DecoderError") {
        return encodedNameResult;
      }
      const encodedName = encodedNameResult.value[encodedCommonField];
      const decoder = decoderMap.get(encodedName as primitive);
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
    },
    encoder: (value) => {
      const decodedName = (
        value as Record<number | string | symbol, primitive>
      )[decodedCommonField as DecodedCommonField];
      const encoder = encoderMap.get(decodedName);
      if (encoder === undefined) {
        throw new Error(
          `fieldsUnion: Unexpectedly found no encoder for decoded variant name: ${JSON.stringify(
            decodedName,
          )} at key ${JSON.stringify(decodedCommonField)}`,
        );
      }
      return encoder(value) as InferEncodedFieldsUnion<Variants[number]>;
    },
  };
}

export function tag<const Decoded extends primitive>(
  decoded: Decoded,
): Field<Decoded, Decoded, { tag: { decoded: primitive; encoded: primitive } }>;

export function tag<
  const Decoded extends primitive,
  const Encoded extends primitive,
>(
  decoded: Decoded,
  options: {
    renameTagFrom: Encoded;
  },
): Field<Decoded, Encoded, { tag: { decoded: primitive; encoded: primitive } }>;

export function tag<
  const Decoded extends primitive,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  options: {
    renameFieldFrom: EncodedFieldName;
  },
): Field<
  Decoded,
  Decoded,
  {
    renameFrom: EncodedFieldName;
    tag: { decoded: primitive; encoded: primitive };
  }
>;

export function tag<
  const Decoded extends primitive,
  const Encoded extends primitive,
  const EncodedFieldName extends string,
>(
  decoded: Decoded,
  options: {
    renameTagFrom: Encoded;
    renameFieldFrom: EncodedFieldName;
  },
): Field<
  Decoded,
  Encoded,
  {
    renameFrom: EncodedFieldName;
    tag: { decoded: primitive; encoded: primitive };
  }
>;

export function tag<
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
> {
  const encoded = "renameTagFrom" in options ? options.renameTagFrom : decoded;
  return {
    codec: {
      decoder: (value) =>
        value === encoded
          ? { tag: "Valid", value: decoded }
          : {
              tag: "DecoderError",
              error: {
                tag: "wrong tag",
                expected: encoded,
                got: value,
                path: [],
              },
            },
      encoder: () => encoded as Encoded,
    },
    renameFrom: options.renameFieldFrom,
    tag: { decoded, encoded },
  };
}

type InferTuple<Codecs extends ReadonlyArray<Codec<any>>> = [
  ...{ [P in keyof Codecs]: Infer<Codecs[P]> },
];

type InferEncodedTuple<Codecs extends ReadonlyArray<Codec<any>>> = [
  ...{ [P in keyof Codecs]: InferEncoded<Codecs[P]> },
];

export function tuple<const Codecs extends ReadonlyArray<Codec<any>>>(
  codecs: Codecs,
): Codec<InferTuple<Codecs>, InferEncodedTuple<Codecs>> {
  return {
    decoder: (value) => {
      const arrResult = unknownArray(value);
      if (arrResult.tag === "DecoderError") {
        return arrResult;
      }
      const arr = arrResult.value;
      if (arr.length !== codecs.length) {
        return {
          tag: "DecoderError",
          error: {
            tag: "tuple size",
            expected: codecs.length,
            got: arr.length,
            path: [],
          },
        };
      }
      const result = [];
      for (const [index, codec] of codecs.entries()) {
        const decoderResult = codec.decoder(arr[index]);
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
      return { tag: "Valid", value: result as InferTuple<Codecs> };
    },
    encoder: (value) => {
      const result = [];
      for (const [index, codec] of codecs.entries()) {
        result.push(codec.encoder(value[index]));
      }
      return result as InferEncodedTuple<Codecs>;
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
    : Types extends "bigint"
    ? { type: "bigint"; value: bigint }
    : Types extends "string"
    ? { type: "string"; value: string }
    : Types extends "symbol"
    ? { type: "symbol"; value: symbol }
    : Types extends "function"
    ? { type: "function"; value: Function } // eslint-disable-line @typescript-eslint/ban-types
    : Types extends "array"
    ? { type: "array"; value: Array<unknown> }
    : Types extends "object"
    ? { type: "object"; value: Record<string, unknown> }
    : never
  : never;

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

export function multi<
  Types extends readonly [MultiTypeName, ...Array<MultiTypeName>],
>(types: Types): Codec<Multi<Types[number]>, Multi<Types[number]>["value"]> {
  return {
    decoder: (value) => {
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
            value: { type: "boolean", value } as unknown as Multi<
              Types[number]
            >,
          };
        }
      } else if (typeof value === "number") {
        if (types.includes("number")) {
          return {
            tag: "Valid",
            value: { type: "number", value } as unknown as Multi<Types[number]>,
          };
        }
      } else if (typeof value === "bigint") {
        if (types.includes("bigint")) {
          return {
            tag: "Valid",
            value: { type: "bigint", value } as unknown as Multi<Types[number]>,
          };
        }
      } else if (typeof value === "string") {
        if (types.includes("string")) {
          return {
            tag: "Valid",
            value: { type: "string", value } as unknown as Multi<Types[number]>,
          };
        }
      } else if (typeof value === "symbol") {
        if (types.includes("symbol")) {
          return {
            tag: "Valid",
            value: { type: "symbol", value } as unknown as Multi<Types[number]>,
          };
        }
      } else if (typeof value === "function") {
        if (types.includes("function")) {
          return {
            tag: "Valid",
            value: { type: "function", value } as unknown as Multi<
              Types[number]
            >,
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
    },
    encoder: (value) => value.value,
  };
}

export function recursive<Decoded, Encoded>(
  callback: () => Codec<Decoded, Encoded>,
): Codec<Decoded, Encoded> {
  return {
    decoder: (value) => callback().decoder(value),
    encoder: (value) => callback().encoder(value),
  };
}

export function undefinedOr<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | undefined, Encoded | undefined> {
  return {
    decoder: (value) => {
      if (value === undefined) {
        return { tag: "Valid", value: undefined };
      }
      const decoderResult = codec.decoder(value);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              orExpected:
                decoderResult.error.orExpected === "null"
                  ? "null or undefined"
                  : "undefined",
            },
          };
        case "Valid":
          return decoderResult;
      }
    },
    encoder: (value) =>
      value === undefined ? undefined : codec.encoder(value),
  };
}

export function nullOr<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
): Codec<Decoded | null, Encoded | null> {
  return {
    decoder: (value) => {
      if (value === null) {
        return { tag: "Valid", value: null };
      }
      const decoderResult = codec.decoder(value);
      switch (decoderResult.tag) {
        case "DecoderError":
          return {
            tag: "DecoderError",
            error: {
              ...decoderResult.error,
              orExpected:
                decoderResult.error.orExpected === "undefined"
                  ? "null or undefined"
                  : "null",
            },
          };
        case "Valid":
          return decoderResult;
      }
    },
    encoder: (value) => (value === null ? null : codec.encoder(value)),
  };
}

export function map<const Decoded, Encoded, NewDecoded>(
  codec: Codec<Decoded, Encoded>,
  transform: {
    decoder: (value: Decoded) => NewDecoded;
    encoder: (value: NewDecoded) => Readonly<Decoded>;
  },
): Codec<NewDecoded, Encoded> {
  return {
    decoder: (value) => {
      const decoderResult = codec.decoder(value);
      switch (decoderResult.tag) {
        case "DecoderError":
          return decoderResult;
        case "Valid":
          return {
            tag: "Valid",
            value: transform.decoder(decoderResult.value),
          };
      }
    },
    encoder: (value) => codec.encoder(transform.encoder(value)),
  };
}

export function flatMap<const Decoded, Encoded, NewDecoded>(
  codec: Codec<Decoded, Encoded>,
  transform: {
    decoder: (value: Decoded) => DecoderResult<NewDecoded>;
    encoder: (value: NewDecoded) => Readonly<Decoded>;
  },
): Codec<NewDecoded, Encoded> {
  return {
    decoder: (value) => {
      const decoderResult = codec.decoder(value);
      switch (decoderResult.tag) {
        case "DecoderError":
          return decoderResult;
        case "Valid":
          return transform.decoder(decoderResult.value);
      }
    },
    encoder: (value) => codec.encoder(transform.encoder(value)),
  };
}

export type DecoderError = {
  path: Array<number | string>;
  orExpected?: "null or undefined" | "null" | "undefined";
} & (
  | {
      tag: "custom";
      message: string;
      got?: unknown;
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

  const primitiveList = (strings: Array<primitive>): string =>
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
    case "bigint":
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
      return `Expected one of these tags:${primitiveList(
        variant.knownTags,
      )}\nGot: ${formatGot(variant.got)}`;

    case "unknown primitiveUnion variant":
      return `Expected one of these variants:${primitiveList(
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
      return `Expected only these fields:${primitiveList(
        variant.knownFields,
      )}\nFound extra fields:${removeBrackets(formatGot(variant.got))}`;

    case "tuple size":
      return `Expected ${variant.expected} items\nGot: ${variant.got}`;

    case "custom":
      return "got" in variant
        ? `${variant.message}\nGot: ${formatGot(variant.got)}`
        : variant.message;
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
      type === "bigint" ||
      type === "boolean" ||
      type === "symbol" ||
      toStringType === "RegExp"
    ) {
      return sensitive
        ? toStringType.toLowerCase()
        : truncate(String(value) + (type === "bigint" ? "n" : ""), maxLength);
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
