// This file shows how best to annotate your `fields` and `fieldsAuto` decoders
// to maximize the help you get from TypeScript.

import { expect, test } from "vitest";

import { Decoder, DecoderResult, fieldsAuto, number, string } from "../";

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

  // Here’s a decoder for `Person`, but without an explicit type annotation.
  // TypeScript will infer what they decode into (try hovering `personDecoder1`
  // in your editor!), but it won’t know that you intended to decode a `Person`.
  // As you can see, I’ve misspelled `age` as `aye`.
  const personDecoder1 = fieldsAuto({
    name: string,
    aye: number,
  });
  // Since TypeScript has inferred a legit decoder above, it marks the following
  // call as an error (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ error of course is in the decoder itself.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personDecoder1(testPerson));

  // The way to make the above type error more clear is to provide an explicit type
  // annotation, so that TypeScript knows what you’re trying to do.
  // @ts-expect-error Type 'Decoder<{ name: string; aye: number; }, unknown>' is not assignable to type 'Decoder<Person>'.
  //   Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.ts(2322)
  const personDecoder2: Decoder<Person> = fieldsAuto({
    name: string,
    aye: number,
  });
  greet(personDecoder2(testPerson));

  /*
   * EXTRA PROPERTY
   */

  // TypeScript allows passing extra properties, so without type annotations
  // there are no errors:
  const personDecoder3 = fieldsAuto({
    name: string,
    age: number,
    extra: string,
  });
  // This would ideally complain about the extra property, but it doesn’t.
  greet(personDecoder3(testPerson));

  // Adding `Decoder<Person>` does not seem to help TypeScript find any errors:
  const personDecoder4: Decoder<Person> = fieldsAuto({
    name: string,
    age: number,
    extra: string,
  });
  greet(personDecoder4(testPerson));

  // This is currently not an error unfortunately, but in a future version of tiny-decoders it will be.
  const personDecoder5: Decoder<Person> = fieldsAuto({
    name: string,
    age: number,
    // Here is where the error will be.
    extra: string,
  });
  greet(personDecoder5(testPerson));
  // See these TypeScript issues for more information:
  // https://github.com/microsoft/TypeScript/issues/7547
  // https://github.com/microsoft/TypeScript/issues/18020

  // Finally, a compiling decoder.
  const personDecoder6: Decoder<Person> = fieldsAuto({
    name: string,
    age: number,
  });
  greet(personDecoder6(testPerson));

  expect(personDecoder6(testPerson)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "age": 30,
        "name": "John",
      },
    }
  `);
});
