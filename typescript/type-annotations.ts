// This file shows how best to annotate your `record` and `autoRecord` decoders
// to maximize the help you get from TypeScript.

import {
  Decoder,
  autoRecord,
  record,
  boolean,
  constant,
  either,
  number,
  optional,
  string,
  repr,
} from "tiny-decoders";

// First, a small test interface and a function that receives it:
interface Person {
  name: string;
  age: number;
}
function greet(person: Person): string {
  return `Hello, ${person.name}!`;
}
const testPerson = { name: "John", age: 30, aye: 0, extra: "" };

/*
 * MISSPELLED PROPERTY
 */

// Here are two decoders for `Person`, but without explicit type annotations.
// TypeScript will infer what they decode into (try hovering `personDecoder1`
// and `personDecoder1Auto` in your editor!), but it won’t know that you
// intended to decode a `Person`. As you can see, I’ve misspelled `age` as `aye`.
const personDecoder1 = record(field => ({
  name: field("name", string),
  aye: field("age", number),
}));
const personDecoder1Auto = autoRecord({
  name: string,
  aye: number,
});
// Since TypeScript has inferred legit decoders above, it marks the following
// two calls as errors (you can’t pass an object with `aye` as a `Person`),
// while the _real_ errors of course are in the decoders themselves.
// $ExpectError
greet(personDecoder1(testPerson));
//    ^^^^^^^^^^^^^^^^^^^^^^^^^^
// Argument of type '{ name: string; aye: number; }' is not assignable to parameter of type 'Person'.
//   Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'. ts(2345)
// $ExpectError
greet(personDecoder1Auto(testPerson));
//    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Argument of type '{ name: string; aye: number; }' is not assignable to parameter of type 'Person'.
//   Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'. ts(2345)

// The way to make the above type errors more clear is to provide explicit type
// annotations, so that TypeScript knows what you’re trying to do.
// $ExpectError
const personDecoder2: Decoder<Person> = record(field => ({
  //  ^^^^^^^^^^^^^^
  // Type 'Decoder<{ name: string; aye: number; }>' is not assignable to type 'Decoder<Person>'.
  //   Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'. ts(2322)
  name: field("name", string),
  aye: field("age", number),
}));
// $ExpectError
const personDecoder2Auto: Decoder<Person> = autoRecord({
  //  ^^^^^^^^^^^^^^^^^^
  // Type 'Decoder<{ name: string; aye: number; }>' is not assignable to type 'Decoder<Person>'.
  //   Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'. ts(2322)
  name: string,
  aye: number,
});
greet(personDecoder2(testPerson));
greet(personDecoder2Auto(testPerson));

// Here’s a shorter way of writing the above – which also gives better error
// messages!
// $ExpectError
const personDecoder3 = record<Person>(field => ({
  name: field("name", string),
  aye: field("age", number),
}));
// ^
// Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.ts(2741)
const personDecoder3Auto = autoRecord<Person>({
  name: string,
  // $ExpectError
  aye: number,
  // ^^^^^^^^
  // Argument of type '{ name: (value: unknown) => string; aye: (value: unknown) => number; }' is not assignable to parameter of type '{ name: Decoder<string>; age: Decoder<number>; }'.
  //   Object literal may only specify known properties, and 'aye' does not exist in type '{ name: Decoder<string>; age: Decoder<number>; }'. ts(2345)
});
greet(personDecoder3(testPerson));
greet(personDecoder3Auto(testPerson));

// For, `record` there’s yet a way of annotating the type:
const personDecoder4 = record(
  (field): Person => ({
    name: field("name", string),
    // $ExpectError
    aye: field("age", number),
    // ^^^^^^^^^^^^^^^^^^^^^^
    // Type '{ name: string; aye: number; }' is not assignable to type 'Person'.
    //   Object literal may only specify known properties, and 'aye' does not exist in type 'Person'. ts(2322)
  })
);
greet(personDecoder4(testPerson));

