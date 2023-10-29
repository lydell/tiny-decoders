import { expect, test } from "vitest";

import {
  array,
  boolean,
  Codec,
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

  const userCodec = fieldsAuto({
    name: string,
    followers: number,
  });

  const failureCodec = fieldsAuto({
    error: string,
    errorCode: number,
  });

  const userResultCodec: Codec<UserResult> = {
    decoder: (value) =>
      // This is a bit annoying to do. Prefer a tagged union and use `fieldsAuto`.
      // But when that’s not possible, this is a simple way of “committing” to one
      // of the union variants and choosing a decoder based on that.
      // This approach results in much easier to understand error messages at
      // runtime than an approach of first trying the first decoder, and then
      // the second (because if both fail, you need to display both error messages).
      typeof value === "object" && value !== null && "error" in value
        ? failureCodec.decoder(value)
        : userCodec.decoder(value),
    encoder: (value) =>
      "error" in value ? failureCodec.encoder(value) : userCodec.encoder(value),
  };

  expect(userResultCodec.decoder({ name: "John", followers: 42 }))
    .toMatchInlineSnapshot(`
      {
        "tag": "Valid",
        "value": {
          "followers": 42,
          "name": "John",
        },
      }
    `);

  expect(userResultCodec.encoder({ name: "John", followers: 42 }))
    .toMatchInlineSnapshot(`
    {
      "followers": 42,
      "name": "John",
    }
  `);

  expect(userResultCodec.decoder({ error: "Not found", errorCode: 404 }))
    .toMatchInlineSnapshot(`
      {
        "tag": "Valid",
        "value": {
          "error": "Not found",
          "errorCode": 404,
        },
      }
    `);

  expect(userResultCodec.encoder({ error: "Not found", errorCode: 404 }))
    .toMatchInlineSnapshot(`
    {
      "error": "Not found",
      "errorCode": 404,
    }
  `);
});

test("tagged union, but using boolean instead of string", () => {
  function constant<T extends boolean | number | string>(
    constantValue: T,
  ): Codec<T, T> {
    return {
      decoder: (value) =>
        value === constantValue
          ? { tag: "Valid", value: constantValue }
          : {
              tag: "DecoderError",
              error: {
                tag: "custom",
                message: `Expected ${JSON.stringify(constantValue)}`,
                got: value,
                path: [],
              },
            },
      encoder: (value) => value,
    };
  }

  const adminCodec = fieldsAuto({
    isAdmin: constant(true),
    name: string,
    access: array(string),
  });

  const notAdminCodec = fieldsAuto({
    isAdmin: constant(false),
    name: string,
    location: undefinedOr(string),
  });

  type User = Infer<typeof adminCodec> | Infer<typeof notAdminCodec>;

  const userCodec: Codec<User> = {
    decoder: (value) => {
      const result = fieldsAuto({ isAdmin: boolean }).decoder(value);
      switch (result.tag) {
        case "DecoderError":
          return result;
        case "Valid":
          return result.value.isAdmin
            ? adminCodec.decoder(value)
            : notAdminCodec.decoder(value);
      }
    },
    encoder: (value) =>
      value.isAdmin ? adminCodec.encoder(value) : notAdminCodec.encoder(value),
  };

  expect(
    userCodec.decoder({
      isAdmin: true,
      name: "John",
      access: [],
    }),
  ).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "access": [],
        "isAdmin": true,
        "name": "John",
      },
    }
  `);

  expect(
    userCodec.encoder({
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
    userCodec.decoder({
      isAdmin: false,
      name: "Jane",
      location: undefined,
    }),
  ).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "isAdmin": false,
        "location": undefined,
        "name": "Jane",
      },
    }
  `);

  expect(
    userCodec.encoder({
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
