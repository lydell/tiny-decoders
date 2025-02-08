import { expect, test, vi } from "vitest";

import {
  array,
  Codec,
  DecoderResult,
  fields,
  flatMap,
  multi,
  record,
  recursive,
  string,
} from "../index.js";

test("recursive data structure", () => {
  // Consider this recursive data structure:
  type Person = {
    name: string;
    friends: Array<Person>;
  };

  // This wouldn’t work to decode it, because we’re trying to use
  // `personCodec` in the definition of `personCodec` itself.
  /*
  const personCodec = fields<Person>({
    name: string,
    friends: array(personCodec), // ReferenceError: Cannot access 'personCodec' before initialization
  });
  */

  // `recursive` lets us delay when `personCodec` is referenced, solving the
  // issue.
  const personCodec: Codec<Person> = fields({
    name: string,
    friends: array(recursive(() => personCodec)),
  });

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

  expect(personCodec.decoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
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
      },
    }
  `);
});

test("recurse non-record", () => {
  type Dict = { [key: string]: Dict | number };

  const dictCodec: Codec<Dict> = record(
    flatMap(multi(["number", "object"]), {
      decoder: (value): DecoderResult<Dict | number> => {
        switch (value.type) {
          case "number":
            return { tag: "Valid", value: value.value };
          case "object":
            // Thanks to the arrow function we’re in, the reference to
            // `dictCodec` is delayed and therefore works.
            return dictCodec.decoder(value.value);
        }
      },
      encoder: (value) =>
        typeof value === "number"
          ? { type: "number", value }
          : { type: "object", value },
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

  expect(dictCodec.decoder(data)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "t": {
          "i": {
            "e": 3,
            "n": {
              "t": 2,
              "y": 1,
            },
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

  const personCodec: Codec<Person> = fields({
    name: string,
    likes: recursive(() => personCodec),
  });

  const alice: Record<string, unknown> = {
    name: "Alice",
    likes: undefined,
  };

  const bob: Record<string, unknown> = {
    name: "Bob",
    likes: alice,
  };

  // Make the object circular:
  // Make the object circular:
  alice["likes"] = bob;

  // Calling the decoder would cause infinite recursion!
  // So be careful when working with recursive data!
  const wouldCauseInfiniteRecursion1: () => DecoderResult<Person> = vi.fn(() =>
    personCodec.decoder(alice),
  );

  expect(wouldCauseInfiniteRecursion1).not.toHaveBeenCalled();
});
