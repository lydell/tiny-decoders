// @flow strict

// This file shows how best to annotate your `fields` and `autoRecord` decoders
// to maximize the help you get from Flow.

import {
  type Decoder,
  autoRecord,
  boolean,
  constant,
  either,
  fields,
  number,
  optional,
  string,
} from "../src";

test("type annotations", () => {
  // First, a small test type and a function that receives it:
  type Person = {
    name: string,
    age: number,
  };
  function greet(person: Person): string {
    return `Hello, ${person.name}!`;
  }
  const testPerson = { name: "John", age: 30, aye: 0, extra: "" };

  /*
   * MISSPELLED PROPERTY
   */

  // Here are two decoders for `Person`, but without explicit type annotations.
  // Flow will infer what they decode into (try hovering `personDecoder1`
  // and `personDecoder1Auto` in your editor!), but it won’t know that you
  // intended to decode a `Person`. As you can see, I’ve misspelled `age` as `aye`.
  const personDecoder1 = fields((field) => ({
    name: field("name", string),
    aye: field("age", number),
  }));
  const personDecoder1Auto = autoRecord({
    name: string,
    aye: number,
  });
  // Since Flow has inferred legit decoders above, it marks the following
  // two calls as errors (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ errors of course are in the decoders themselves.
  // $ExpectError
  greet(personDecoder1(testPerson));
  //    ^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Cannot call `greet` with `personDecoder1(...)` bound to `person` because property `age` is missing in  object literal [1] but exists in  `Person` [2].
  // $ExpectError
  greet(personDecoder1Auto(testPerson));
  //    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Cannot call `greet` with `personDecoder1Auto(...)` bound to `person` because property `age` is missing in  object type [1] but exists in  `Person` [2].

  // The way to make the above type errors more clear is to provide explicit type
  // annotations, so that Flow knows what you’re trying to do.
  // $ExpectError
  const personDecoder2: Decoder<Person> = fields((field) => ({
    name: field("name", string),
    aye: field("age", number),
  }));
  // ^
  // Cannot assign `fields(...)` to `personDecoder2` because property `aye` is missing in  `Person` [1] but exists in  object literal [2] in type argument  `T` [3].
  // $ExpectError
  const personDecoder2Auto: Decoder<Person> = autoRecord({
    name: string,
    aye: number,
  });
  // ^
  // Cannot assign `autoRecord(...)` to `personDecoder2Auto` because property `age` is missing in  object type [1] but exists in  `Person` [2] in type argument  `T` [3].
  greet(personDecoder2(testPerson));
  greet(personDecoder2Auto(testPerson));

  // Here’s a shorter way of writing the above – which also gives better error
  // messages! Note that unlike in TypeScript, `autoRecord<Person>({...})` cannot be used in Flow.
  // $ExpectError
  const personDecoder3 = fields<Person>((field) => ({
    name: field("name", string),
    aye: field("age", number),
  }));
  // ^
  // Cannot call `fields` with function bound to `callback` because property `aye` is missing in  `Person` [1] but exists in  object literal [2] in the return value.
  greet(personDecoder3(testPerson));

  // For, `fields` there’s yet a way of annotating the type:
  // $ExpectError
  const personDecoder4 = fields((field): Person => ({
    name: field("name", string),
    aye: field("age", number),
  }));
  // ^
  // Cannot return object literal because property `age` is missing in  object literal [1] but exists in  `Person` [2].
  greet(personDecoder4(testPerson));

  /*
   * EXTRA PROPERTY
   */

  // Flow has exact objects, so even without type annotations it detects errors:
  const personDecoder5 = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  const personDecoder5Auto = autoRecord({
    name: string,
    age: number,
    extra: string,
  });
  // $ExpectError
  greet(personDecoder5(testPerson));
  //    ^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Cannot call `greet` with `personDecoder5(...)` bound to `person` because property `extra` is missing in  `Person` [1] but exists in  object literal [2].
  // $ExpectError
  greet(personDecoder5Auto(testPerson));
  //    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Cannot call `greet` with `personDecoder5Auto(...)` bound to `person` because property `extra` is missing in  `Person` [1] but exists in  object type [2].

  // Adding `Decoder<Person>` moves the errors to the decoder definitions:
  // $ExpectError
  const personDecoder6: Decoder<Person> = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  // ^
  // Cannot assign `fields(...)` to `personDecoder6` because property `extra` is missing in  `Person` [1] but exists in  object literal [2] in type argument  `T` [3].
  // $ExpectError
  const personDecoder6Auto: Decoder<Person> = autoRecord({
    name: string,
    age: number,
    extra: string,
  });
  // ^
  // Cannot assign `autoRecord(...)` to `personDecoder6Auto` because property `extra` is missing in  `Person` [1] but exists in  object type [2] in type argument  `T` [3].
  greet(personDecoder6(testPerson));
  greet(personDecoder6Auto(testPerson));

  // The shorter notation produces different error messages:
  // $ExpectError
  const personDecoder7 = fields<Person>((field) => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  // ^
  // Cannot call `fields` with function bound to `callback` because property `extra` is missing in  `Person` [1] but exists in  object literal [2] in the return value.
  greet(personDecoder7(testPerson));

  // The last type annotation style for `fields` produces the best error message:
  // $ExpectError
  const personDecoder8 = fields((field): Person => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  // ^
  // Cannot return object literal because property `extra` is missing in  `Person` [1] but exists in  object literal [2].
  greet(personDecoder8(testPerson));

  /*
   * MAKING A TYPE FROM THE DECODER
   */

  // Rather than first typing out a `type` for `Person` and then essentially
  // typing the same thing again in the decoder (especially `autoRecord` decoders
  // look almost identical to `type` they decode to!), you can start with the
  // decoder and extract the type afterwards with some Flow magic.
  // Unlike TypeScript, Flow does not have a `ReturnType` utility, so we have to
  // define it ourselves. Source:
  // https://github.com/facebook/flow/issues/4363#issuecomment-383564408
  // flowlint-next-line unclear-type:off
  type $ReturnType<Fn> = $Call<<T>((...Iterable<any>) => T) => T, Fn>;

  // Now let Flow infer some types! Unfortunately, if you hover over `Person2`
  // and `Person3` in you editor, you’ll notice that you won’t see the fully
  // “resolved” type, but instead the whole `$ReturnType<...>`. That looks kinda
  // OK when using `fields`, but is a but noisy for `autoRecord` since you’ll
  // also see the whole `$ObjMap<...>` nonsense. See below.
  const personDecoder9 = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
  }));
  const personDecoder9Auto = autoRecord({
    name: string,
    age: number,
  });
  type Person2 = $ReturnType<typeof personDecoder9>;
  // type Person2 = $ReturnType<
  //   Decoder<{ age: number, name: string }>
  // >
  type Person3 = $ReturnType<typeof personDecoder9Auto>;
  // type Person3 = $ReturnType<
  //   Decoder<
  //     $ObjMap<
  //       {
  //         age: (value: mixed) => number,
  //         name: (value: mixed) => string
  //       },
  //       DecoderType
  //     >
  //   >
  // >
  greet(personDecoder9(testPerson));
  greet(personDecoder9Auto(testPerson));
  function meet(personA: Person2, personB: Person3): string {
    return `${personA.name} meets ${personB.name}`;
  }
  meet(personDecoder9(testPerson), personDecoder9Auto(testPerson));

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the decoder – you might find this `$ReturnType`
  // technique interesting (but it’s hard to recommend it because the many
  // caveats documented below). Flow will make sure that your type definition
  // and decoders stay in sync, so there’s little room for error there. But with
  // the `$ReturnType` approach you don’t have to write what your records look
  // like “twice.” Personally I don’t mind the “duplication,” but if you do –
  // try out the `$ReturnType` approach!

  // Here’s a more complex example for trying out Flow’s inference.
  const userDecoder = autoRecord({
    id: either(string, number),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
    // A caveat is that even though the constant is specified as the exact
    // string "user" Flow still allows any string – see `user2` below.
    type: constant<"user">("user"),
  });

  // Then, let Flow infer the `User` type!
  type User = $ReturnType<typeof userDecoder>;

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
  // ^
  // Cannot assign object literal to `user3` because property `extra` is missing in  object type [1] but exists in  object literal [2].
  expect(user3).toMatchObject(user);

  // Here’s the same decoder again, but written using `fields` instead of
  // `autoRecord`. It should give the same inferred type.
  const userDecoder2 = fields((field) => ({
    id: field("id", either(string, number)),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    country: field("country", optional(string)),
    type: field("type", constant<"user">("user")),
  }));

  type User2 = $ReturnType<typeof userDecoder2>;

  // Inference for the literal `"user"` doesn’t work here, either.
  const user4: User2 = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    // As mentioned earlier it would have been nice if this was an error
    // (supposed to be `type: "user"`):
    type: "nope",
  };
  expect({ ...user4, type: "user" }).toMatchObject(user);

  // Because of the worse editor tooltips for inferred types as well as the
  // `constant` caveat, I find it hard to recommend the `$ReturnType` approach
  // in Flow. It works better in TypeScript.
});
