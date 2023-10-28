import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  array,
  boolean,
  Decoder,
  DecoderResult,
  field,
  fieldsAuto,
  Infer,
  number,
  string,
  undefinedOr,
} from "..";
import { run } from "../tests/helpers";

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

  const userResult: DecoderResult<User> = userDecoder(payload);

  expect(userResult).toStrictEqual({
    tag: "Valid",
    value: {
      name: "John Doe",
      active: true,
      age: 30,
      interests: ["Programming", "Cooking"],
    },
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

test("fieldsAuto", () => {
  const exampleDecoder = fieldsAuto({
    name: field(string, { optional: true }),
  });

  type Example = { name?: string };

  expectType<TypeEqual<Infer<typeof exampleDecoder>, Example>>(true);

  const exampleDecoder2 = fieldsAuto({
    name: field(undefinedOr(string), { optional: true }),
  });

  expect(run(exampleDecoder, {})).toStrictEqual({});
  expect(run(exampleDecoder, { name: "some string" })).toStrictEqual({
    name: "some string",
  });

  type Example2 = { name?: string | undefined };

  expectType<TypeEqual<Infer<typeof exampleDecoder2>, Example2>>(true);

  expect(run(exampleDecoder2, { name: undefined })).toStrictEqual({
    name: undefined,
  });
});

test("field", () => {
  const exampleDecoder = fieldsAuto({
    // Required field.
    a: string,

    // Optional field.
    b: field(string, { optional: true }),

    // Required field that can be set to `undefined`:
    c: undefinedOr(string),

    // Optional field that can be set to `undefined`:
    d: field(undefinedOr(string), { optional: true }),
  });

  type Example = {
    a: string;
    b?: string;
    c: string | undefined;
    d?: string | undefined;
  };

  expectType<TypeEqual<Infer<typeof exampleDecoder>, Example>>(true);

  expect(run(exampleDecoder, { a: "", c: undefined })).toStrictEqual({
    a: "",
    c: undefined,
  });

  expect(
    run(exampleDecoder, { a: "", b: "", c: undefined, d: undefined }),
  ).toStrictEqual({ a: "", b: "", c: undefined, d: undefined });

  expect(run(exampleDecoder, { a: "", b: "", c: "", d: "" })).toStrictEqual({
    a: "",
    b: "",
    c: "",
    d: "",
  });
});
