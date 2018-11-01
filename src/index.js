// @flow strict

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

export function mixedArray(value: mixed): Array<mixed> {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected an array, but got: ${repr(value)}`);
  }
  return value;
}

export function mixedDict(value: mixed): { [string]: mixed } {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new TypeError(`Expected an object, but got: ${repr(value)}`);
  }
  return value;
}

export function constant<T: boolean | number | string | void | null>(
  constantValue: T
): mixed => T {
  return function constantDecoder(value: mixed): T {
    if (value !== constantValue) {
      throw new TypeError(
        `Expected the value ${repr(constantValue)}, but got: ${repr(value)}`
      );
    }
    return constantValue;
  };
}

export function array<T>(decoder: mixed => T): mixed => Array<T> {
  return function arrayDecoder(value: mixed): Array<T> {
    const arr = mixedArray(value);
    // Use a for-loop instead of `.map` to handle `array holes (`[1, , 2]`).
    // A nicer way would be to use `Array.from(arr, (_, index) => ...)` but that
    // unnecessarily reduces browser support.
    // Also, not using a callback function gives a nicer stack trace.
    const result = [];
    for (let index = 0; index < arr.length; index++) {
      result.push(field(index, decoder)(arr));
    }
    return result;
  };
}

export function dict<T>(decoder: mixed => T): mixed => { [string]: T } {
  return function dictDecoder(value: mixed): { [string]: T } {
    const obj = mixedDict(value);
    const keys = Object.keys(obj);
    // Using a for-loop rather than `.reduce` gives a nicer stack trace.
    const result = {};
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      result[key] = field(key, decoder)(obj);
    }
    return result;
  };
}

type ExtractDecoderType = <T, U>((mixed) => T | U) => T | U;

export function group<T: {}>(
  mapping: T
): mixed => $ObjMap<T, ExtractDecoderType> {
  return function groupDecoder(value: mixed): $ObjMap<T, ExtractDecoderType> {
    const keys = Object.keys(mapping);
    // Using a for-loop rather than `.reduce` gives a nicer stack trace.
    const result = {};
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const decoder = mapping[key];
      result[key] = decoder(value);
    }
    return result;
  };
}

export function record<T: {}>(
  mapping: T
): mixed => $ObjMap<T, ExtractDecoderType> {
  return function recordDecoder(value: mixed): $ObjMap<T, ExtractDecoderType> {
    const obj = mixedDict(value);
    const keys = Object.keys(mapping);
    // Using a for-loop rather than `.reduce` gives a nicer stack trace.
    const result = {};
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const decoder = mapping[key];
      try {
        result[key] = decoder(obj[key]);
      } catch (error) {
        error.message = keyErrorMessage(key, obj, error.message);
        throw error;
      }
    }
    return result;
  };
}

export function field<T>(
  key: string | number,
  decoder: mixed => T
): mixed => T {
  return function fieldDecoder(value: mixed): T {
    let obj = undefined;
    let fieldValue = undefined;
    if (typeof key === "string") {
      obj = mixedDict(value);
      fieldValue = obj[key];
    } else {
      obj = mixedArray(value);
      fieldValue = obj[key];
    }
    try {
      return decoder(fieldValue);
    } catch (error) {
      error.message = keyErrorMessage(key, obj, error.message);
      throw error;
    }
  };
}

export function fieldDeep<T>(
  keys: Array<string | number>,
  decoder: mixed => T
): mixed => T {
  return function fieldDeepDecoder(value: mixed): T {
    const chainedDecoder = keys.reduceRight(
      (childDecoder, key) => field(key, childDecoder),
      decoder
    );
    return chainedDecoder(value);
  };
}

export function optional<T, U>(
  decoder: mixed => T,
  // This parameter is implicitly optional since `U` is allowed to be `void`
  // (undefined), but don’ mark it with a question mark `defaultValue?: U`
  // because that causes `name: optional(string)` in the `User` test in
  // `flow/user.js` to match `match: string`!
  defaultValue: U
): mixed => T | U {
  return function optionalDecoder(value: mixed): T | U {
    if (value == null) {
      return defaultValue;
    }
    try {
      return decoder(value);
    } catch (error) {
      error.message = `(optional) ${error.message}`;
      throw error;
    }
  };
}

export function map<T, U>(decoder: mixed => T, fn: T => U): mixed => U {
  return function mapDecoder(value: mixed): U {
    return fn(decoder(value));
  };
}

export function andThen<T, U>(
  decoder: mixed => T,
  fn: T => mixed => U
): mixed => U {
  return function andThenDecoder(value: mixed): U {
    // Run `value` through `decoder`, pass the result of that to `fn` and then
    // run `value` through the return value of `fn`.
    return fn(decoder(value))(value);
  };
}

export function fieldAndThen<T, U>(
  key: string | number,
  decoder: mixed => T,
  fn: T => mixed => U
): mixed => U {
  return function fieldAndThenDecoder(value: mixed): U {
    const keyValue = field(key, decoder)(value);
    let finalDecoder = undefined;
    try {
      finalDecoder = fn(keyValue);
    } catch (error) {
      throw new TypeError(keyErrorMessage(key, value, error.message));
    }
    return finalDecoder(value);
  };
}

const eitherPrefix = "Several decoders failed:\n";

export function either<T, U>(
  decoder1: mixed => T,
  decoder2: mixed => U
): mixed => T | U {
  return function eitherDecoder(value: mixed): T | U {
    try {
      return decoder1(value);
    } catch (error1) {
      try {
        return decoder2(value);
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

export function lazy<T>(fn: () => mixed => T): mixed => T {
  return function lazyDecoder(value: mixed): T {
    return fn()(value);
  };
}

function stripPrefix(prefix: string, str: string): string {
  return str.slice(0, prefix.length) === prefix
    ? str.slice(prefix.length)
    : str;
}

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
      return truncate(String(value));
    }

    if (type === "string") {
      return printString(value);
    }

    if (type === "function") {
      return `function ${printString(value.name)}`;
    }

    if (Array.isArray(value)) {
      const arr: Array<mixed> = value;
      if (!recurse) {
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
      const obj: { [string]: mixed } = value;
      const keys = Object.keys(obj);

      // `class Foo {}` has `toStringType === "Object"` and `rawName === "Foo"`.
      const { name } = obj.constructor;

      if (!recurse) {
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
  // could be calculated from them, but I've hardcoded them to save some bytes.
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
    `\nat ${at}${missing} in ${repr(value, { key })}`,
  ].join("");
}
