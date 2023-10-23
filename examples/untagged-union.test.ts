import { expect, test } from "vitest";

import {
  array,
  boolean,
  chain,
  Decoder,
  fieldsAuto,
  Infer,
  number,
  string,
  undefinedOr,
} from "../";

test("untagged union", () => {
  type User = {
    name: string;
    followers: number;
  };

  type Failure = {
    error: string;
    errorCode: number;
  };

  type UserResult = Failure | User;

  const userDecoder = fieldsAuto({
    name: string,
    followers: number,
  });

  const failureDecoder = fieldsAuto({
    error: string,
    errorCode: number,
  });

  const userResultDecoder: Decoder<UserResult> = (value) =>
    // This is a bit annoying to do. Prefer a tagged union and use `fieldsAuto`.
    // But when that’s not possible, this is a simple way of “committing” to one
    // of the union variants and choosing a decoder based on that.
    // This approach results in much easier to understand error messages at
    // runtime than an approach of first trying the first decoder, and then
    // the second (because if both fail, you need to display both error messages).
    typeof value === "object" && value !== null && "error" in value
      ? failureDecoder(value)
      : userDecoder(value);

  expect(userResultDecoder({ name: "John", followers: 42 }))
    .toMatchInlineSnapshot(`
    {
      "followers": 42,
      "name": "John",
    }
  `);

  expect(userResultDecoder({ error: "Not found", errorCode: 404 }))
    .toMatchInlineSnapshot(`
    {
      "error": "Not found",
      "errorCode": 404,
    }
  `);
});

test("tagged union, but using boolean instead of string", () => {
  const adminDecoder = chain(
    fieldsAuto({
      name: string,
      access: array(string),
    }),
    (props) => ({
      isAdmin: true as const,
      ...props,
    }),
  );

  const notAdminDecoder = chain(
    fieldsAuto({
      name: string,
      location: undefinedOr(string),
    }),
    (props) => ({
      isAdmin: false as const,
      ...props,
    }),
  );

  type User = Infer<typeof adminDecoder> | Infer<typeof notAdminDecoder>;

  const userDecoder: Decoder<User> = (value) => {
    const { isAdmin } = fieldsAuto({ isAdmin: boolean })(value);
    return isAdmin ? adminDecoder(value) : notAdminDecoder(value);
  };

  expect(
    userDecoder({
      isAdmin: true,
      name: "John",
      access: [],
    }),
  ).toMatchInlineSnapshot(`
    {
      "access": [],
      "isAdmin": true,
      "name": "John",
    }
  `);

  expect(
    userDecoder({
      isAdmin: false,
      name: "Jane",
      location: undefined,
    }),
  ).toMatchInlineSnapshot(`
    {
      "isAdmin": false,
      "location": undefined,
      "name": "Jane",
    }
  `);
});
