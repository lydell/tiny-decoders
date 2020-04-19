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
  number,
  optional,
  pair,
  string,
  triple,
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
fields(() => "")(undefined);
// $ExpectType { a: string; }
fields((field) => ({ a: field("a", string) }))(undefined);
// $ExpectType string[]
fields((field) => [field(0, string)])(undefined);
// $ExpectType [string]
fields<[string]>((field) => [field(0, string)])(undefined);
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
// $ExpectType string | number | boolean
either(either(boolean, string), either(number, constant(true)))(undefined);
// $ExpectType string
lazy(() => string)(undefined);

// $ExpectError
boolean(undefined, []);
// $ExpectError
number(undefined, []);
// $ExpectError
string(undefined, []);
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
fields({
  // $ExpectError
  a: string,
});
fields((field) => field("", string));
fields((field) => field("", string, "throw"));
fields((field) => field("", string, { default: "" }));
fields((field) => field("", string, { default: null }));
fields((field) => field(0, string));
// Wrong key type:
// $ExpectError
fields((field) => field(null, string));
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
fields((field, fieldError) => fieldError(0, "message"));
// Forgot key:
// $ExpectError
fields((field, fieldError) => fieldError("message"));
// Wrong key type:
// $ExpectError
fields((field, fieldError) => fieldError(true, "message"));
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
