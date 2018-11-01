// @flow strict

import {
  andThen,
  array,
  boolean,
  constant,
  dict,
  either,
  field,
  fieldAndThen,
  fieldDeep,
  group,
  lazy,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  record,
  string,
} from "../src";

/* eslint-disable no-unused-expressions */
// $ExpectError
(boolean(undefined): string);
// $ExpectError
(number(undefined): boolean);
// $ExpectError
(string(undefined): boolean);
// $ExpectError
(mixedArray(undefined): boolean);
// $ExpectError
(mixedDict(undefined): boolean);
// $ExpectError
(constant("const")(undefined): boolean);
// $ExpectError
(array(string)(undefined): boolean);
// $ExpectError
(array(string)(undefined): Array<boolean>);
// $ExpectError
(dict(string)(undefined): boolean);
// $ExpectError
(dict(string)(undefined): { [string]: boolean });
// $ExpectError
(group({})(undefined): boolean);
// $ExpectError
(group({ a: string })(undefined): {| a: boolean |});
// $ExpectError
(record({})(undefined): boolean);
// $ExpectError
(record({ a: string })(undefined): {| a: boolean |});
// $ExpectError
(field("", string)(undefined): boolean);
// $ExpectError
(field(0, string)(undefined): boolean);
// $ExpectError
(fieldDeep([], string)(undefined): boolean);
// $ExpectError
(optional(string)(undefined): boolean);
// $ExpectError
(optional(string)(undefined): string);
// $ExpectError
(map(string, string)(undefined): boolean);
// $ExpectError
(andThen(string, () => string)(undefined): boolean);
// $ExpectError
(fieldAndThen("", string, () => string)(undefined): boolean);
// $ExpectError
(fieldAndThen(0, string, () => string)(undefined): boolean);
// $ExpectError
(either(string, number)(undefined): boolean);
// $ExpectError
(either(either(boolean, string), either(number, mixedDict))(
  undefined
): boolean);
// $ExpectError
(lazy(() => string)(undefined): boolean);
/* eslint-enable no-unused-expressions */

constant(undefined);
constant(null);
constant(true);
constant(false);
constant(0);
constant("");
// Arrays can’t be compared easily:
// $ExpectError
constant([]);
// Objects can’t be compared easily:
// $ExpectError
constant({ type: "user" });
// Accidentally passed a decoder:
// $ExpectError
constant(string);

field("", string);
field(0, string);
// Wrong key type:
// $ExpectError
field(null, string);
// Wrong order:
// $ExpectError
field(string, "");
// Wrong order:
// $ExpectError
field(string, 0);
// Missing key:
// $ExpectError
field(string);

fieldDeep([], string);
fieldDeep([""], string);
fieldDeep([0], string);
// Wrong key type:
// $ExpectError
fieldDeep([null], string);
// Wrong order:
// $ExpectError
fieldDeep(string, []);
// Missing key:
// $ExpectError
fieldDeep(string);

fieldAndThen("", string, () => string);
fieldAndThen(0, string, () => string);
// Wrong key type:
// $ExpectError
fieldAndThen(null, string, () => string);
// Wrong order:
// $ExpectError
fieldAndThen(string, "", () => string);
// Wrong order:
// $ExpectError
fieldAndThen(string, 0, () => string);
// Missing key:
// $ExpectError
fieldAndThen(string, () => string);
// Decoder instead of `mixed => decoder`:
// $ExpectError
fieldAndThen("", string, string);

andThen(string, () => string);
// Decoder instead of `mixed => decoder`:
// $ExpectError
andThen(string, string);

// Decoder instead of `() => decoder`:
// $ExpectError
lazy(string);
