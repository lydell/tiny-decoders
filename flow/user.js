// @flow strict

import {
  type Decoder,
  autoRecord,
  boolean,
  either,
  fields,
  number,
  optional,
  string,
} from "../src";

type User = {
  name: string,
  age: number,
  active: boolean,
  id: string | number,
};

const verifyUser = (decoder: Decoder<User>): User => decoder(undefined);

const userDecoder: Decoder<User> = autoRecord({
  name: string,
  age: number,
  active: boolean,
  id: either(string, number),
});

verifyUser(userDecoder);

const userDecoder2: Decoder<User> = fields((field) => ({
  name: field("name", string),
  age: field("age", number),
  active: field("active", boolean),
  id: field("id", either(string, number)),
}));

verifyUser(userDecoder2);

// `id: string` also satisfies `string | number`.
verifyUser(
  autoRecord({
    id: string,
    name: string,
    age: number,
    active: boolean,
  })
);
verifyUser(
  fields((field) => ({
    id: field("id", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
  }))
);

// Missing "name":
verifyUser(
  // $ExpectError
  autoRecord({
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// Missing "name" and "id":
verifyUser(
  // $ExpectError
  autoRecord({
    age: number,
    active: boolean,
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    age: field("age", number),
    active: field("active", boolean),
  }))
);

// All fields missing:
// $ExpectError
verifyUser(autoRecord({}));
// $ExpectError
verifyUser(fields(() => ({})));

// Extra field:
verifyUser(
  // $ExpectError
  autoRecord({
    extra: string,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
verifyUser(
  // $ExpectError
  fields<User>((field) => ({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
verifyUser(
  // $ExpectError
  fields((field): User => ({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// Extra fields:
verifyUser(
  // $ExpectError
  autoRecord({
    extra: string,
    extra2: () => undefined,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    extra: field("extra", string),
    extra2: field("extra2", () => undefined),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
verifyUser(
  // $ExpectError
  fields<User>((field) => ({
    extra: field("extra", string),
    extra2: field("extra2", () => undefined),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// Misspelled field ("naem" instead of "name"):
verifyUser(
  // $ExpectError
  autoRecord({
    naem: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    naem: field("naem", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// Wrong type for "name":
verifyUser(
  // $ExpectError
  fields({
    name: number,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  fields((field) => ({
    // $ExpectError
    name: field("name", number),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// "name" isn’t optional:
verifyUser(
  // $ExpectError
  fields({
    name: optional(string),
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  fields((field) => ({
    // $ExpectError
    name: field("name", optional(string)),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
