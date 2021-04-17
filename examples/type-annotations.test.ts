// This file shows how best to annotate your `fields` and `fieldsAuto` decoders
// to maximize the help you get from TypeScript.

import { expectType, TypeEqual } from "ts-expect";

import {
  boolean,
  constant,
  Decoder,
  DecoderError,
  fields,
  fieldsAuto,
  fieldsUnion,
  multi,
  number,
  optional,
  string,
  WithUndefinedAsOptional,
} from "../";

test("type annotations", () => {
  // First, a small test type and a function that receives it:
  type Person = {
    name: string;
    age: number;
  };
  function greet(person: Person): string {
    return `Hello, ${person.name}!`;
  }
  const testPerson: unknown = { name: "John", age: 30, aye: 0, extra: "" };

  /*
   * MISSPELLED PROPERTY
   */

  // Here are two decoders for `Person`, but without explicit type annotations.
  // TypeScript will infer what they decode into (try hovering `personDecoder1`
  // and `personDecoder1Auto` in your editor!), but it won’t know that you
  // intended to decode a `Person`. As you can see, I’ve misspelled `age` as `aye`.
  const personDecoder1 = fields((field) => ({
    name: field("name", string),
    aye: field("age", number),
  }));
  const personDecoder1Auto = fieldsAuto({
    name: string,
    aye: number,
  });
  // Since TypesCript has inferred legit decoders above, it marks the following
  // two calls as errors (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ errors of course are in the decoders themselves.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personDecoder1(testPerson));
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personDecoder1Auto(testPerson));

  // The way to make the above type errors more clear is to provide explicit type
  // annotations, so that TypeScript knows what you’re trying to do.
  const personDecoder2 = fields(
    (field): Person => ({
      name: field("name", string),
      // @ts-expect-error Object literal may only specify known properties, and 'aye' does not exist in type 'Person'.
      aye: field("age", number),
    })
  );
  const personDecoder2Auto = fieldsAuto<Person>({
    name: string,
    // @ts-expect-error Object literal may only specify known properties, and 'aye' does not exist in type '{ name: Decoder<string, unknown>; age: Decoder<number, unknown>; }'.
    aye: number,
  });
  greet(personDecoder2(testPerson));
  greet(personDecoder2Auto(testPerson));

  /*
   * EXTRA PROPERTY
   */

  // TypeScript allows passing extra properties, so without type annotations
  // there are no errors:
  const personDecoder5 = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  const personDecoder5Auto = fieldsAuto({
    name: string,
    age: number,
    extra: string,
  });
  // These would ideally complain about the extra property.
  greet(personDecoder5(testPerson));
  greet(personDecoder5Auto(testPerson));

  // Adding `Decoder<Person>` does not seem to help TypeScript find any errors:
  const personDecoder6: Decoder<Person> = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
    extra: field("extra", string),
  }));
  const personDecoder6Auto: Decoder<Person> = fieldsAuto({
    name: string,
    age: number,
    extra: string,
  });
  greet(personDecoder6(testPerson));
  greet(personDecoder6Auto(testPerson));

  // The recommended notations do produce errors!
  const personDecoder7 = fields(
    (field): Person => ({
      name: field("name", string),
      age: field("age", number),
      // @ts-expect-error Object literal may only specify known properties, and 'extra' does not exist in type 'Person'.
      extra: field("extra", string),
    })
  );
  const personDecoder7Auto = fieldsAuto<Person>({
    name: string,
    age: number,
    // @ts-expect-error Object literal may only specify known properties, and 'extra' does not exist in type '{ name: Decoder<string, unknown>; age: Decoder<number, unknown>; }'.
    extra: string,
  });
  greet(personDecoder7(testPerson));
  greet(personDecoder7Auto(testPerson));
  // See these TypeScript issues for more information:
  // https://github.com/microsoft/TypeScript/issues/7547
  // https://github.com/microsoft/TypeScript/issues/18020

  /*
   * MAKING A TYPE FROM THE DECODER
   */

  // Rather than first typing out a `type` for `Person` and then essentially
  // typing the same thing again in the decoder (especially `fieldsAuto` decoders
  // look almost identical to `type` they decode to!), you can start with the
  // decoder and extract the type afterwards with TypeScript’s `ReturnType` utility.
  const personDecoder8 = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
  }));
  const personDecoder8Auto = fieldsAuto({
    name: string,
    age: number,
  });
  type Person2 = ReturnType<typeof personDecoder8>;
  expectType<TypeEqual<Person2, { name: string; age: number }>>(true);
  type Person3 = ReturnType<typeof personDecoder8Auto>;
  expectType<TypeEqual<Person3, { name: string; age: number }>>(true);
  greet(personDecoder8(testPerson));
  greet(personDecoder8Auto(testPerson));
  function meet(personA: Person2, personB: Person3): string {
    return `${personA.name} meets ${personB.name}`;
  }
  meet(personDecoder8(testPerson), personDecoder8Auto(testPerson));

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the decoder – you might find this `ReturnType`
  // technique interesting. If annotating your decoders like shown earlier in this
  // file (`fields((field): MyType => ({...}))` and `fieldsAuto<MyType>({...})`),
  // TypeScript will make sure that your type definition and decoders stay in
  // sync, so there’s little room for error there. But with the `ReturnType`
  // approach you don’t have to write what your records look like “twice.”
  // Personally I don’t always mind the “duplication,” but when you do – try out
  // the `ReturnType` approach!

  // Here’s a more complex example for trying out TypeScript’s inference.
  const userDecoder = fieldsAuto({
    // For some reason `id` becomes `unknown` when using `fieldsAuto`, but not
    // when using `fields` (see further down).
    id: multi({ string, number }),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
    type: constant("user"),
  });

  // Then, let TypeScript infer the `User` type!
  type User = ReturnType<typeof userDecoder>;
  // Try hovering over `User` in the line above – your editor should reveal the
  // exact shape of the type.

  const data: unknown = {
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
    // @ts-expect-error Type '"nope"' is not assignable to type '"user"'.
    type: "nope",
  };
  expect({ ...user2, type: "user" }).toMatchObject(user);

  // `extra: "prop"` is not allowed:
  const user3: User = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    type: "user",
    // @ts-expect-error Object literal may only specify known properties, and 'extra' does not exist in type '{ id: unknown; name: string; age: number; active: boolean; country: string | undefined; type: "user"; }'.
    extra: "prop",
  };
  expect(user3).toMatchObject(user);

  // Here’s the same decoder again, but written using `fields` instead of
  // `fieldsAuto`. It should give the same inferred type.
  const userDecoder2 = fields((field) => ({
    id: field("id", multi({ string, number })),
    name: field("name", string),
    age: field("age", number),
    active: field("active", boolean),
    country: field("country", optional(string)),
    type: field("type", constant<"user">("user")),
  }));

  type User2 = ReturnType<typeof userDecoder2>;

  const user4: User2 = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    // @ts-expect-error Type '"nope"' is not assignable to type '"user"'.
    type: "nope",
  };
  expect({ ...user4, type: "user" }).toMatchObject(user);

  /*
   * MAKING A TYPE FROM THE DECODER – UNIONS
   */

  // Let’s say we need to support two types of users – anonymous and registered
  // ones. This is where `fieldsUnion` shines! It’s both easier to use and gives
  // a better inferred type!
  const userDecoder3 = fieldsUnion("type", {
    anonymous: fieldsAuto({
      type: constant("anonymous"),
      sessionId: number,
    }),
    registered: fieldsAuto({
      type: constant("registered"),
      id: number,
      name: string,
    }),
  });
  type InferredType3 = ReturnType<typeof userDecoder3>;
  type ExpectedType3 =
    | { type: "anonymous"; sessionId: number }
    | { type: "registered"; id: number; name: string };
  expectType<TypeEqual<InferredType3, ExpectedType3>>(true);

  // For comparison, let’s do the same decoder “manually”.
  // This might not be super interesting – but I’ve kept this “TypeScript
  // research” for my future self.
  // Unfortunately, TypeScript doesn’t infer the type you might have expected:
  const userDecoder4 = fields((field) => {
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
        throw new DecoderError({
          message: "Unknown user type",
          value: type,
          key: "type",
        });
    }
  });
  type InferredType4 = ReturnType<typeof userDecoder4>;
  type ActualType4 =
    | {
        type: string;
        id: number;
        name: string;
        sessionId?: undefined;
      }
    | {
        type: string;
        sessionId: number;
        id?: undefined;
        name?: undefined;
      };
  expectType<TypeEqual<InferredType4, ActualType4>>(true);

  // To turn `type: string` into `type: "anonymous"` and `type: "registered"`, add
  // `as const` (using the `constant` decoder does not seem to help):
  const userDecoder5 = fields((field) => {
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
        throw new DecoderError({
          message: "Unknown user type",
          value: type,
          key: "type",
        });
    }
  });
  type InferredType5 = ReturnType<typeof userDecoder5>;
  type ActualType5 =
    | {
        type: "anonymous";
        sessionId: number;
        id?: undefined;
        name?: undefined;
      }
    | {
        type: "registered";
        id: number;
        name: string;
        sessionId?: undefined;
      };
  expectType<TypeEqual<InferredType5, ActualType5>>(true);

  // However, `id?: undefined` and similar are still part of the type. They don’t
  // hurt super much when it comes to type safety. They are optional fields that
  // only are allowed to be set to `undefined` – you can’t do much with that.
  // However, they do clutter tooltips and autocomplete in your editor.
  const testUser = userDecoder5({ type: "anonymous", sessionId: 123 });
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
  const userDecoder6 = fields((field) => {
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
        throw new DecoderError({
          message: "Unknown user type",
          value: type,
          key: "type",
        });
    }
  });
  type InferredType6 = ReturnType<typeof userDecoder6>;
  type ActualType6 =
    | {
        type: "anonymous";
        sessionId: number;
      }
    | {
        type: "registered";
        id: number;
        name: string;
      };
  expectType<TypeEqual<InferredType6, ActualType6>>(true);

  // Another way is to write separate decoders for each case.
  // Note how I disabled the explicit-function-return-type rule – inferring the
  // type is the whole point, and having to disable ESLint rules is annoying…
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function getUserDecoder(type: unknown) {
    switch (type) {
      case "anonymous":
        return fields((field) => ({
          type: field("type", constant("anonymous")),
          sessionId: field("sessionId", number),
        }));

      case "registered":
        // You can also use `fieldsAuto`:
        return fieldsAuto({
          type: constant("registered"),
          id: number,
          name: string,
        });

      default:
        throw new DecoderError({
          message: "Unknown user type",
          value: type,
          key: "type",
        });
    }
  }

  // This “decodes” the "type" field using `getUserDecoder`. Remember that a
  // decoder is allowed to return whatever it wants. `getUserDecoder` returns a
  // _new_ decoder, which we immediately call. I haven’t found a nicer way to do
  // this so far.
  const userDecoder7 = fields((field, obj, errors) =>
    field("type", getUserDecoder)(obj, errors)
  );
  type InferredType7 = ReturnType<typeof userDecoder7>;
  type ActualType7 =
    | {
        type: "anonymous";
        sessionId: number;
      }
    | {
        type: "registered";
        id: number;
        name: string;
      };
  expectType<TypeEqual<InferredType7, ActualType7>>(true);

  /*
   * OPTIONAL FIELD INFERENCE
   */

  // Finally, there’s one last little detail to know about: How optional fields
  // are inferred.
  const itemDecoder = fieldsAuto({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<{ title: string; description: string | undefined }>>(
    itemDecoder
  );

  // As you can see above, fields using the `optional` decoder are always inferred
  // as `key: T | undefined`, and never as `key?: T`. This means that you always
  // have to specify the optional fields:
  type Item = ReturnType<typeof itemDecoder>;
  // @ts-expect-error Property 'description' is missing in type '{ title: string; }' but required in type '{ title: string; description: string | undefined; }'.
  const item1: Item = {
    title: "Pencil",
  };
  const item1_2: Item = {
    title: "Pencil",
    description: undefined,
  };
  void item1_2;

  // This may or may not be what you want. If you have a large number of optional
  // fields and need to construct a lot of such objects in code it might be
  // convenient not having to specify all optional fields at all times. To achieve
  // that, you can use `WithUndefinedAsOptional`. It changes all `key: T |
  // undefined` to `key?: T | undefined` of an object.
  type Item2 = WithUndefinedAsOptional<ReturnType<typeof itemDecoder>>;
  // Hover over `Item2`! You should see something like this:
  //   type Item2 = {
  //       description?: string | undefined;
  //       title: string;
  //   }
  // Hovering over `itemDecoder2` should be nice too:
  const itemDecoder2 = fieldsAuto<Item2>({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<{ title: string; description?: string | undefined }>>(
    itemDecoder2
  );
  const item2: Item2 = {
    title: "Pencil",
  };
  void item2;
  const item2_1: Item2 = {
    title: "Pencil",
    description: undefined,
  };
  void item2_1;
  const item2_2: Item2 = {
    title: "Pencil",
    description: "Mighty fine writer’s tool.",
  };
  void item2_2;
  // @ts-expect-error Type '{}' is missing the following properties from type '{ title: string; description: string | undefined; }': title, description
  const item2_3: Item = {};
  void item2_3;
  const item2_4: Item = {
    title: "Pencil",
    // @ts-expect-error Object literal may only specify known properties, and 'price' does not exist in type '{ title: string; description: string | undefined; }'.
    price: 10,
  };
  void item2_4;

  // Or provide an explicit type annotation:
  type Item3 = {
    title: string;
    description?: string;
  };
  const itemDecoder3 = fieldsAuto<Item3>({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<Item3>>(itemDecoder3);
  const item3: Item3 = {
    title: "Pencil",
  };
  void item3;
});
