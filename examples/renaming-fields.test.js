// @flow strict

import { boolean, field, group, map, number, record, string } from "../src";

test("renaming fields", () => {
  type UserSnakeCase = {|
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  |};

  // Making decoders with `record` is convenient, but what if you want to rename
  // some fields?
  const userSnakeCaseDecoder: mixed => UserSnakeCase = record({
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

  type UserCamelCase = {|
    firstName: string,
    lastName: string,
    age: number,
    active: boolean,
  |};

  // One way is to use `group` and `field`. This is the clearest way, but if you
  // really want to avoid duplication of field names there are a few other
  // approaches below.
  const userCamelCaseDecoder1: mixed => UserCamelCase = group({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
    age: field("age", number),
    active: field("active", boolean),
  });
  expect((userCamelCaseDecoder1(user): UserCamelCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "firstName": "John",
  "lastName": "Doe",
}
`);

  // Another way is to use `map` to rename some fields after `record` has done
  // its job. Might be nice if there’s only a few fields that need renaming.
  const userCamelCaseDecoder2: mixed => UserCamelCase = map(
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

  // A third way is to use `record`, `group`, `field` and `map` all at once.
  // TODO and WARNING: If you misspell fields using this approach Flow doesn’t
  // catch it! This seems to be a bug in Flow, because TypeScript does catch it.
  const userCamelCaseDecoder3: mixed => UserCamelCase = map(
    group({
      firstName: field("first_name", string),
      lastName: field("last_name", string),
      rest: record({
        // TODO: Flow errors on this line, even though it is correct.
        // $FlowIgnore
        age: number,
        active: boolean,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  );
  expect((userCamelCaseDecoder3(user): UserCamelCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "firstName": "John",
  "lastName": "Doe",
}
`);
});
