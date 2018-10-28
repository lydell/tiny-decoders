import {
  boolean,
  either,
  field,
  group,
  number,
  optional,
  record,
  string,
} from "tiny-decoders";

interface User {
  name: string;
  age: number;
  active: boolean;
  id: string | number;
}

const verifyUser = (decoder: (value: unknown) => User): User =>
  decoder(undefined);

const userDecoder: (value: unknown) => User = record({
  name: string,
  age: number,
  active: boolean,
  id: either(string, number),
});

verifyUser(userDecoder);

const userDecoder2: (value: unknown) => User = group({
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

// Missing "name":
verifyUser(
  // $ExpectError
  record({
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  group({
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

// Missing "name" and "id":
verifyUser(
  // $ExpectError
  record({
    age: number,
    active: boolean,
  })
);
verifyUser(
  // $ExpectError
  group({
    age: field("age", number),
    active: field("active", boolean),
  })
);

// All fields missing:
// $ExpectError
verifyUser(record({}));
// $ExpectError
verifyUser(group({}));

// Extra field:
// TODO: Can this be made an error, just like in Flow?
verifyUser(
  record({
    extra: string,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  group({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

// Extra fields:
// TODO: Can this be made an error, just like in Flow?
verifyUser(
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
  group({
    extra: field("extra", string),
    extra2: field("extra2", () => undefined),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

// Misspelled field ("naem" instead of "name"):
verifyUser(
  // $ExpectError
  record({
    naem: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  group({
    naem: field("naem", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

// Wrong type for "name":
verifyUser(
  // $ExpectError
  record({
    name: number,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  group({
    name: field("name", number),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);

// "name" isn’t optional:
verifyUser(
  // $ExpectError
  record({
    name: optional(string),
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  group({
    name: field("name", optional(string)),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  })
);
