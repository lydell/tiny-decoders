// This file shows how best to annotate your `fields` and `fieldsAuto` decoders
// to maximize the help you get from TypeScript.

import { Decoder, fields, fieldsAuto, number, string } from "../";

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
  // Since TypeScript has inferred legit decoders above, it marks the following
  // two calls as errors (you can’t pass an object with `aye` as a `Person`),
  // while the _real_ errors of course are in the decoders themselves.
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personDecoder1(testPerson));
  // @ts-expect-error Property 'age' is missing in type '{ name: string; aye: number; }' but required in type 'Person'.
  greet(personDecoder1Auto(testPerson));

  // The way to make the above type errors more clear is to provide explicit type
  // annotations, so that TypeScript knows what you’re trying to do. And yes,
  // this is the recommended way of adding the type annotations for `fields` and
  // `fieldsAuto` – see the next section for why.
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
  // These would ideally complain about the extra property, but they don’t.
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

  // Finally, some compiling decoders.
  const personDecoder8 = fields(
    (field): Person => ({
      name: field("name", string),
      age: field("age", number),
    })
  );
  const personDecoder8Auto = fieldsAuto<Person>({
    name: string,
    age: number,
  });
  greet(personDecoder8(testPerson));
  greet(personDecoder8Auto(testPerson));

  expect(personDecoder8(testPerson)).toMatchInlineSnapshot(`
    Object {
      "age": 30,
      "name": "John",
    }
  `);
  expect(personDecoder8Auto(testPerson)).toMatchInlineSnapshot(`
    Object {
      "age": 30,
      "name": "John",
    }
  `);
});
