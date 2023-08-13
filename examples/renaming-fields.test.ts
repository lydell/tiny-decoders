import { expect, test } from "vitest";

import { boolean, Codec, fields, named, number, string } from "../";

test("renaming fields", () => {
  type UserSnakeCase = {
    first_name: string;
    last_name: string;
    age: number;
    active: boolean;
  };

  // It’s convenient  if the object you are decoding and your internal type have
  // the same key names.
  const userSnakeCaseCodec: Codec<UserSnakeCase> = fields({
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  });

  const user: unknown = {
    first_name: "John",
    last_name: "Doe",
    age: 30,
    active: true,
  };
  expect(userSnakeCaseCodec.decoder(user)).toMatchInlineSnapshot(`
    {
      "active": true,
      "age": 30,
      "first_name": "John",
      "last_name": "Doe",
    }
  `);

  type UserCamelCase = {
    firstName: string;
    lastName: string;
    age: number;
    active: boolean;
  };

  // If you want to rename some fields, use the `named` function. This means having to
  // duplicate some field names, but it’s not so bad.
  const userCamelCaseCodec: Codec<UserCamelCase> = fields({
    firstName: named("first_name", string),
    lastName: named("last_name", string),
    age: named("age", number),
    active: named("active", boolean),
  });

  const expected: UserCamelCase = {
    active: true,
    age: 30,
    firstName: "John",
    lastName: "Doe",
  };

  expect(userCamelCaseCodec.decoder(user)).toStrictEqual(expected);
  expect(userCamelCaseCodec.encoder(expected)).toStrictEqual(user);
});
