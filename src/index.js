// @flow strict

export type Decoder<T> = (value: mixed, errors?: Array<string>) => T;

export function boolean(value: mixed): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`Expected a boolean, but got: ${repr(value)}`);
  }
  return value;
}

export function number(value: mixed): number {
  if (typeof value !== "number") {
    throw new TypeError(`Expected a number, but got: ${repr(value)}`);
  }
  return value;
}

export function string(value: mixed): string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected a string, but got: ${repr(value)}`);
  }
  return value;
}

export function constant<T: boolean | number | string | void | null>(
  constantValue: T
): (value: mixed) => T {
  return function constantDecoder(value: mixed): T {
    if (value !== constantValue) {
      throw new TypeError(
        `Expected the value ${repr(constantValue)}, but got: ${repr(value)}`
      );
    }
    return constantValue;
  };
}

function mixedObject(value: mixed): { +[string]: mixed, ... } {
  if (typeof value !== "object" || value == null) {
    throw new TypeError(`Expected an object, but got: ${repr(value)}`);
  }
  return value;
}

export function array<T, U>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U } = "throw"
): Decoder<Array<T | U>> {
  return function arrayDecoder(
    value: mixed,
    errors?: Array<string>
  ): Array<T | U> {
    if (typeof value !== "object" || value == null) {
      throw new TypeError(
        `Expected an array (or array-like object), but got: ${repr(value)}`
      );
    }
    let length = undefined;
    if (Array.isArray(value)) {
      ({ length } = value);
    } else {
      try {
        length = number(value.length);
        Array(length);
      } catch (_error) {
        throw new TypeError(
          keyErrorMessage(
            "length",
            value,
            `Expected a valid array length (unsigned 32-bit integer), but got: ${repr(
              value.length
            )}`
          )
        );
      }
    }
    const result = [];
    for (let index = 0; index < length; index++) {
      try {
        const localErrors = [];
        result.push(decoder(value[index.toString()], localErrors));
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(index, value, localErrors[index2]));
          }
        }
      } catch (error) {
        const message = keyErrorMessage(index, value, error.message);
        if (mode === "throw") {
          error.message = message;
          throw error;
        }
        if (errors != null) {
          errors.push(message);
        }
        if (typeof mode !== "string") {
          result.push(mode.default);
        }
      }
    }
    return result;
  };
}

export function dict<T, U>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U } = "throw"
): Decoder<{ [key: string]: T | U, ... }> {
  return function dictDecoder(
    value: mixed,
    errors?: Array<string>
  ): { [key: string]: T | U, ... } {
    const obj = mixedObject(value);
    const keys = Object.keys(obj);
    // Using a for-loop rather than `.reduce` gives a nicer stack trace.
    const result = {};
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      try {
        const localErrors = [];
        result[key] = decoder(obj[key], localErrors);
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(key, obj, localErrors[index2]));
          }
        }
      } catch (error) {
        const message = keyErrorMessage(key, obj, error.message);
        if (mode === "throw") {
          error.message = message;
          throw error;
        }
        if (errors != null) {
          errors.push(message);
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
    field: <U, V>(
      key: string | number,
      decoder: Decoder<U>,
      mode?: "throw" | { default: V }
    ) => U | V,
    fieldError: (key: string | number, message: string) => TypeError,
    obj: { +[string]: mixed, ... },
    errors?: Array<string>
  ) => T
): Decoder<T> {
  return function fieldsDecoder(value: mixed, errors?: Array<string>): T {
    const obj = mixedObject(value);
    function field<U, V>(
      key: string | number,
      decoder: Decoder<U>,
      mode?: "throw" | { default: V } = "throw"
    ): U | V {
      try {
        const localErrors = [];
        const result = decoder(obj[key.toString()], localErrors);
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(key, obj, localErrors[index2]));
          }
        }
        return result;
      } catch (error) {
        const message = keyErrorMessage(key, obj, error.message);
        if (mode === "throw") {
          error.message = message;
          throw error;
        }
        if (errors != null) {
          errors.push(message);
        }
        return mode.default;
      }
    }
    function fieldError(key: string | number, message: string): TypeError {
      return new TypeError(keyErrorMessage(key, obj, message));
    }
    return callback(field, fieldError, obj, errors);
  };
}

export function pair<T1, T2>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>
): Decoder<[T1, T2]> {
  // eslint-disable-next-line flowtype/require-parameter-type
  return fields(function pairDecoder(field): [T1, T2] {
    return [field(0, decoder1), field(1, decoder2)];
  });
}

export function triple<T1, T2, T3>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>,
  decoder3: Decoder<T3>
): Decoder<[T1, T2, T3]> {
  // eslint-disable-next-line flowtype/require-parameter-type
  return fields(function tripleDecoder(field): [T1, T2, T3] {
    return [field(0, decoder1), field(1, decoder2), field(2, decoder3)];
  });
}

type DecoderType = <T, U>(Decoder<T | U>) => T | U;

export function autoRecord<T: { ... }>(
  mapping: T
): Decoder<$ObjMap<T, DecoderType>> {
  return function autoRecordDecoder(
    value: mixed,
    errors?: Array<string>
  ): $ObjMap<T, DecoderType> {
    const obj = mixedObject(value);
    const keys = Object.keys(mapping);
    // Using a for-loop rather than `.reduce` gives a nicer stack trace.
    const result = {};
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const decoder = mapping[key];
      try {
        const localErrors = [];
        result[key] = decoder(obj[key], localErrors);
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(key, obj, localErrors[index2]));
          }
        }
      } catch (error) {
        error.message = keyErrorMessage(key, obj, error.message);
        throw error;
      }
    }
    return result;
  };
}

export function deep<T>(
  path: Array<string | number>,
  decoder: Decoder<T>
): Decoder<T> {
  return path.reduceRight(
    (nextDecoder, key) =>
      // eslint-disable-next-line flowtype/require-parameter-type
      fields(function deepRecord(field): T {
        return field(key, nextDecoder);
      }),
    decoder
  );
}

export function optional<T, U>(
  decoder: Decoder<T>,
  // This parameter is implicitly optional since `U` is allowed to be `void`
  // (undefined), but don’t mark it with a question mark (`defaultValue?: U`)
  // because that causes `name: optional(string)` in the `User` test in
  // `flow/user.js` not to be an error for a `name: string` type annotation!
  defaultValue: U
): Decoder<T | U> {
  return function optionalDecoder(value: mixed, errors?: Array<string>): T | U {
    if (value == null) {
      return defaultValue;
    }
    try {
      return decoder(value, errors);
    } catch (error) {
      error.message = `(optional) ${error.message}`;
      throw error;
    }
  };
}

export function map<T, U>(
  decoder: Decoder<T>,
  fn: (value: T, errors?: Array<string>) => U
): Decoder<U> {
  return function mapDecoder(value: mixed, errors?: Array<string>): U {
    return fn(decoder(value, errors), errors);
  };
}

const eitherPrefix = "Several decoders failed:\n";

export function either<T, U>(
  decoder1: Decoder<T>,
  decoder2: Decoder<U>
): Decoder<T | U> {
  return function eitherDecoder(value: mixed, errors?: Array<string>): T | U {
    try {
      return decoder1(value, errors);
    } catch (error1) {
      try {
        return decoder2(value, errors);
      } catch (error2) {
        error2.message = [
          eitherPrefix,
          stripPrefix(eitherPrefix, error1.message),
          "\n",
          stripPrefix(eitherPrefix, error2.message),
        ].join("");
        throw error2;
      }
    }
  };
}

function stripPrefix(prefix: string, str: string): string {
  return str.slice(0, prefix.length) === prefix
    ? str.slice(prefix.length)
    : str;
}

export function lazy<T>(callback: () => Decoder<T>): Decoder<T> {
  return function lazyDecoder(value: mixed, errors?: Array<string>): T {
    return callback()(value, errors);
  };
}

repr.sensitive = false;

export function repr(
  // $FlowIgnore: Using `any` rather than `mixed` here to cut down on the bytes.
  value: any,
  {
    recurse = true,
    maxArrayChildren = 5,
    maxObjectChildren = 3,
    maxLength = 100,
    recurseMaxLength = 20,
  }: {
    recurse?: boolean,
    maxArrayChildren?: number,
    maxObjectChildren?: number,
    maxLength?: number,
    recurseMaxLength?: number,
  } = {}
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
      return repr.sensitive
        ? toStringType.toLowerCase()
        : truncate(String(value), maxLength);
    }

    if (type === "string") {
      return repr.sensitive ? type : truncate(JSON.stringify(value), maxLength);
    }

    if (type === "function") {
      return `function ${truncate(JSON.stringify(value.name), maxLength)}`;
    }

    if (Array.isArray(value)) {
      const arr: Array<mixed> = value;
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
      const obj: { [key: string]: mixed, ... } = value;
      const keys = Object.keys(obj);

      // `class Foo {}` has `toStringType === "Object"` and `name === "Foo"`.
      const { name } = obj.constructor;

      if (!recurse && keys.length > 0) {
        return `${name}(${keys.length})`;
      }

      const numHidden = Math.max(0, keys.length - maxObjectChildren);

      const items = keys
        .slice(0, maxObjectChildren)
        .map(
          (key2) =>
            `${truncate(JSON.stringify(key2), recurseMaxLength)}: ${repr(
              obj[key2],
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

const keyErrorPrefixRegex = /^(?:object|array)(?=\[)/;

function keyErrorMessage(
  key: string | number,
  value: mixed,
  message: string
): string {
  const missing =
    typeof key === "number" && Number.isInteger(key) && Array.isArray(value)
      ? key < 0 || key >= value.length
        ? "(out of bounds)"
        : ""
      : value == null || typeof value !== "object"
      ? /* istanbul ignore next */ ""
      : Object.prototype.hasOwnProperty.call(value, key)
      ? ""
      : key in value
      ? "(prototype)"
      : "(missing)";

  return [
    `${Array.isArray(value) ? "array" : "object"}[${JSON.stringify(key)}]`,
    keyErrorPrefixRegex.test(message)
      ? ""
      : missing !== ""
      ? ` ${missing}: `
      : ": ",
    message.replace(keyErrorPrefixRegex, ""),
  ].join("");
}
