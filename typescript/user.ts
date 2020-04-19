import {
  autoRecord,
  boolean,
  either,
  fields,
  number,
  optional,
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

const userDecoder: (value: unknown) => User = autoRecord({
  name: string,
  age: number,
  active: boolean,
  id: either(string, number),
});

verifyUser(userDecoder);

const userDecoder2: (value: unknown) => User = fields((field) => ({
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
verifyUser(fields((field) => ({})));

// Extra field:
// Unlike Flow, TypeScript does not have exact objects/interfaces.
// Instead, one can specify the wanted type instead of using inference.
// But unfortunately not for `fields` – unless you specify it as the callback
// return value.
verifyUser(
  autoRecord({
    extra: string,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  autoRecord<User>({
    // $ExpectError
    extra: string,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  fields((field) => ({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
verifyUser(
  fields<User>((field) => ({
    extra: field("extra", string),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
verifyUser(
  fields(
    (field): User => ({
      // $ExpectError
      extra: field("extra", string),
      name: field("name", string),
      age: field("age", number),
      active: field("active", boolean),
      id: field("id", either(string, number)),
    })
  )
);

// Extra fields:
verifyUser(
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
  autoRecord<User>({
    // $ExpectError
    extra: string,
    extra2: () => undefined,
    name: string,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
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
  autoRecord({
    name: number,
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    name: field("name", number),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);

// "name" isn’t optional:
verifyUser(
  // $ExpectError
  autoRecord({
    name: optional(string),
    age: number,
    active: boolean,
    id: either(string, number),
  })
);
verifyUser(
  // $ExpectError
  fields((field) => ({
    name: field("name", optional(string)),
    age: field("age", number),
    active: field("active", boolean),
    id: field("id", either(string, number)),
  }))
);
