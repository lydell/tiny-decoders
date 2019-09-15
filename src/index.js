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

export function mixedArray(value: mixed): $ReadOnlyArray<mixed> {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected an array, but got: ${repr(value)}`);
  }
  return value;
}

export function mixedDict(value: mixed): { +[string]: mixed, ... } {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new TypeError(`Expected an object, but got: ${repr(value)}`);
  }
  return value;
}

export function array<T, U>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | {| default: U |} = "throw"
): Decoder<Array<T | U>> {
  return function arrayDecoder(
    value: mixed,
    errors?: Array<string>
  ): Array<T | U> {
    const arr = mixedArray(value);
    // Use a for-loop instead of `.map` to handle `array holes (`[1, , 2]`).
    // A nicer way would be to use `Array.from(arr, (_, index) => ...)` but that
    // unnecessarily reduces browser support.
    // Also, not using a callback function gives a nicer stack trace.
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      try {
        const localErrors = [];
        result.push(decoder(arr[index], localErrors));
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(index, arr, localErrors[index2]));
          }
        }
      } catch (error) {
        const message = keyErrorMessage(index, arr, error.message);
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
  mode?: "throw" | "skip" | {| default: U |} = "throw"
): Decoder<{ [key: string]: T | U, ... }> {
  return function dictDecoder(
    value: mixed,
    errors?: Array<string>
  ): { [key: string]: T | U, ... } {
    const obj = mixedDict(value);
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

export function record<T>(
  callback: (
    field: <U, V>(
      key: string,
      decoder: Decoder<U>,
      mode?: "throw" | {| default: V |}
    ) => U | V,
    fieldError: (key: string, message: string) => TypeError,
    obj: { +[string]: mixed, ... },
    errors?: Array<string>
  ) => T
): Decoder<T> {
  return function recordDecoder(value: mixed, errors?: Array<string>): T {
    const obj = mixedDict(value);
    function field<U, V>(
      key: string,
      decoder: Decoder<U>,
      mode?: "throw" | {| default: V |} = "throw"
    ): U | V {
      try {
        const localErrors = [];
        const result = decoder(obj[key], localErrors);
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
    function fieldError(key: string, message: string): TypeError {
      return new TypeError(keyErrorMessage(key, obj, message));
    }
    return callback(field, fieldError, obj, errors);
  };
}

export function tuple<T>(
  callback: (
    item: <U, V>(
      index: number,
      decoder: Decoder<U>,
      mode?: "throw" | {| default: V |}
    ) => U | V,
    itemError: (index: number, message: string) => TypeError,
    arr: $ReadOnlyArray<mixed>,
    errors?: Array<string>
  ) => T
): Decoder<T> {
  return function tupleDecoder(value: mixed, errors?: Array<string>): T {
    const arr = mixedArray(value);
    function item<U, V>(
      index: number,
      decoder: Decoder<U>,
      mode?: "throw" | {| default: V |} = "throw"
    ): U | V {
      try {
        const localErrors = [];
        const result = decoder(arr[index], localErrors);
        if (errors != null) {
          for (let index2 = 0; index2 < localErrors.length; index2++) {
            errors.push(keyErrorMessage(index, arr, localErrors[index2]));
          }
        }
        return result;
      } catch (error) {
        const message = keyErrorMessage(index, arr, error.message);
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
    function itemError(index: number, message: string): TypeError {
      return new TypeError(keyErrorMessage(index, arr, message));
    }
    return callback(item, itemError, arr, errors);
  };
}

export function pair<T1, T2>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>
): Decoder<[T1, T2]> {
  // eslint-disable-next-line flowtype/require-parameter-type
  return tuple(function pairDecoder(item): [T1, T2] {
    return [item(0, decoder1), item(1, decoder2)];
  });
}

export function triple<T1, T2, T3>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>,
  decoder3: Decoder<T3>
): Decoder<[T1, T2, T3]> {
  // eslint-disable-next-line flowtype/require-parameter-type
  return tuple(function tripleDecoder(item): [T1, T2, T3] {
    return [item(0, decoder1), item(1, decoder2), item(2, decoder3)];
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
    const obj = mixedDict(value);
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
    (nextDecoder, keyOrIndex) =>
      typeof keyOrIndex === "string"
        ? // eslint-disable-next-line flowtype/require-parameter-type
          record(function deepRecord(field): T {
            return field(keyOrIndex, nextDecoder);
          })
        : // eslint-disable-next-line flowtype/require-parameter-type
          tuple(function deepTuple(item): T {
            return item(keyOrIndex, nextDecoder);
          }),
    decoder
  );
}

export function optional<T, U>(
  decoder: Decoder<T>,
  // This parameter is implicitly optional since `U` is allowed to be `void`
  // (undefined), but don’ mark it with a question mark (`defaultValue?: U`)
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

repr.short = false;

export function repr(
  // $FlowIgnore: Using `any` rather than `mixed` here to cut down on the bytes.
  value: any,
  {
    key,
    recurse = true,
    maxArrayChildren = 5,
    maxObjectChildren = 3,
  }: {|
    key?: string | number,
    recurse?: boolean,
    maxArrayChildren?: number,
    maxObjectChildren?: number,
  |} = {}
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
      return repr.short ? toStringType.toLowerCase() : truncate(String(value));
    }

    if (type === "string") {
      return repr.short ? type : printString(value);
    }

    if (type === "function") {
      return `function ${printString(value.name)}`;
    }

    if (Array.isArray(value)) {
      const arr: Array<mixed> = value;
      if (!recurse && arr.length > 0) {
        return `${toStringType}(${arr.length})`;
      }

      const lastIndex = arr.length - 1;
      const items = [];

      // Print values around the provided key, if any.
      const start =
        typeof key === "number"
          ? Math.max(0, Math.min(key, lastIndex - maxArrayChildren + 1))
          : 0;
      const end = Math.min(start + maxArrayChildren - 1, lastIndex);

      if (start > 0) {
        items.push(`(${start} more)`);
      }

      for (let index = start; index <= end; index++) {
        const item =
          index in arr ? repr(arr[index], { recurse: false }) : "<empty>";
        items.push(index === key ? `(index ${index}) ${item}` : item);
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

      // Make sure the provided key (if any) comes first, so that it is visible.
      const newKeys =
        typeof key === "string" && keys.indexOf(key) >= 0
          ? [key, ...keys.filter(key2 => key2 !== key)]
          : keys;

      const numHidden = Math.max(0, newKeys.length - maxObjectChildren);

      const items = newKeys
        .slice(0, maxObjectChildren)
        .map(
          key2 => `${printString(key2)}: ${repr(obj[key2], { recurse: false })}`
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

function printString(str: string): string {
  return truncate(JSON.stringify(str));
}

function truncate(str: string): string {
  // If the string is too long, show a bit at the start and a bit at the end and
  // cut out the middle (replacing it with a separator). Explaining the magic
  // numbers: 20 is the maximum length and: `20 = 10 + "…".length + 9`.
  // `maxLength` and `separator` could be taken as parameters and the offset
  // could be calculated from them, but I’ve hardcoded them to save some bytes.
  return str.length <= 20
    ? str
    : [str.slice(0, 10), "…", str.slice(-9)].join("");
}

const keyErrorPrefixRegex = /^(?:object|array)(?=\[)/;

function keyErrorMessage(
  key: string | number,
  value: mixed,
  message: string
): string {
  const prefix = typeof key === "string" ? "object" : "array";
  const at = typeof key === "string" ? printString(key) : String(key);
  const missing =
    typeof key === "number"
      ? Array.isArray(value) && (key < 0 || key >= value.length)
        ? " (out of bounds)"
        : ""
      : value == null || typeof value !== "object"
      ? /* istanbul ignore next */ ""
      : Object.prototype.hasOwnProperty.call(value, key)
      ? ""
      : key in value
      ? " (prototype)"
      : " (missing)";
  return [
    `${prefix}[${at}]`,
    keyErrorPrefixRegex.test(message) ? "" : ": ",
    message.replace(keyErrorPrefixRegex, ""),
    repr.short ? "" : `\nat ${at}${missing} in ${repr(value, { key })}`,
  ].join("");
}
