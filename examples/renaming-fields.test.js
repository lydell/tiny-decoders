// @flow strict

import {
  type Decoder,
  autoRecord,
  boolean,
  map,
  number,
  record,
  string,
} from "../src";

test("renaming fields", () => {
  type UserSnakeCase = {
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  };

  // Making decoders with `autoRecord` is convenient if the object you are
  // decoding and your interal type have the same key names.
  const userSnakeCaseDecoder: Decoder<UserSnakeCase> = autoRecord({
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  });

  const user: mixed = {
    first_name: "John",
    last_name: "Doe",
    age: 30,
    active: true,
  };
  expect((userSnakeCaseDecoder(user): UserSnakeCase)).toMatchInlineSnapshot(`
    Object {
      "active": true,
      "age": 30,
      "first_name": "John",
      "last_name": "Doe",
    }
  `);

  type UserCamelCase = {
    firstName: string,
    lastName: string,
    age: number,
    active: boolean,
  };

  // If you want to rename some fields, switch to `record`. This means having to
  // duplicate some field names, but it’s not so bad.
  const userCamelCaseDecoder1: Decoder<UserCamelCase> = record((field) => ({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
    age: field("age", number),
    active: field("active", boolean),
  }));
  expect((userCamelCaseDecoder1(user): UserCamelCase)).toMatchInlineSnapshot(`
    Object {
      "active": true,
      "age": 30,
      "firstName": "John",
      "lastName": "Doe",
    }
  `);

  // Another way is to use `map` to rename some fields after `autoRecord` has done
  // its job. Might be nice if there’s only a few fields that need renaming, but
  // it also looks kinda awkward, doesn’t it?
  const userCamelCaseDecoder2: Decoder<UserCamelCase> = map(
    userSnakeCaseDecoder,
    ({ first_name: firstName, last_name: lastName, ...rest }) => ({
      firstName,
      lastName,
      ...rest,
    })
  );
  expect((userCamelCaseDecoder2(user): UserCamelCase)).toMatchInlineSnapshot(`
    Object {
      "active": true,
      "age": 30,
      "firstName": "John",
      "lastName": "Doe",
    }
  `);
});