/*
 * EXTRA PROPERTY
 */

// TypeScript allows passing extra properties, so without type annotations there are no errors:
const personDecoder5 = record(field => ({
  name: field("name", string),
  age: field("age", number),
  extra: field("extra", string),
}));
const personDecoder5Auto = autoRecord({
  name: string,
  age: number,
  extra: string,
});
greet(personDecoder5(testPerson));
greet(personDecoder5Auto(testPerson));

// Adding `Decoder<Person>` does not seem to help TypeScript find any errors:
const personDecoder6: Decoder<Person> = record(field => ({
  name: field("name", string),
  age: field("age", number),
  extra: field("extra", string),
}));
const personDecoder6Auto: Decoder<Person> = autoRecord({
  name: string,
  age: number,
  extra: string,
});
greet(personDecoder6(testPerson));
greet(personDecoder6Auto(testPerson));

// The shorter notation does produce an error for `autoRecord`, but not for `record`.
const personDecoder7 = record<Person>(field => ({
  name: field("name", string),
  age: field("age", number),
  extra: field("extra", string),
}));
const personDecoder7Auto = autoRecord<Person>({
  name: string,
  age: number,
  // $ExpectError
  extra: string,
  // ^^^^^^^^^^
  // Argument of type '{ name: (value: unknown) => string; age: (value: unknown) => number; extra: (value: unknown) => string; }' is not assignable to parameter of type '{ name: Decoder<string>; age: Decoder<number>; }'.
  //   Object literal may only specify known properties, and 'extra' does not exist in type '{ name: Decoder<string>; age: Decoder<number>; }'. ts(2345)
});
greet(personDecoder7(testPerson));
greet(personDecoder7Auto(testPerson));

// Luckily, the last type annotation style for `record` does produce an error!
const personDecoder8 = record(
  (field): Person => ({
    name: field("name", string),
    age: field("age", number),
    // $ExpectError
    extra: field("extra", string),
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^
    // Type '{ name: string; age: number; extra: string; }' is not assignable to type 'Person'.
    //   Object literal may only specify known properties, and 'extra' does not exist in type 'Person'. ts(2322)
  })
);
greet(personDecoder8(testPerson));
// See these TypeScript issues for more information:
// https://github.com/microsoft/TypeScript/issues/7547
// https://github.com/microsoft/TypeScript/issues/18020

/*
 * MAKING A TYPE FROM THE DECODER
 */

// Rather than first typing out an `interface` for `Person` and then essentially
// typing the same thing again in the decoder (especially `autoRecord` decoders
// look almost identical to `interface` they decode to!), you can start with the
// decoder and extract the type afterwards with TypeScript’s `ReturnType`
// utility.
const personDecoder9 = record(field => ({
  name: field("name", string),
  age: field("age", number),
}));
const personDecoder9Auto = autoRecord({
  name: string,
  age: number,
});
// $ExpectType { name: string; age: number; }
type Person2 = ReturnType<typeof personDecoder9>;
// $ExpectType { name: string; age: number; }
type Person3 = ReturnType<typeof personDecoder9Auto>;
greet(personDecoder9(testPerson));
greet(personDecoder9Auto(testPerson));
function meet(personA: Person2, personB: Person3): string {
  return `${personA.name} meets ${personB.name}`;
}
meet(personDecoder9(testPerson), personDecoder9Auto(testPerson));

// If it feels like you are specifying everything twice – once in a `type` or
// `interface`, and once in the decoder – you might find this `ReturnType`
// technique interesting. If annotating your decoders like shown earlier in this
// file (`record((field): MyType => ({...}))` and `autoRecord<MyType>({...})`),
// TypeScript will make sure that your type definition and decoders stay in
// sync, so there’s little room for error there. But with the `ReturnType`
// approach you don’t have to write what your records look like “twice.”
// Personally I don’t mind the “duplication,” but if you do – try out the
// `ReturnType` approach!

