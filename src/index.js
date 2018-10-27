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

export function constant<T>(constantValue: T): mixed => T {
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

type ExtractReturnValue = <T, U>((mixed) => T | U) => T | U;

export function group<T: {}>(
  mapping: T
): mixed => $ObjMap<T, ExtractReturnValue> {
  return function groupDecoder(value: mixed): $ObjMap<T, ExtractReturnValue> {
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
): mixed => $ObjMap<T, ExtractReturnValue> {
  return function recordDecoder(value: mixed): $ObjMap<T, ExtractReturnValue> {
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
  defaultValue?: U
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
      ? `${str} (extra props: ${repr(obj2, { key, printExtraProps: false })})`
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
      // If the string could be mistaken for a number, prefix it with "(string)"
      // to make it entirely clear that it is in fact a string.
      return !isNaN(Number(value)) || value === "NaN"
        ? `(string) ${JSON.stringify(value)}`
        : truncate(JSON.stringify(value));
    }

    // $FlowIgnore: Flow doesn't know about Symbols yet.
    if (typeof value === "symbol") {
      return value.description == null
        ? type
        : `${type}(${truncate(JSON.stringify(value.description))})`;
    }

    if (typeof value === "function") {
      return extraProps(`function ${truncate(JSON.stringify(value.name))}`);
    }

    if (type === "RegExp") {
      return extraProps(truncate(String(value)));
    }

    // Don't use `value instanceof Date` to support cross-iframe values.
    if (type === "Date") {
      const printed =
        typeof value.toISOString === "function"
          ? value.toISOString()
          : String(value);
      return extraProps(`${type}(${printed})`);
    }

    if (type === "Error" && typeof value.message === "string") {
      const name = typeof value.name === "string" ? value.name : type;
      return extraProps(`${name}(${truncate(JSON.stringify(value.message))})`);
    }

    if (
      typeof value === "object" &&
      (type === "Boolean" || type === "Number" || type === "String")
    ) {
      const printed =
        type === "String" ? truncate(JSON.stringify(value)) : String(value);
      return `new ${type}(${printed})`;
    }

    if (Array.isArray(value) && recurse) {
      const lastIndex = value.length - 1;
      const items = [];
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

      if (!recurse) {
        return `${type}(${keys.length})`;
      }

      const newKeys =
        typeof key === "string" && keys.indexOf(key) >= 0
          ? [key, ...keys.filter(key2 => key2 !== key)]
          : keys;

      const numHidden = Math.max(0, newKeys.length - maxObjectChildren);

      const items = newKeys
        .slice(0, maxObjectChildren)
        .map(
          key2 =>
            `${truncate(JSON.stringify(key2))}: ${repr(value[key2], {
              recurse: false,
              printExtraProps: false,
            })}`
        )
        .concat(numHidden > 0 ? `(${numHidden} more)` : []);

      return `{${items.join(", ")}}`;
    }

    const length =
      typeof value.length === "number"
        ? value.length
        : typeof value.size === "number"
          ? value.size
          : undefined;

    return extraProps(length == null ? type : `${type}(${length})`);
  } catch (_error) {
    return type;
  }
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
    : [
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
  const at = typeof key === "string" ? JSON.stringify(key) : String(key);
  const missing =
    typeof key !== "string" || value == null || typeof value !== "object"
      ? ""
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
