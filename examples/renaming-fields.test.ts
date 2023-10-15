import { expect, test } from "vitest";

import { boolean, Codec, field, fields, number, string } from "../";

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

  // If you want to rename some fields, use the `field` function.
  const userCamelCaseCodec: Codec<UserCamelCase> = fields({
    firstName: field(string, { renameFrom: "first_name" }),
    lastName: field(string, { renameFrom: "last_name" }),
    age: number,
    active: boolean,
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
