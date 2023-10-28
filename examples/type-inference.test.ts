// This file shows how to infer types from decoders.

import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  DecoderResult,
  field,
  fieldsAuto,
  Infer,
  map,
  multi,
  number,
  string,
  stringUnion,
} from "..";
import { run } from "../tests/helpers";

test("making a type from a decoder", () => {
  // Rather than first typing out a `type` for `Person` and then essentially
  // typing the same thing again in the decoder (especially `fieldsAuto` decoders
  // look almost identical to `type` they decode to!), you can start with the
  // decoder and extract the type afterwards with tiny-decoder’s `Infer` utility.
  const personDecoder = fieldsAuto({
    name: string,
    age: number,
  });

  // Hover over `Person` to see what it looks like!
  type Person = Infer<typeof personDecoder>;
  expectType<TypeEqual<Person, { name: string; age: number }>>(true);

  // If it feels like you are specifying everything twice – once in a `type` or
  // `interface`, and once in the decoder – you might find this `Infer`
  // technique interesting. But this `Infer` approach you don’t have to
  // write what your records look like “twice.” Personally I don’t always mind
  // the “duplication,” but when you do – try out the `Infer` approach!

  // Here’s a more complex example for trying out TypeScript’s inference.
  const userDecoder = fieldsAuto({
    id: map(multi(["string", "number"]), ({ value }) => value),
    name: string,
    age: number,
    active: boolean,
    country: field(string, { optional: true }),
    type: stringUnion(["user"]),
  });

  // Then, let TypeScript infer the `User` type!
  type User = Infer<typeof userDecoder>;
  // Try hovering over `User` in the line above – your editor should reveal the
  // exact shape of the type.

  const data: unknown = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    type: "user",
  };

  const userResult: DecoderResult<User> = userDecoder(data);
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

test("making a type from an object and stringUnion", () => {
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

  const severityDecoder = stringUnion(SEVERITIES);
  expectType<TypeEqual<Severity, Infer<typeof severityDecoder>>>(true);
  expect(run(severityDecoder, "High")).toBe("High");

  function coloredSeverity(severity: Severity): string {
    return chalk.hex(SEVERITY_COLORS[severity])(severity);
  }
  expect(coloredSeverity("Low")).toBe("007CBB:Low");
});
