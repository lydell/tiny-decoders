/* eslint-disable @typescript-eslint/no-shadow */ // TODO: Remove this line when removing the `fields` function.
import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  array,
  boolean,
  Decoder,
  DecoderError,
  field,
  fields,
  fieldsAuto,
  number,
  repr,
  ReprOptions,
  string,
  undefinedOr,
} from "..";

function run<T>(
  decoder: Decoder<T>,
  value: unknown,
  options?: ReprOptions,
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

  const userDecoder: Decoder<User> = fieldsAuto({
    name: string,
    active: field(boolean, { renameFrom: "is_active" }),
    age: field(number, { optional: true }),
    interests: array(string),
  });

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
    At root["age"]:
    Expected a number
    Got: "30"
  `);
});

function getSomeJSON(): unknown {
  return {
    name: "John Doe",
    is_active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
  };
}

function getSomeInvalidJSON(): unknown {
  return {
    name: "John Doe",
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
    description?: string | undefined;
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
      description: field("description", undefinedOr(string)),
      // Hardcoded field:
      version: 1,
    }),
  );

  expect(
    userDecoder({
      age: 30,
      is_active: true,
      first_name: "John",
      last_name: "Doe",
    }),
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

test("fieldsAuto", () => {
  const exampleDecoder = fieldsAuto({
    name: field(string, { optional: true }),
  });

  type Example = { name?: string };

  expectType<TypeEqual<ReturnType<typeof exampleDecoder>, Example>>(true);

  const exampleDecoder2 = fieldsAuto({
    name: field(undefinedOr(string), { optional: true }),
  });

  expect(exampleDecoder({})).toStrictEqual({});
  expect(exampleDecoder({ name: "some string" })).toStrictEqual({
    name: "some string",
  });

  type Example2 = { name?: string | undefined };

  expectType<TypeEqual<ReturnType<typeof exampleDecoder2>, Example2>>(true);

  expect(exampleDecoder2({ name: undefined })).toStrictEqual({
    name: undefined,
  });
});
