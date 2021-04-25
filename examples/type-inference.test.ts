// This file shows how to infer types from decoders.

import { expectType, TypeEqual } from "ts-expect";

import {
  boolean,
  DecoderError,
  fields,
  fieldsAuto,
  fieldsUnion,
  multi,
  number,
  optional,
  string,
  stringUnion,
} from "..";

test("making a type from a decoder", () => {
  // Rather than first typing out a `type` for `Person` and then essentially
  // typing the same thing again in the decoder (especially `fieldsAuto` decoders
  // look almost identical to `type` they decode to!), you can start with the
  // decoder and extract the type afterwards with TypeScript’s `ReturnType` utility.
  const personDecoder1 = fields((field) => ({
    name: field("name", string),
    age: field("age", number),
  }));
  const personDecoder1Auto = fieldsAuto({
    name: string,
    age: number,
  });

  // Hover over `Person1` to see what it looks like!
  type Person1 = ReturnType<typeof personDecoder1>;
  expectType<TypeEqual<Person1, { name: string; age: number }>>(true);

  // Hover over `Person1Auto` to see what it looks like!
  type Person1Auto = ReturnType<typeof personDecoder1Auto>;
  expectType<TypeEqual<Person1Auto, { name: string; age: number }>>(true);

  // A little sanity check that it actually works:
  const testPerson: unknown = { name: "John", age: 30 };
  function meet(personA: Person1, personB: Person1Auto): string {
    return `${personA.name} meets ${personB.name}`;
  }
  meet(personDecoder1(testPerson), personDecoder1Auto(testPerson));

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the decoder – you might find this `ReturnType`
  // technique interesting. But this `ReturnType` approach you don’t have to
  // write what your records look like “twice.” Personally I don’t always mind
  // the “duplication,” but when you do – try out the `ReturnType` approach!

  // Here’s a more complex example for trying out TypeScript’s inference.
  const userDecoder = fieldsAuto({
    // For some reason `id` becomes `unknown` when using `fieldsAuto`, but not
    // when using `fields` (see further down).
    id: multi({ string, number }),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
    type: stringUnion({ user: null }),
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
    type: field("type", stringUnion({ user: null })),
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
});

test("making a type from a decoder – unions", () => {
  // Let’s say we need to support two types of users – anonymous and registered
  // ones. This is where `fieldsUnion` shines! It’s both easier to use and gives
  // a better inferred type!
  const userDecoder1 = fieldsUnion("type", {
    anonymous: fieldsAuto({
      type: () => "anonymous" as const,
      sessionId: number,
    }),
    registered: fieldsAuto({
      type: () => "registered" as const,
      id: number,
      name: string,
    }),
  });
  type InferredType1 = ReturnType<typeof userDecoder1>;
  type ExpectedType1 =
    | { type: "anonymous"; sessionId: number }
    | { type: "registered"; id: number; name: string };
  expectType<TypeEqual<InferredType1, ExpectedType1>>(true);

  // For comparison, let’s do the same decoder “manually”.
  // This might not be super interesting – but I’ve kept this “TypeScript
  // research” for my future self.
  // Unfortunately, TypeScript doesn’t infer the type you might have expected:
  const userDecoder2 = fields((field) => {
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
  type InferredType2 = ReturnType<typeof userDecoder2>;
  type ActualType2 =
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
  expectType<TypeEqual<InferredType2, ActualType2>>(true);

  // To turn `type: string` into `type: "anonymous"` and `type: "registered"`, add
  // `as const`:
  const userDecoder3 = fields((field) => {
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
  type InferredType3 = ReturnType<typeof userDecoder3>;
  type ActualType3 =
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
  expectType<TypeEqual<InferredType3, ActualType3>>(true);

  // However, `id?: undefined` and similar are still part of the type. They don’t
  // hurt super much when it comes to type safety. They are optional fields that
  // only are allowed to be set to `undefined` – you can’t do much with that.
  // However, they do clutter tooltips and autocomplete in your editor.
  const testUser = userDecoder3({ type: "anonymous", sessionId: 123 });
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
  const userDecoder4 = fields((field) => {
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
  type InferredType4 = ReturnType<typeof userDecoder4>;
  type ActualType4 =
    | {
        type: "anonymous";
        sessionId: number;
      }
    | {
        type: "registered";
        id: number;
        name: string;
      };
  expectType<TypeEqual<InferredType4, ActualType4>>(true);

  // Another way is to write separate decoders for each case.
  // Note how I disabled the explicit-function-return-type rule – inferring the
  // type is the whole point, and having to disable ESLint rules is annoying…
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function getUserDecoder(type: unknown) {
    switch (type) {
      case "anonymous":
        return fields((field) => ({
          type: "anonymous" as const,
          sessionId: field("sessionId", number),
        }));

      case "registered":
        // You can also use `fieldsAuto`:
        return fieldsAuto({
          type: () => "registered" as const,
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
  // _new_ decoder, which we immediately call.
  const userDecoder5 = fields((field, obj, errors) =>
    field("type", getUserDecoder)(obj, errors)
  );
  type InferredType5 = ReturnType<typeof userDecoder5>;
  type ActualType5 =
    | {
        type: "anonymous";
        sessionId: number;
      }
    | {
        type: "registered";
        id: number;
        name: string;
      };
  expectType<TypeEqual<InferredType5, ActualType5>>(true);

  expect(userDecoder5({ type: "anonymous", sessionId: 1 }))
    .toMatchInlineSnapshot(`
      Object {
        "sessionId": 1,
        "type": "anonymous",
      }
    `);
});
