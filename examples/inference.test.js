// @flow strict

import {
  boolean,
  constant,
  either,
  number,
  optional,
  record,
  string,
} from "../src";

test("inferring types", () => {
  // Feels like you are specifying everything twice – once in `type`, once in
  // the decoder? There is a way to let Flow infer the type from a decoder!
  // Personally I don’t mind the “duplication,” but if you trust the inference
  // you can experiment with the following approach, which is taken from:
  // https://github.com/nvie/decoders/issues/93
  // https://gist.github.com/girvo/b4207d4fc92f6b336813d1404309baab

  const userDecoder = record({
    id: either(string, number),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
    // A caveat is that even though the constant is specified as the exact
    // string "user" Flow still allows any string – see `user2` below.
    type: constant(("user": "user")),
  });

  // First, a general helper type:
  type ExtractDecoderType = <T>((mixed) => T) => T;
  // Then, let Flow infer the `User` type!
  type User = $Call<ExtractDecoderType, typeof userDecoder>;

  const data = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    type: "user",
  };

  const user: User = userDecoder(data);
  expect(user).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "country": undefined,
  "id": 1,
  "name": "John Doe",
  "type": "user",
}
`);

  const user2: User = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    // As mentioned earlier it would have been nice if this was an error
    // (supposed to be `type: "user"`):
    type: "nope",
  };
  expect({ ...user2, type: "user" }).toMatchObject(user);

  // `User` is exact, so `extra: "prop"` is not allowed:
  // $ExpectError
  const user3: User = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    type: "user",
    extra: "prop",
  };
  expect(user3).toMatchObject(user);
});
