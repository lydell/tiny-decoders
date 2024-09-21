import { expect, test } from "vitest";

import { Codec, DecoderResult, fields, number, string } from "../index.js";

test("type annotations", () => {
  // First, a small test type and a function that receives it:
  type Person = {
    name: string;
    age: number;
  };
  function greet(personResult: DecoderResult<Person>): string {
    switch (personResult.tag) {
      case "DecoderError":
        return "Hello, troubled person!";
      case "Valid":
        return `Hello, ${personResult.value.name}!`;
    }
  }
  const testPerson: unknown = { name: "John", age: 30, aye: 0, extra: "" };

  /*
   * MISSPELLED PROPERTY
   */

  // Here’s a codec for `Person`, but without an explicit type annotation.
  // TypeScript will infer what it decodes into (try hovering `personCodec1`
  // in your editor!), but it won’t know that you intended to decode a `Person`.
  // As you can see, I’ve misspelled `age` as `aye`.
  const personCodec1 = fields({
    name: string,
    aye: number,
  });
  // Since TypeScript has inferred a legit codec above, it marks the following
  // call as an error (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ error of course is in the codec itself.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personCodec1.decoder(testPerson));

  // The way to make the above type error more clear is to provide an explicit type
  // annotation, so that TypeScript knows what you’re trying to do.
  // @ts-expect-error Type '{ name: string; aye: number; }' is not assignable to type 'Person'.
  const personCodec2: Codec<Person> = fields({
    name: string,
    aye: number,
  });
  greet(personCodec2.decoder(testPerson));

  /*
   * EXTRA PROPERTY
   */

  // TypeScript allows passing extra properties, so without type annotations
  // there are no errors:
  const personCodec3 = fields({
    name: string,
    age: number,
    extra: string,
  });
  // This would ideally complain about the extra property, but it doesn’t.
  greet(personCodec3.decoder(testPerson));

  // Adding `Codec<Person>` helps TypeScript find the error:
  // @ts-expect-error Type 'Person' is not assignable to type '{ name: string; age: number; extra: string; }'.
  const personCodec4: Codec<Person> = fields({
    name: string,
    age: number,
    extra: string,
  });
  greet(personCodec4.decoder(testPerson));

  // Finally, a compiling codec.
  const personCodec5: Codec<Person> = fields({
    name: string,
    age: number,
  });
  greet(personCodec5.decoder(testPerson));

  expect(personCodec5.decoder(testPerson)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "age": 30,
        "name": "John",
      },
    }
  `);
});
