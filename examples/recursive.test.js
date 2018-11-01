// @flow
import { array, lazy, optional, record, string } from "../src";

test("recursive data structure", () => {
  // Consider this recursive data sctructure:
  type Person = {|
    name: string,
    friends: Array<Person>,
  |};

  // This wouldn't work to decode it, because we're trying to use
  // `personDecoder` in the definition of `personDecoder` itself.
  /*
  const personDecoder: mixed => Person = record({
    name: string,
    friends: array(personDecoder), // ReferenceError: personDecoder is not defined
  });
  */

  // With `lazy` we can delay the reference to `personDecoder`.
  const personDecoder: mixed => Person = record({
    name: string,
    friends: lazy(() => array(personDecoder)),
  });

  const data: mixed = {
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

  expect(personDecoder(data)).toMatchInlineSnapshot(`
Object {
  "friends": Array [
    Object {
      "friends": Array [],
      "name": "Alice",
    },
    Object {
      "friends": Array [
        Object {
          "friends": Array [],
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

test("indirectly recursive data structure", () => {
  // Here's a silly example of an indirectly recursive data structure.
  type Person = {|
    name: string,
    // eslint-disable-next-line no-use-before-define
    relationship: ?Relationship,
  |};

  type Relationship = {|
    type: string,
    person: Person,
  |};

  // This time, `relationshipDecoder` isn't defined yet, so that has to be lazy.
  // You can re-order `personDecoder` and `relationshipDecoder` to fix the issue
  // either – that just flips the problem.
  const personDecoder: mixed => Person = record({
    name: string,
    // eslint-disable-next-line no-use-before-define
    relationship: optional(lazy(() => relationshipDecoder)),
  });

  // This one doesn't need `lazy` since `personDecoder` was just defined.
  const relationshipDecoder: mixed => Relationship = record({
    type: string,
    person: personDecoder,
  });

  const data: mixed = {
    name: "John",
    relationship: {
      type: "fatherOf",
      person: {
        name: "Alice",
        relationship: {
          type: "sisterTo",
          person: {
            name: "Bob",
            relationship: null,
          },
        },
      },
    },
  };

  expect(personDecoder(data)).toMatchInlineSnapshot(`
Object {
  "name": "John",
  "relationship": Object {
    "person": Object {
      "name": "Alice",
      "relationship": Object {
        "person": Object {
          "name": "Bob",
          "relationship": undefined,
        },
        "type": "sisterTo",
      },
    },
    "type": "fatherOf",
  },
}
`);
});

test("circular objects", () => {
  // This data structure is impossible to create without mutation, because you
  // can't create a Person without creating a Person.
  type Person = {|
    name: string,
    likes: Person,
  |};

  const personDecoder: mixed => Person = record({
    name: string,
    likes: lazy(() => personDecoder),
  });

  const alice = {
    name: "Alice",
    likes: undefined,
  };

  const bob = {
    name: "Bob",
    likes: alice,
  };

  // Make the object circular:
  alice.likes = bob;

  // Be careful: Calling this function would cause infinite recursion!
  const wouldCauseInfiniteRecursion: () => Person = jest.fn(() =>
    personDecoder(alice)
  );

  expect(wouldCauseInfiniteRecursion).not.toHaveBeenCalled();
});
