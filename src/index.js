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

function stripPrefix(prefix: string, str: string): string {
  return str.slice(0, prefix.length) === prefix
    ? str.slice(prefix.length)
    : str;
}

export function repr(
  value: mixed,
  {
    key,
    recurse = true,
    printExtraProps = true,
    maxArrayChildren = 5,
    maxObjectChildren = 3,
  }: {|
    key?: string | number,
    recurse?: boolean,
    printExtraProps?: boolean,
    maxArrayChildren?: number,
    maxObjectChildren?: number,
  |} = {}
): string {
  function extraProps(str: string): string {
    const obj: ?{ [string]: mixed } =
      printExtraProps &&
      ((typeof value === "object" && value != null) ||
        typeof value === "function")
        ? value
        : undefined;

    if (obj == null) {
      return str;
    }

    const keys = Object.keys(obj);

    const filteredKeys =
      // Don't print the indexes of arrays, typed arrays and array-like objects.
      typeof obj.length === "number"
        ? keys.filter(key2 => !/^\d+$/.test(key2))
        : keys;

    // Use a for-loop instead of `.reduce` so Flow understands that `obj` is an
    // object, not `mixed`.
    const obj2 = {};
    for (let index = 0; index < filteredKeys.length; index++) {
      const key2 = filteredKeys[index];
      obj2[key2] = obj[key2];
    }

    return filteredKeys.length > 0
      ? `${str} (properties: ${repr(obj2, { key, printExtraProps: false })})`
      : str;
  }

  const type = Object.prototype.toString
    .call(value)
    .replace(/^\[object\s+(.+)\]$/, "$1");

  try {
    if (
      value === undefined ||
      value === null ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    if (typeof value === "string") {
      return printString(value);
    }

    // $FlowIgnore: Flow doesn't know about Symbols yet.
    if (typeof value === "symbol") {
      // This could use `Symbol.prototype.description` when it has gained better
      // support.
      const description = String(value).replace(/^Symbol\(|\)$/g, "");
      return `${type}(${printString(description)})`;
    }

    if (typeof value === "function") {
      return extraProps(`function ${printString(value.name)}`);
    }

    if (type === "RegExp") {
      return extraProps(truncate(String(value)));
    }

    if (Array.isArray(value)) {
      if (!recurse) {
        return `${type}(${value.length})`;
      }

      const lastIndex = value.length - 1;
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
          index in value
            ? repr(value[index], { recurse: false, printExtraProps: false })
            : "<empty>";
        items.push(index === key ? `(index ${index}) ${item}` : item);
      }

      if (end < lastIndex) {
        items.push(`(${lastIndex - end} more)`);
      }

      return extraProps(`[${items.join(", ")}]`);
    }

    if (
      type === "Object" &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const keys = Object.keys(value);

      // `class Foo {}` has `type === "Object"` and `rawName === "Foo"`.
      const { name } = value.constructor;

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
          key2 =>
            `${printString(key2)}: ${repr(value[key2], {
              recurse: false,
              printExtraProps: false,
            })}`
        )
        .concat(numHidden > 0 ? `(${numHidden} more)` : []);

      const prefix = name === "Object" ? "" : `${name} `;
      return `${prefix}{${items.join(", ")}}`;
    }

    return extraProps(type);
  } catch (_error) {
    return type;
  }
}

function printString(str: string): string {
  return truncate(JSON.stringify(str));
}

function truncate(
  str: string,
  {
    maxLength = 20,
    separator = "…",
  }: {| maxLength?: number, separator?: string |} = {}
): string {
  return str.length <= maxLength
    ? str
    : // If the string is too long, show a bit at the start and a bit at the end
      // and cut out the middle (replacing it with a separator).
      [
        str.slice(0, Math.floor(maxLength / 2)),
        separator,
        str.slice(-(Math.ceil(maxLength / 2) - separator.length)),
      ].join("");
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
