import {
  boolean,
  number,
  string,
  mixedArray,
  mixedDict,
  constant,
  array,
  dict,
  group,
  record,
  field,
  fieldDeep,
  optional,
  map,
  andThen,
  fieldAndThen,
  either,
  repr,
} from "tiny-decoders";

// $ExpectType boolean
boolean(undefined);
// $ExpectType number
number(undefined);
// $ExpectType string
string(undefined);
// $ExpectType unknown[]
mixedArray(undefined);
// $ExpectType { [key: string]: unknown; }
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
// $ExpectType {}
group({})(undefined);
// $ExpectType { a: string; }
group({ a: string })(undefined);
// $ExpectType { a: string; b: number; }
group({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; }
group({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; c: boolean | undefined; }
group({ a: string, b: number, c: optional(boolean) })(undefined);
// $ExpectType {}
record({})(undefined);
// $ExpectType { a: string; }
record({ a: string })(undefined);
// $ExpectType { a: string; b: number; }
record({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; }
record({ a: string, b: number })(undefined);
// $ExpectType { a: string; b: number; c: boolean | undefined; }
record({ a: string, b: number, c: optional(boolean) })(undefined);
// $ExpectType string
field("", string)(undefined);
// $ExpectType string
field(0, string)(undefined);
// $ExpectType string
fieldDeep([], string)(undefined);
// $ExpectType string | undefined
optional(string)(undefined);
// $ExpectType string
optional(string, "default")(undefined);
// $ExpectType string | null
optional(string, null)(undefined);
// $ExpectType string
map(string, string)(undefined);
// $ExpectType string
andThen(string, () => string)(undefined);
// $ExpectType string
fieldAndThen("", string, () => string)(undefined);
// $ExpectType string
fieldAndThen(0, string, () => string)(undefined);
// $ExpectType string | number
either(string, number)(undefined);
// $ExpectType string | number | boolean | { [key: string]: unknown; }
either(either(boolean, string), either(number, mixedDict))(undefined);

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
