import {
  array,
  boolean,
  Decoder,
  DecoderError,
  fields,
  fieldsAuto,
  number,
  optional,
  repr,
  ReprOptions,
  string,
} from "..";

function run<T>(
  decoder: Decoder<T>,
  value: unknown,
  options?: ReprOptions
): T | string {
  try {
    return decoder(value);
  } catch (error) {
    return error instanceof DecoderError
      ? error.format(options)
      : error instanceof Error
      ? error.message
      : `Unknown error: ${repr(error)}`;
  }
}

expect.addSnapshotSerializer({
  test: (value: unknown): boolean => typeof value === "string",
  print: String,
});

test("the main readme example", () => {
  type User = {
    name: string;
    active: boolean;
    age?: number;
    interests: Array<string>;
  };

  const userDecoder = fields(
    (field): User => ({
      name: field("full_name", string),
      active: field("is_active", boolean),
      age: field("age", optional(number)),
      interests: field("interests", array(string)),
    })
  );

  const payload: unknown = getSomeJSON();

  const user: User = userDecoder(payload);

  expect(user).toStrictEqual({
    name: "John Doe",
    active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
  });

  const payload2: unknown = getSomeInvalidJSON();

  expect(run(userDecoder, payload2)).toMatchInlineSnapshot(`
    At root["age"] (optional):
    Expected a number
    Got: "30"
  `);
});

test("the main readme example – variant", () => {
  const userDecoder = fieldsAuto({
    full_name: string,
    is_active: boolean,
    age: optional(number),
    interests: array(string),
  });

  type User = ReturnType<typeof userDecoder>;

  const payload: unknown = getSomeJSON();

  const user: User = userDecoder(payload);

  expect(user).toStrictEqual({
    full_name: "John Doe",
    is_active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
  });

  const payload2: unknown = getSomeInvalidJSON();

  expect(run(userDecoder, payload2)).toMatchInlineSnapshot(`
    At root["age"] (optional):
    Expected a number
    Got: "30"
  `);
});

function getSomeJSON(): unknown {
  return {
    full_name: "John Doe",
    is_active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
  };
}

function getSomeInvalidJSON(): unknown {
  return {
    full_name: "John Doe",
    is_active: true,
    age: "30",
    interests: [],
  };
}

test("default vs sensitive error messages", () => {
  const userDecoder = fieldsAuto({
    name: string,
    details: fieldsAuto({
      email: string,
      ssn: string,
    }),
  });

  const data: unknown = {
    name: "John Doe",
    details: {
      email: "john.doe@example.com",
      ssn: 123456789,
    },
  };

  let message = "Expected userDecoder to fail!";
  try {
    userDecoder(data);
  } catch (error) {
    message =
      error instanceof Error ? error.message : `Unknown error: ${repr(error)}`;
  }

  expect(message).toMatchInlineSnapshot(`
    Expected a string
    Got: number
    (Actual values are hidden in sensitive mode.)

    For better error messages, see https://github.com/lydell/tiny-decoders#error-messages
  `);

  expect(run(userDecoder, data)).toMatchInlineSnapshot(`
    At root["details"]["ssn"]:
    Expected a string
    Got: 123456789
  `);

  expect(run(userDecoder, data, { sensitive: true })).toMatchInlineSnapshot(`
    At root["details"]["ssn"]:
    Expected a string
    Got: number
    (Actual values are hidden in sensitive mode.)
  `);
});

test("fields", () => {
  type User = {
    age: number;
    active: boolean;
    name: string;
    description?: string;
    version: 1;
  };

  const userDecoder = fields(
    (field): User => ({
      // Simple field:
      age: field("age", number),
      // Renaming a field:
      active: field("is_active", boolean),
      // Combining two fields:
      name: `${field("first_name", string)} ${field("last_name", string)}`,
      // Optional field:
      description: field("description", optional(string)),
      // Hardcoded field:
      version: 1,
    })
  );

  expect(
    userDecoder({
      age: 30,
      is_active: true,
      first_name: "John",
      last_name: "Doe",
    })
  ).toStrictEqual({
    active: true,
    age: 30,
    description: undefined,
    name: "John Doe",
    version: 1,
  });

  // Plucking a single field out of an object:
  const ageDecoder: Decoder<number> = fields((field) => field("age", number));

  expect(ageDecoder({ age: 30 })).toBe(30);
});

test("type annotations", () => {
  type Person = {
    name: string;
    age?: number;
  };

  // Annotate the return type of the callback.
  const personDecoder = fields(
    (field): Person => ({
      name: field("name", string),
      age: field("age", optional(number)),
    })
  );

  // Annotate the generic.
  const personDecoderAuto = fieldsAuto<Person>({
    name: string,
    age: optional(number),
  });

  const data: unknown = { name: "John" };
  expect(personDecoder(data)).toStrictEqual(personDecoderAuto(data));
});