// Here’s a more complex example for trying out TypeScript’s inference.
const userDecoder = autoRecord({
  id: either(string, number),
  name: string,
  age: number,
  active: boolean,
  country: optional(string),
  type: constant("user"),
});

// Let TypeScript infer the `User` type:
type User = ReturnType<typeof userDecoder>;
// Try hovering over `User` in the line above – your editor should reveal the
// exact shape of the type.

const data = {
  id: 1,
  name: "John Doe",
  age: 30,
  active: true,
  type: "user",
};

const user: User = userDecoder(data);

// TypeScript has correctly inferred that the `type` property is not just a
// string, but the literal `"user"`.
const user2: User = {
  id: 1,
  name: "John Doe",
  age: 30,
  active: true,
  country: undefined,
  // $ExpectError
  type: "nope",
  // ^^^^^^^^^
  // Type '"nope"' is not assignable to type '"user"'. ts(2322)
};

// `extra: "prop"` is not allowed:
const user3: User = {
  id: 1,
  name: "John Doe",
  age: 30,
  active: true,
  country: undefined,
  type: "user",
  // $ExpectError
  extra: "prop",
  // ^^^^^^^^^^
  // Type '{ id: number; name: string; age: number; active: true; country: undefined; type: "user"; extra: string; }' is not assignable to type '{ id: string | number; name: string; age: number; active: boolean; country: string | undefined; type: "user"; }'.
  //   Object literal may only specify known properties, and 'extra' does not exist in type '{ id: string | number; name: string; age: number; active: boolean; country: string | undefined; type: "user"; }'. ts(2322)
};

// Here’s the same decoder again, but written using `record` instead of
// `autoRecord`. It should give the same inferred type.
const userDecoder2 = record(field => ({
  id: field("id", either(string, number)),
  name: field("name", string),
  age: field("age", number),
  active: field("active", boolean),
  country: field("country", optional(string)),
  type: field("type", constant("user")),
}));

type User2 = ReturnType<typeof userDecoder2>;

// Inference for the literal `"user"` works here, too.
const user4: User2 = {
  id: 1,
  name: "John Doe",
  age: 30,
  active: true,
  country: undefined,
  // $ExpectError
  type: "nope",
  // ^^^^^^^^^
  // Type '"nope"' is not assignable to type '"user"'. ts(2322)
};

/*
 * MAKING A TYPE FROM THE DECODER – CAVEATS
 */

// Let’s say we need to support two types of users – anonymous and registered ones.
// Unfortunately, TypeScript doesn’t infer the type you might have expected:
// $ExpectType Decoder<{ type: string; sessionId: number; id?: undefined; name?: undefined; } | { type: string; id: number; name: string; sessionId?: undefined; }>
const userDecoder3 = record((field, fieldError) => {
  const type = field("type", string);

  switch (type) {
    case "anonymous":
      return {
        type: "anonymous",
        sessionId: field("sessionId", number),
      };

    case "registered":
      return {
        type: "registered",
        id: field("id", number),
        name: field("name", string),
      };

    default:
      throw fieldError("type", `Unknown user type: ${repr(type)}`);
  }
});

// To turn `type: string` into `type: "anonymous"` and `type: "registered"`, add
// `as const` (using the `constant` decoder does not seem to help):
// $ExpectType Decoder<{ type: "anonymous"; sessionId: number; id?: undefined; name?: undefined; } | { type: "registered"; id: number; name: string; sessionId?: undefined; }>
const userDecoder4 = record((field, fieldError) => {
  const type = field("type", string);

  switch (type) {
    case "anonymous":
      return {
        type: "anonymous" as const,
        sessionId: field("sessionId", number),
      };

    case "registered":
      return {
        type: "registered" as const,
        id: field("id", number),
        name: field("name", string),
      };

    default:
      throw fieldError("type", `Unknown user type: ${repr(type)}`);
  }
});

