// @flow strict
// This file isn’t run by Jest. It’s here to verify that the typechecking works
// and Flow does find errors. Turn off “ExpectError” in .flowconfig to see what
// the errors look like.

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
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  record,
  string,
} from "../src";

type User = {|
  name: string,
  age: number,
  active: boolean,
  id: string | number,
|};

const verifyUser = (decoder: mixed => User): User => decoder();

const userDecoder: mixed => User = record({
  name: string,
  age: number,
  active: boolean,
  id: either(string, number),
});

verifyUser(userDecoder);

const userDecoder2: mixed => User = group({
  name: field("name", string),
  age: field("age", number),
  active: field("active", boolean),
  id: field("id", either(string, number)),
});

verifyUser(userDecoder2);

// `id: string` also satisfies `string | number`.
verifyUser(
  record({
    id: string,
    name: string,
    age: number,
    active: boolean,
  })
);
verifyUser(
  group({
    id: field("id", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
  })
);

verifyUser(
  // $ExpectError: missing "name"
  record({
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError: missing "name"
  group({
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

verifyUser(
  // $ExpectError: missing "name" and "id"
  record({
    age: number,
    active: boolean,
  })
);
verifyUser(
  // $ExpectError: missing "name" and "id"
  group({
    age: field("age", number),
    active: field("active", boolean),
  })
);

// $ExpectError: all fields missing
verifyUser(record({}));
// $ExpectError: all fields missing
verifyUser(group({}));

verifyUser(
  // $ExpectError: extra field
  record({
    extra: string,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError: extra field
  group({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

verifyUser(
  // $ExpectError: extra fields
  record({
    extra: string,
    extra2: () => undefined,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError: extra fields
  group({
    extra: field("extra", string),
    extra2: field("extra2", () => undefined),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

verifyUser(
  // $ExpectError: misspelled field
  record({
    naem: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError: misspelled field
  group({
    naem: field("naem", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

verifyUser(
  // $ExpectError: wrong type for "name"
  record({
    name: number,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  group({
    // $ExpectError: wrong type for "name"
    name: field("name", number),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

verifyUser(
  // $ExpectError: wrong type for "name"
  record({
    name: optional(string),
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  group({
    // $ExpectError: wrong type for "name"
    name: field("name", optional(string)),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

type Camel = {|
  firstName: string,
  age: number,
|};

const verifyCamel = (decoder: mixed => Camel): Camel => decoder();

// Successful rename
verifyCamel(
  map(
    record({
      first_name: string,
      age: number,
    }),
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

verifyCamel(
  // $ExpectError: Didn’t remove "first_name"
  map(
    record({
      first_name: string,
      age: number,
    }),
    ({ ...props }) => ({ ...props, firstName: props.first_name })
  )
);

verifyCamel(
  // $ExpectError: misspelled "first_name"
  map(
    // $ExpectError: misspelled "first_name"
    record({
      first_name: string,
      age: number,
    }),
    ({ fist_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

verifyCamel(
  map(
    record({
      first_name: string,
      age: number,
    }),
    // $ExpectError: misspelled "firstName"
    ({ first_name: fistName, ...rest }) => ({ fistName, ...rest })
  )
);

verifyCamel(
  map(
    record({
      first_name: string,
      ago: number,
    }),
    // $ExpectError: misspelled "ago"
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

// Successful rename
verifyCamel(
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

verifyCamel(
  // $ExpectError: forgot to spread
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    // $ExpectError: forgot to spread
    ({ rest, renamed }) => ({ renamed, rest })
  )
);

// TODO and WARNING: "firstName" is misspelled as "fistName" but Flow doesn’t
// catch it! Not sure if this is a bug in tiny-decoders or Flow.
verifyCamel(
  map(
    group({
      fistName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

// TODO and WARNING: "age" is misspelled as "ago" but Flow doesn’t catch it! Not
// sure if this is a bug in tiny-decoders or Flow.
verifyCamel(
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        ago: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

constant(undefined);
constant(null);
constant(true);
constant(false);
constant(0);
constant("");
// $ExpectError: arrays can’t be compared easily
constant([]);
// $ExpectError: objects can’t be compared easily
constant({ type: "user" });
// $ExpectError: accidentally passed a decoder
constant(string);

field("", string);
field(0, string);
// $ExpectError: wrong key type
field(null, string);
// $ExpectError: wrong order
field(string, "");
// $ExpectError: wrong order
field(string, 0);
// $ExpectError: missing key
field(string);

fieldDeep([], string);
fieldDeep([""], string);
fieldDeep([0], string);
// $ExpectError: wrong key type
fieldDeep([null], string);
// $ExpectError: wrong order
fieldDeep(string, []);
// $ExpectError: missing key
fieldDeep(string);

fieldAndThen("", string, () => string);
fieldAndThen(0, string, () => string);
// $ExpectError: wrong key type
fieldAndThen(null, string, () => string);
// $ExpectError: wrong order
fieldAndThen(string, "", () => string);
// $ExpectError: wrong order
fieldAndThen(string, 0, () => string);
// $ExpectError: missing key
fieldAndThen(string, () => string);
// $ExpectError: decoder instead of `mixed => decoder`
fieldAndThen("", string, string);

andThen(string, () => string);
// $ExpectError: decoder instead of `mixed => decoder`
andThen(string, string);

/* eslint-disable no-unused-expressions */
// $ExpectError
(boolean(): string);
// $ExpectError
(number(): boolean);
// $ExpectError
(string(): boolean);
// $ExpectError
(mixedArray(): boolean);
// $ExpectError
(mixedDict(): boolean);
// $ExpectError
(constant("const")(): boolean);
// $ExpectError
(array(string)(): boolean);
// $ExpectError
(array(string)(): Array<boolean>);
// $ExpectError
(dict(string)(): boolean);
// $ExpectError
(dict(string)(): { [string]: boolean });
// $ExpectError
(group({})(): boolean);
// $ExpectError
(group({ a: string })(): {| a: boolean |});
// $ExpectError
(record({})(): boolean);
// $ExpectError
(record({ a: string })(): {| a: boolean |});
// $ExpectError
(field("", string)(): boolean);
// $ExpectError
(field(0, string)(): boolean);
// $ExpectError
(fieldDeep([], string)(): boolean);
// $ExpectError
(optional(string)(): boolean);
// $ExpectError
(optional(string)(): string);
// $ExpectError
(map(string, string)(): boolean);
// $ExpectError
(andThen(string, () => string)(): boolean);
// $ExpectError
(fieldAndThen("", string, () => string)(): boolean);
// $ExpectError
(fieldAndThen(0, string, () => string)(): boolean);
// $ExpectError
(either(string, number)(): boolean);
// $ExpectError
(either(either(boolean, string), either(number, mixedDict))(): boolean);
/* eslint-enable no-unused-expressions */
