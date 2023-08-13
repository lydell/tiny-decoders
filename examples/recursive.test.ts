import { expect, test, vi } from "vitest";

import {
  array,
  chain,
  Codec,
  fields,
  multi,
  record,
  recursive,
  string,
} from "../";

test("recursive data structure", () => {
  // Consider this recursive data structure:
  type Person = {
    name: string;
    friends: Array<Person>;
  };

  // The following wouldn’t work to decode it, because we’re trying to use
  // `personCodec` in the definition of `personCodec` itself.
  // So, use `fields` if you need recursion.
  /*
  const personCodecFail: Codec<Person> = fields({
    name: string,
    friends: array(personCodec2), // ReferenceError: Cannot access 'personCodec2' before initialization
  });
  /**/

  // `recursive` to the rescue! It uses an anonymous function to avoid the reference problem.
  // All it does is call that function later to get the actual codec.
  const personCodec1: Codec<Person> = fields({
    name: string,
    friends: array(recursive(() => personCodec1)),
  });

  // You can put the `recursive` at any level, it doesn’t matter:
  const personCodec2: Codec<Person> = fields({
    name: string,
    friends: recursive(() => array(personCodec2)),
  });
  const personCodec3: Codec<Person> = recursive(() =>
    fields({
      name: string,
      friends: array(personCodec3),
    }),
  );

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

  expect(personCodec1.decoder(data)).toMatchInlineSnapshot(`
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

  expect(personCodec2.decoder(data)).toStrictEqual(personCodec1.decoder(data));
  expect(personCodec3.decoder(data)).toStrictEqual(personCodec1.decoder(data));
});

test("recurse a dictionary", () => {
  type Dict = { [key: string]: Dict | number };

  // In this case we have anonymous functions anyway in `chain`, so there’s
  // no need for `recursive`.
  const dictCodec: Codec<Dict, Record<string, unknown>> = record(
    chain(multi(["number", "object"]), {
      decoder: (value) => {
        switch (value.type) {
          case "number":
            return value.value;
          case "object":
            return dictCodec.decoder(value.value);
        }
      },
      encoder: (value) => {
        if (typeof value === "number") {
          return { type: "number", value };
        } else {
          return {
            type: "object",
            value: dictCodec.encoder(value),
          };
        }
      },
    }),
  );

  const data = {
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

  expect(dictCodec.decoder(data)).toStrictEqual(data);
  expect(dictCodec.encoder(data)).toStrictEqual(data);
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
  alice.likes = bob;

  // Calling the decoder would cause infinite recursion!
  // So be careful when working with recursive data!
  const wouldCauseInfiniteRecursion1: () => Person = vi.fn(() =>
    personCodec.decoder(alice),
  );

  expect(wouldCauseInfiniteRecursion1).not.toHaveBeenCalled();
});