// However, `id?: undefined` and similar are still part of the type. They don’t
// hurt super much when it comes to type safety. They are optional fields that
// only are allowed to be set to `undefined` – you can’t do much with that.
// However, they do clutter tooltips and autocomplete in your editor.
const testUser = userDecoder4({ type: "anonymous", sessiodId: 123 });
if (testUser.type === "anonymous") {
  // Type `testUser.` above this line and check your editor’s autocomplete.
  // You probably get something like this:
  //
  // - id?: undefined
  // - name?: undefined
  // - sessionId: number
  // - type: "anonymous"
  //
  // And if you hover over `testUser` in the line you typed, the tooltip showing
  // the type might say:
  //
  //     {
  //       type: "anonymous";
  //       sessionId: number;
  //       id?: undefined;
  //       name?: undefined;
  //     }
  //
  // Those extra fields are just noisy. They exist because of this:
  // https://github.com/microsoft/TypeScript/pull/19513
  //
  // But can we get rid of them?
}

// Turns out we can get rid of the extra properties by using the good old
// `identity` function! It’s just a function that returns whatever is passed to
// it. A bit of an ugly workaround, but it works.
const id = <T>(x: T): T => x;

// And when wrapping each `return` in `id(...)` the extra properties vanish!
// $ExpectType Decoder<{ type: "anonymous"; sessionId: number; } | { type: "registered"; id: number; name: string; }>
const userDecoder5 = record((field, fieldError) => {
  const type = field("type", string);

  switch (type) {
    case "anonymous":
      return id({
        type: "anonymous" as const,
        sessionId: field("sessionId", number),
      });

    case "registered":
      return id({
        type: "registered" as const,
        id: field("id", number),
        name: field("name", string),
      });

    default:
      throw fieldError("type", `Unknown user type: ${repr(type)}`);
  }
});

// Another way is to write separate decoders for each case.
function getUserDecoder(type: unknown) {
  switch (type) {
    case "anonymous":
      return record(field => ({
        type: field("type", constant("anonymous")),
        sessionId: field("sessionId", number),
      }));

    case "registered":
      // You can also use `autoRecord`:
      return autoRecord({
        type: constant("registered"),
        id: number,
        name: string,
      });

    default:
      throw new TypeError(`Unknown user type: ${repr(type)}`);
  }
}

// This “decodes” the "type" field using `getUserDecoder`. Remember that a
// decoder is allowed to return whatever it wants. `getUserDecoder` returns a
// _new_ decoder, which we immediately call. I haven’t found a nicer way to do
// this so far.
// $ExpectType Decoder<{ type: "anonymous"; sessionId: number; } | { type: "registered"; id: number; name: string; }>
const userDecoder6 = record((field, _fieldError, obj, errors) =>
  field("type", getUserDecoder)(obj, errors)
);

// Finally, there’s one last little detail to know about: How optional fields
// are inferred.
// $ExpectType Decoder<{ title: string; description: string | undefined; }>
const itemDecoder = autoRecord({
  title: string,
  description: optional(string),
});

// As you can see above, fields using the `optional` decoder are always inferred
// as `key: T | undefined`, and never as `key?: T`. This means that you always
// have to specify the optional fields:
type Item = ReturnType<typeof itemDecoder>;
// $ExpectError
const item1: Item = {
  //  ^^^^^
  // Property 'description' is missing in type '{ title: string; }' but required in type '{ title: string; description: string | undefined; } ts(2741)
  title: "Pencil",
};
const item2: Item = {
  title: "Pencil",
  description: undefined,
};

// This may or may not be what you want. If you have a large number of optional
// fields and need to construct a lot of such objects in code it might be
// convenient not having to specify all optional fields at all times. To achieve
// that you must provide an explicit type annotation:
interface Item2 {
  title: string;
  description?: string;
}
// $ExpectType Decoder<Item2>
const itemDecoder2 = autoRecord<Item2>({
  title: string,
  description: optional(string),
});
const item3: Item2 = {
  title: "Pencil",
};
