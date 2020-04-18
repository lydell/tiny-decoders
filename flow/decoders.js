// @flow strict

import {
  array,
  autoRecord,
  boolean,
  constant,
  deep,
  dict,
  either,
  fields,
  lazy,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  pair,
  string,
  triple,
  tuple,
} from "../src";

function use(value: mixed) {
  // eslint-disable-next-line no-void
  return void value;
}

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
(fields(() => "")(undefined): boolean);
// $ExpectError
(fields((field) => ({ a: field("a", string) }))(undefined): { a: boolean });
// $ExpectError
(tuple(() => "")(undefined): boolean);
// $ExpectError
(tuple((item) => [item(0, string)])(undefined): [boolean]);
// $ExpectError
(pair(string, boolean)(undefined): [boolean, boolean]);
// $ExpectError
(triple(string, boolean, boolean)(undefined): [boolean, boolean, boolean]);
// $ExpectError
(autoRecord({})(undefined): boolean);
// $ExpectError
(autoRecord({ a: string })(undefined): { a: boolean });
// $ExpectError
(deep([], string)(undefined): boolean);
// $ExpectError
(optional(string)(undefined): boolean);
// $ExpectError
(optional(string)(undefined): string);
// $ExpectError
(map(string, string)(undefined): boolean);
// $ExpectError
(either(string, number)(undefined): boolean);
// $ExpectError
(either(
  either(boolean, string),
  either(number, mixedDict)
)(undefined): boolean);
// $ExpectError
(lazy(() => string)(undefined): boolean);
/* eslint-enable no-unused-expressions */

// $ExpectError
boolean(undefined, []);
// $ExpectError
number(undefined, []);
// $ExpectError
string(undefined, []);
// $ExpectError
mixedArray(undefined, []);
// $ExpectError
mixedDict(undefined, []);
// $ExpectError
constant("const")(undefined, []);
// $ExpectError
constant("const")(undefined, {});
array(string)(undefined, []);
// $ExpectError
array(string)(undefined, {});
dict(string)(undefined, []);
// $ExpectError
dict(string)(undefined, {});
fields(() => "")(undefined, []);
// $ExpectError
fields(() => "")(undefined, {});
tuple(() => "")(undefined, []);
// $ExpectError
tuple(() => "")(undefined, {});
pair(string, boolean)(undefined, []);
// $ExpectError
pair(string, boolean)(undefined, {});
triple(string, boolean, boolean)(undefined, []);
// $ExpectError
triple(string, boolean, boolean)(undefined, {});
autoRecord({})(undefined, []);
// $ExpectError
autoRecord({})(undefined, {});
deep([], string)(undefined, []);
// $ExpectError
deep({}, string)(undefined, []);
optional(string)(undefined, []);
// $ExpectError
optional(string)(undefined, {});
map(string, string)(undefined, []);
// $ExpectError
map(string, string)(undefined, {});
either(string, number)(undefined, []);
// $ExpectError
either(string, number)(undefined, {});
lazy(() => string)(undefined, []);
// $ExpectError
lazy(() => string)(undefined, {});

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

array(string);
array(string, "throw");
array(string, "skip");
array(string, { default: "" });
array(string, { default: [1] });
// Wrong mode:
// $ExpectError
array(string, "nope");

dict(string);
dict(string, "throw");
dict(string, "skip");
dict(string, { default: "" });
dict(string, { default: [1] });
// Wrong mode:
// $ExpectError
dict(string, "nope");

// Accidentally passed an object instead of a callback:
// $ExpectError
fields({
  a: string,
});
fields((field) => field("", string));
fields((field) => field("", string, "throw"));
fields((field) => field("", string, { default: "" }));
fields((field) => field("", string, { default: null }));
// Wrong key type:
// $ExpectError
fields((field) => field(0, string));
// Wrong order:
// $ExpectError
fields((field) => field(string, ""));
// Missing key:
// $ExpectError
fields((field) => field(string));
// Wrong mode:
// $ExpectError
fields((field) => field("", string, "skip"));
// Accidentally passed bare default:
// $ExpectError
fields((field) => field("", string, null));

fields((field, fieldError) => fieldError("key", "message"));
// Forgot key:
// $ExpectError
fields((field, fieldError) => fieldError("message"));
// Wrong key type:
// $ExpectError
fields((field, fieldError) => fieldError(0, "message"));
// Wrong message type:
// $ExpectError
fields((field, fieldError) => fieldError("key", new TypeError("message")));

fields((field, fieldError, obj, errors) => {
  use(obj.test);
  // Field values are mixed.
  // $ExpectError
  obj.test.toUpperCase();
  // errors can be null.
  // $ExpectError
  errors.slice();
  if (errors != null) {
    errors.slice();
  }
});

tuple((item) => item(0, string));
tuple((item) => item(0, string, "throw"));
tuple((item) => item(0, string, { default: "" }));
tuple((item) => item(0, string, { default: null }));
// Wrong key type:
// $ExpectError
tuple((item) => item("", string));
// Wrong order:
// $ExpectError
tuple((item) => item(string, 0));
// Missing key:
// $ExpectError
tuple((item) => item(string));
// Wrong mode:
// $ExpectError
tuple((item) => item(0, string, "skip"));
// Accidentally passed bare default:
// $ExpectError
tuple((item) => item(0, string, null));

tuple((item, itemError) => itemError(0, "message"));
// Forgot key:
// $ExpectError
tuple((item, itemError) => itemError("message"));
// Wrong key type:
// $ExpectError
tuple((item, itemError) => itemError("key", "message"));
// Wrong message type:
// $ExpectError
tuple((item, itemError) => itemError(0, new TypeError("message")));

tuple((item, itemError, arr, errors) => {
  arr.slice();
  // arr is an array, not an object.
  // $ExpectError
  use(arr.test);
  // errors can be null.
  // $ExpectError
  errors.slice();
  if (errors != null) {
    errors.slice();
  }
});

deep([], string);
deep([""], string);
deep([0], string);
// Wrong key type:
// $ExpectError
deep([null], string);
// Wrong order:
// $ExpectError
deep(string, []);
// Missing path:
// $ExpectError
deep(string);

// Decoder instead of `() => decoder`:
// $ExpectError
lazy(string);
