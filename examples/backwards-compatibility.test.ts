// This file shows how to support both and old and a new JSON format at the same time.

import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  chain,
  Codec,
  CodecOptions,
  DecoderError,
  fields,
  fieldsUnion,
  Infer,
  multi,
  number,
  optional,
  singleField,
  string,
  stringUnion,
  unknown,
} from "..";

test("looking for a field that differs", () => {
  // Imagine this `Person` type:
  type Person = {
    name: string;
    age: number;
  };

  // And its codec:
  const modernPersonCodec: Codec<Person> = fields({
    name: string,
    age: number,
  });

  // Here’s a coded for what a `Person` used to look like:
  // With separate `first_name` and `last_name` fields instead of just `name`.
  const legacyPersonCodec = fields({
    first_name: string,
    last_name: string,
    age: number,
  });

  // Let’s make a codec that can handle both.
  // The decoder is going to automatically “upgrade” to the new `Person` shape.
  // The encoder always outputs the new format.
  const personCodec: Codec<Person> = {
    // The return type annotation here makes TypeScript catch accidental
    // extra fields in the return value.
    // https://github.com/microsoft/TypeScript/issues/7547
    decoder: (value): Person => {
      // If the object has a `name` field, it’s probably the new format,
      // otherwise it’s probably the old one. This approach of having
      // some “simple” check to see if the data is “old” and “new” and then
      // committing to that gives the best (most understandable) error messages
      // when decoding fails.
      const nameField = singleField("name", optional(string)).decoder(value);

      // The `name` field exists, so use the modern codec.
      if (nameField !== undefined) {
        return modernPersonCodec.decoder(value);
      }

      // Use the legacy codec, but return a modern `Person`.
      const legacyPerson = legacyPersonCodec.decoder(value);
      return {
        name: `${legacyPerson.first_name} ${legacyPerson.last_name}`,
        age: legacyPerson.age,
      };
    },
    encoder: modernPersonCodec.encoder,
  };

  const modernData = {
    name: "John Doe",
    age: 42,
  };

  const legacyData = {
    first_name: "John",
    last_name: "Doe",
    age: 42,
  };

  expect(personCodec.decoder(modernData)).toMatchInlineSnapshot(`
    {
      "age": 42,
      "name": "John Doe",
    }
  `);
  expect(personCodec.decoder(legacyData)).toMatchInlineSnapshot(`
    {
      "age": 42,
      "name": "John Doe",
    }
  `);

  expect(personCodec.encoder(modernData)).toStrictEqual(modernData);

  // @ts-expect-error Argument of type '{ first_name: string; last_name: string; age: number; }' is not assignable to parameter of type 'Person'.
  personCodec.encoder(legacyData);
});

test("ignoring unknown tags in fieldsUnion", () => {
  function ignoreUnknownTag<Decoded, Encoded, Options extends CodecOptions>(
    codec: Codec<Decoded, Encoded, Options>,
  ): Codec<Decoded | undefined, Encoded | undefined, Options> {
    return {
      ...codec,
      decoder(value) {
        try {
          return codec.decoder(value);
        } catch (unknownError) {
          const error = DecoderError.at(unknownError);
          if (
            // If the tag is unknown…
            error.variant.tag === "unknown fieldsUnion tag" &&
            // …and it happened on the top level (not some nested `fieldsUnion`)…
            error.path.length === 1
          ) {
            // …then return `undefined` instead of failing.
            return undefined;
            // If you wanted to keep what tag we actually got,
            // you could return something other than `undefined`,
            // containing `newError.variant.got`.
          }
          throw error;
        }
      },
      encoder(value) {
        return value === undefined ? undefined : codec.encoder(value);
      },
    };
  }

  // TODO: Add nested fieldsUnion as well
  type Shape = Infer<typeof Shape>;
  const Shape = ignoreUnknownTag(
    fieldsUnion("tag", (tag) => [
      {
        tag: tag("Square"),
        size: number,
      },
      {
        tag: tag("Circle"),
        radius: number,
      },
    ]),
  );

  expect(1 + 1).toBe(2);
});
