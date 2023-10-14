import { expect, test, vi } from "vitest";

import { array, Decoder, fields, multi, record, string } from "../";

test("recursive data structure", () => {
  // Consider this recursive data structure:
  type Person = {
    name: string;
    friends: Array<Person>;
  };

  // When using `fields` there won’t be any trouble decoding it:
  const personDecoder1 = fields(
    (field): Person => ({
      name: field("name", string),
      friends: field("friends", array(personDecoder1)),
    }),
  );

  // But when using `fieldsAuto` you’d run into problems.
  // This wouldn’t work to decode it, because we’re trying to use
  // `personDecoder` in the definition of `personDecoder` itself.
  // So, use `fields` if you need recursion.
  /*
  const personDecoder2 = fieldsAuto<Person>({
    name: string,
    friends: array(personDecoder2), // ReferenceError: Cannot access 'personDecoder2' before initialization
  });
  */

  const data: unknown = {
    name: "John",
    friends: [
      {
        name: "Alice",
        friends: [],
      },
      {
        name: "Bob",
        friends: [
          {
            name: "Charlie",
            friends: [],
          },
        ],
      },
    ],
  };

  expect(personDecoder1(data)).toMatchInlineSnapshot(`
    {
      "friends": [
        {
          "friends": [],
          "name": "Alice",
        },
        {
          "friends": [
            {
              "friends": [],
              "name": "Charlie",
            },
          ],
          "name": "Bob",
        },
      ],
      "name": "John",
    }
  `);
});

test("recurse non-record", () => {
  type Dict = { [key: string]: Dict | number };

  const dictDecoder: Decoder<Dict> = record(
    multi({
      number: (value) => value,
      // The trick here is to use a seemingly useless arrow function to delay
      // the reference to `dictDecoder`.
      object: (value) => dictDecoder(value),
      // Writing just `object: dictDecoder` would result in an error:
      // ReferenceError: Cannot access 'dictDecoder' before initialization
    }),
  );

  const data: unknown = {
    t: {
      i: {
        n: {
          y: 1,
          t: 2,
        },
        e: 3,
      },
    },
  };

  expect(dictDecoder(data)).toMatchInlineSnapshot(`
    {
      "t": {
        "i": {
          "e": 3,
          "n": {
            "t": 2,
            "y": 1,
          },
        },
      },
    }
  `);
});

test("circular objects", () => {
  // This data structure is impossible to create without mutation, because you
  // can’t create a Person without creating a Person.
  type Person = {
    name: string;
    likes: Person;
  };

  const personDecoder = fields(
    (field): Person => ({
      name: field("name", string),
      likes: field("likes", personDecoder),
    }),
  );

  const alice: Record<string, unknown> = {
    name: "Alice",
    likes: undefined,
  };

  const bob: Record<string, unknown> = {
    name: "Bob",
    likes: alice,
  };

  // Make the object circular:
  alice.likes = bob;

  // Calling the decoder would cause infinite recursion!
  // So be careful when working with recursive data!
  const wouldCauseInfiniteRecursion1: () => Person = vi.fn(() =>
    personDecoder(alice),
  );

  expect(wouldCauseInfiniteRecursion1).not.toHaveBeenCalled();
});
