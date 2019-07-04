import {
  array,
  autoRecord,
  boolean,
  constant,
  deep,
  dict,
  either,
  lazy,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  pair,
  record,
  string,
  triple,
  tuple,
} from "tiny-decoders";

function use(value: unknown) {
  return void value;
}

// $ExpectType boolean
boolean(undefined);
// $ExpectType number
number(undefined);
// $ExpectType string
string(undefined);
// $ExpectType readonly unknown[]
mixedArray(undefined);
// $ExpectType { readonly [key: string]: unknown; }
mixedDict(undefined);
// $ExpectType true
constant(true)(undefined);
// $ExpectType false
constant(false)(undefined);
// $ExpectType 0
constant(0)(undefined);
// $ExpectType "const"
constant("const")(undefined);
// $ExpectType undefined
constant(undefined)(undefined);
// $ExpectType null
constant(null)(undefined);
// $ExpectType string[]
array(string)(undefined);
// $ExpectType { [key: string]: string; }
dict(string)(undefined);
// $ExpectType string
record(() => "")(undefined);
// $ExpectType { a: string; }
record(field => ({ a: field("a", string) }))(undefined);
// $ExpectType string
tuple(() => "")(undefined);
// $ExpectType string[]
tuple(item => [item(0, string)])(undefined);
// $ExpectType [string]
tuple<[string]>(item => [item(0, string)])(undefined);
// $ExpectType [string, boolean]
pair(string, boolean)(undefined);
// $ExpectType [string, boolean, boolean]
triple(string, boolean, boolean)(undefined);
// $ExpectType {}
autoRecord<{}>({})(undefined);
// $ExpectType { a: string; }
autoRecord({ a: string })(undefined);
// $ExpectType { a: string; b: number; }
autoRecord({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; }
autoRecord({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; c: boolean | undefined; }
autoRecord({ a: string, b: number, c: optional(boolean) })(undefined);
// $ExpectType string
deep([], string)(undefined);
// $ExpectType string | undefined
optional(string)(undefined);
// $ExpectType string
optional(string, "default")(undefined);
// $ExpectType string | null
optional(string, null)(undefined);
// $ExpectType string
map(string, string)(undefined);
// $ExpectType string | number
either(string, number)(undefined);
// $ExpectType string | number | boolean | { readonly [key: string]: unknown; }
either(either(boolean, string), either(number, mixedDict))(undefined);
// $ExpectType string
lazy(() => string)(undefined);

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
record(() => "")(undefined, []);
// $ExpectError
record(() => "")(undefined, {});
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
record({
  // $ExpectError
  a: string,
});
record(field => field("", string));
record(field => field("", string, "throw"));
record(field => field("", string, { default: "" }));
record(field => field("", string, { default: null }));
// Wrong key type:
// $ExpectError
record(field => field(0, string));
// Wrong order:
// $ExpectError
record(field => field(string, ""));
// Missing key:
// $ExpectError
record(field => field(string));
// Wrong mode:
// $ExpectError
record(field => field("", string, "skip"));
// Accidentally passed bare default:
// $ExpectError
record(field => field("", string, null));

record((field, fieldError) => fieldError("key", "message"));
// Forgot key:
// $ExpectError
record((field, fieldError) => fieldError("message"));
// Wrong key type:
// $ExpectError
record((field, fieldError) => fieldError(0, "message"));
// Wrong message type:
// $ExpectError
record((field, fieldError) => fieldError("key", new TypeError("message")));

record((field, fieldError, obj, errors) => {
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

tuple(item => item(0, string));
tuple(item => item(0, string, "throw"));
tuple(item => item(0, string, { default: "" }));
tuple(item => item(0, string, { default: null }));
// Wrong key type:
// $ExpectError
tuple(item => item("", string));
// Wrong order:
// $ExpectError
tuple(item => item(string, 0));
// Missing key:
// $ExpectError
tuple(item => item(string));
// Wrong mode:
// $ExpectError
tuple(item => item(0, string, "skip"));
// Accidentally passed bare default:
// $ExpectError
tuple(item => item(0, string, null));

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
