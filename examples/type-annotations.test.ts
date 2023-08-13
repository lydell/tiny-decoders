// This file shows how best to annotate your `fields` and `fieldsAuto` decoders
// to maximize the help you get from TypeScript.

import { expect, test } from "vitest";

import { Codec, fields, number, string } from "../";

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

  // Here’s a codec for `Person`, but without explicit type annotation.
  // TypeScript will infer what they decode into (try hovering `personDecoder1`
  // in your editor!), but it won’t know that you intended to decode a `Person`.
  // As you can see, I’ve misspelled `age` as `aye`.
  const personCodec1 = fields({
    name: string,
    aye: number,
  });
  // Since TypeScript has inferred a legit codec above, it marks the following
  // two calls as errors (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ errors of course are in the codecs themselves.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personCodec1.decoder(testPerson));

  // One way to make the above type errors more clear is to provide explicit type
  // annotations, so that TypeScript knows what you’re trying to do.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  const personCodec2: Codec<Person> = fields({
    name: string,
    aye: number,
  });
  greet(personCodec2.decoder(testPerson));

  // The other way is to instead let the codec be the source of truth, and derive the type from it.
  // See `./type-inference.test.ts`.

  /*
   * EXTRA PROPERTY
   */

  // TypeScript allows passing extra properties, so without type annotations
  // there are no errors:
  const personDecoder5 = fields({
    name: string,
    age: number,
    extra: string,
  });
  // This would ideally complain about the extra property, but it doesn’t.
  greet(personDecoder5.decoder(testPerson));

  // Adding `Codec<Person>` helps TypeScript find errors!
  // @ts-expect-error Property 'extra' is missing in type 'Person' but required in type '{ name: string; age: number; extra: string; }'.
  const personDecoder6: Codec<Person> = fields({
    name: string,
    age: number,
    extra: string,
  });
  greet(personDecoder6.decoder(testPerson));

  // Finally, some codecs that do compile.
  const personDecoder8: Codec<Person> = fields({
    name: string,
    age: number,
  });
  greet(personDecoder8.decoder(testPerson));

  expect(personDecoder8.decoder(testPerson)).toMatchInlineSnapshot(`
    {
      "age": 30,
      "name": "John",
    }
  `);
});
