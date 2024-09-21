// This file shows how to infer types from codecs.

import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  DecoderResult,
  field,
  fields,
  Infer,
  map,
  multi,
  number,
  primitiveUnion,
  string,
} from "../index.js";
import { run } from "../tests/helpers.js";

test("making a type from a codec", () => {
  // Rather than first typing out a `type` for `Person` and then essentially
  // typing the same thing again in the codec (especially `fields` codecs
  // look almost identical to the `type` they decode to!), you can start with the
  // codec and extract the type afterwards with tiny-decoder’s `Infer` utility.
  const _personCodec = fields({
    name: string,
    age: number,
  });

  // Hover over `Person` to see what it looks like!
  type Person = Infer<typeof _personCodec>;
  expectType<TypeEqual<Person, { name: string; age: number }>>(true);

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the codec – you might find this `Infer`
  // technique interesting. With this `Infer` approach you don’t have to
  // write what your objects look like “twice.” Personally I don’t always mind
  // the “duplication,” but when you do – try out the `Infer` approach!

  // Here’s a more complex example for trying out TypeScript’s inference.
  const userCodec = fields({
    id: map(multi(["string", "number"]), {
      decoder: ({ value }) => value,
      encoder: (value) =>
        typeof value === "string"
          ? { type: "string", value }
          : { type: "number", value },
    }),
    name: string,
    age: number,
    active: boolean,
    country: field(string, { optional: true }),
    type: primitiveUnion(["user"]),
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

  const userResult: DecoderResult<User> = userCodec.decoder(data);
  expect(userResult).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "active": true,
        "age": 30,
        "id": 1,
        "name": "John Doe",
        "type": "user",
      },
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
  expect({ tag: "Valid", value: { ...user2, type: "user" } }).toMatchObject(
    userResult,
  );

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
  expect({ tag: "Valid", value: user3 }).toMatchObject(userResult);
});

test("making a type from an object and primitiveUnion", () => {
  // Imagine this being the popular `chalk` terminal coloring package.
  const chalk = {
    hex:
      (hex: string) =>
      (text: string): string =>
        `${hex}:${text}`,
  };

  const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

  type Severity = (typeof SEVERITIES)[number];

  const SEVERITY_COLORS = {
    Low: "007CBB",
    Medium: "FFA500",
    High: "E64524",
    Critical: "FF0000",
  } as const satisfies Record<Severity, string>;

  expectType<TypeEqual<Severity, "Critical" | "High" | "Low" | "Medium">>(true);

  const severityCodec = primitiveUnion(SEVERITIES);
  expectType<TypeEqual<Severity, Infer<typeof severityCodec>>>(true);
  expect(run(severityCodec, "High")).toBe("High");

  function coloredSeverity(severity: Severity): string {
    return chalk.hex(SEVERITY_COLORS[severity])(severity);
  }
  expect(coloredSeverity("Low")).toBe("007CBB:Low");
});
