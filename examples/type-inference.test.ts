// This file shows how to infer types from decoders.

import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  chain,
  fields,
  fieldsUnion,
  Infer,
  multi,
  number,
  optional,
  string,
  stringUnion,
} from "..";

test("making a type from a decoder", () => {
  // Rather than first writing out a `type` for `Person` and then essentially
  // writing the same thing again in the codec, you can start with the
  // codec and extract the type afterwards with tiny-decoder’s `Infer` utility.
  const personCodec1 = fields({
    name: string,
    age: number,
  });

  // Hover over `Person1` to see what it looks like!
  type Person1 = Infer<typeof personCodec1>;
  expectType<TypeEqual<Person1, { name: string; age: number }>>(true);

  // A little sanity check that it actually works:
  const testPerson: unknown = { name: "John", age: 30 };
  function greet(person: Person1): string {
    return `Hello, ${person.name}!`;
  }
  greet(personCodec1.decoder(testPerson));

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the codec – you might find this `Infer`
  // technique interesting. With this approach you don’t have to
  // write what your objects look like “twice.” Personally I don’t always mind
  // the “duplication,” but when you do – try out the `Infer` approach!

  // Here’s a more complex example for trying out TypeScript’s inference.
  const userCodec = fields({
    id: chain(multi(["string", "number"]), {
      decoder: (value) => value.value,
      encoder: (value) =>
        typeof value === "string"
          ? { type: "string", value }
          : { type: "number", value },
    }),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
    type: stringUnion(["user"]),
  });

  // Then, let TypeScript infer the `User` type!
  type User = Infer<typeof userCodec>;
  // Try hovering over `User` in the line above – your editor should reveal the
  // exact shape of the type.

  const data: unknown = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    type: "user",
  };

  const user: User = userCodec.decoder(data);
  expect(user).toMatchInlineSnapshot(`
    {
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
});

test("making a type from a codec – unions", () => {
  // Let’s say we need to support two types of users – anonymous and registered
  // ones. This is a job for `fieldsUnion`!
  const userCodec = fieldsUnion("type", (type) => [
    {
      type: type("anonymous"),
      sessionId: number,
    },
    {
      type: type("registered"),
      id: number,
      name: string,
    },
  ]);
  type InferredType1 = Infer<typeof userCodec>;
  type ExpectedType1 =
    | { type: "anonymous"; sessionId: number }
    | { type: "registered"; id: number; name: string };
  expectType<TypeEqual<InferredType1, ExpectedType1>>(true);

  expect(userCodec.decoder({ type: "anonymous", sessionId: 1 }))
    .toMatchInlineSnapshot(`
      {
        "sessionId": 1,
        "type": "anonymous",
      }
    `);
});

test("making a type from an object and stringUnion", () => {
  // Imagine this being the popular `chalk` terminal coloring package.
  const chalk = {
    hex:
      (hex: string) =>
      (text: string): string =>
        `${hex}:${text}`,
  };

  // An object with severity names and a corresponding color.
  const SEVERITIES = {
    Low: "007CBB",
    Medium: "FFA500",
    High: "E64524",
    Critical: "FF0000",
  } as const;

  // Create a type from the object, for just the severity names.
  type Severity = keyof typeof SEVERITIES;
  expectType<TypeEqual<Severity, "Critical" | "High" | "Low" | "Medium">>(true);

  // Make a decoder for the severity names out of the object.
  // The values in the object passed to `stringUnion` are typically `null`,
  // but this is a good use case for allowing other values (strings in this case).
  // TypeScript types the return value of `Object.keys` as `Array<string>` on purpose
  // (see https://github.com/microsoft/TypeScript/issues/45390), so we need a type
  // assertion in this case.
  const severityCodec = stringUnion(Object.keys(SEVERITIES) as Array<Severity>);
  expectType<TypeEqual<Severity, Infer<typeof severityCodec>>>(true);
  expect(severityCodec.decoder("High")).toBe("High");

  // Use the object to color text.
  function coloredSeverity(severity: Severity): string {
    return chalk.hex(SEVERITIES[severity])(severity);
  }
  expect(coloredSeverity("Low")).toBe("007CBB:Low");
});
