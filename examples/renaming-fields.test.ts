import { expect, test } from "vitest";

import {
  boolean,
  chain,
  Decoder,
  fields,
  fieldsAuto,
  number,
  string,
} from "../";

test("renaming fields", () => {
  type UserSnakeCase = {
    first_name: string;
    last_name: string;
    age: number;
    active: boolean;
  };

  // Making decoders with `fieldsAuto` is convenient if the object you are
  // decoding and your internal type have the same key names.
  const userSnakeCaseDecoder = fieldsAuto<UserSnakeCase>({
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
  expect(userSnakeCaseDecoder(user)).toMatchInlineSnapshot(`
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

  // If you want to rename some fields, switch to `fields`. This means having to
  // duplicate some field names, but it’s not so bad.
  const userCamelCaseDecoder1 = fields(
    (field): UserCamelCase => ({
      firstName: field("first_name", string),
      lastName: field("last_name", string),
      age: field("age", number),
      active: field("active", boolean),
    }),
  );
  expect(userCamelCaseDecoder1(user)).toMatchInlineSnapshot(`
    {
      "active": true,
      "age": 30,
      "firstName": "John",
      "lastName": "Doe",
    }
  `);

  // Another way is to use `chain` to rename some fields after `fieldsAuto` has done
  // its job. Might be nice if there’s only a few fields that need renaming, but
  // it also looks kinda awkward, doesn’t it?
  const userCamelCaseDecoder2: Decoder<UserCamelCase> = chain(
    userSnakeCaseDecoder,
    ({ first_name: firstName, last_name: lastName, ...rest }) => ({
      firstName,
      lastName,
      ...rest,
    }),
  );
  expect(userCamelCaseDecoder2(user)).toMatchInlineSnapshot(`
    {
      "active": true,
      "age": 30,
      "firstName": "John",
      "lastName": "Doe",
    }
  `);

  // You also run the risk of accidentally keeping both spellings (no type errors!).
  const userCamelCaseDecoder3: Decoder<UserCamelCase> = chain(
    userSnakeCaseDecoder,
    (props) => ({
      firstName: props.first_name,
      lastName: props.last_name,
      ...props,
    }),
  );
  expect(userCamelCaseDecoder3(user)).toMatchInlineSnapshot(`
    {
      "active": true,
      "age": 30,
      "firstName": "John",
      "first_name": "John",
      "lastName": "Doe",
      "last_name": "Doe",
    }
  `);
});
