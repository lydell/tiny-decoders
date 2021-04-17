import {
  array,
  Decoder,
  fields,
  fieldsAuto,
  lazy,
  multi,
  optional,
  record,
  string,
} from "../";

test("recursive data structure", () => {
  // Consider this recursive data sctructure:
  type Person = {
    name: string;
    friends: Array<Person>;
  };

  // When using `fields` there won’t be any trouble decoding it:
  const personDecoder1 = fields(
    (field): Person => ({
      name: field("name", string),
      friends: field("friends", array(personDecoder1)),
    })
  );

  // But when using `fieldsAuto` you might run into some minor problems.
  // This wouldn’t work to decode it, because we’re trying to use
  // `personDecoder` in the definition of `personDecoder` itself.
  /*
  const personDecoder2 = fieldsAuto<Person>({
    name: string,
    friends: array(personDecoder2), // ReferenceError: personDecoder2 is not defined
  });
  */

  // With `lazy` we can delay the reference to `personDecoder2`.
  // (You can of course also switch from `fieldsAuto` to `fields` instead of
  // using `lazy` if you want.)
  //
  // Unfortunately you need double type annotations:
  //
  // - `Decoder<Person>` to appease TypeScript.
  // - `fieldsAuto<Person>` to forbid accidental extra properties.
  const personDecoder2: Decoder<Person> = fieldsAuto<Person>({
    name: string,
    friends: lazy(() => array(personDecoder2)),
  });
  // @ts-expect-error 'personDecoder2_bad' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
  const personDecoder2_bad = fieldsAuto<Person>({
    name: string,
    friends: lazy(() => array(personDecoder2_bad)),
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

  expect(personDecoder1(data)).toMatchInlineSnapshot(`
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

  expect(personDecoder1(data)).toEqual(personDecoder2(data));
});

test("recurse non-record", () => {
  // In the case of records, you can switch from `fieldsAuto` to `fields` to fix
  // the recursiveness issue. But if you for example have a recursive record, you
  // _have_ to use `lazy`.

  type Dict = { [key: string]: Dict | number };

  const dictDecoder: Decoder<Dict> = record(
    multi({
      number: (value) => value,
      object: lazy(() => dictDecoder),
    })
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
    Object {
      "t": Object {
        "i": Object {
          "e": 3,
          "n": Object {
            "t": 2,
            "y": 1,
          },
        },
      },
    }
  `);
});

test("indirectly recursive data structure", () => {
  // Here’s a silly example of an indirectly recursive data structure.
  type Person = {
    name: string;
    relationship?: Relationship;
  };

  type Relationship = {
    type: string;
    person: Person;
  };

  // Again, when using `fields` you shouldn’t encounter any problems, other than
  // maybe having to disable an ESLint rule (no-use-before-define).
  const personDecoder1 = fields(
    (field): Person => ({
      name: field("name", string),
      relationship: field("relationship", optional(relationshipDecoder)),
    })
  );

  // When using `fieldsAuto`, since `relationshipDecoder` isn’t defined yet that
  // has to be lazy. You can’t re-order `personDecoder2` and
  // `relationshipDecoder` to fix the issue either – that just flips the
  // problem.
  const personDecoder2 = fieldsAuto<Person>({
    name: string,
    relationship: optional(lazy(() => relationshipDecoder)),
  });

  // This one doesn’t need `lazy` since `personDecoder1` (and `personDecoder2`)
  // is already defined.
  const relationshipDecoder = fieldsAuto<Relationship>({
    type: string,
    person: personDecoder1,
  });

  const data: unknown = {
    name: "John",
    relationship: {
      type: "fatherOf",
      person: {
        name: "Alice",
        relationship: {
          type: "sisterTo",
          person: {
            name: "Bob",
          },
        },
      },
    },
  };

  expect(personDecoder1(data)).toMatchInlineSnapshot(`
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

  expect(personDecoder1(data)).toEqual(personDecoder2(data));
});

test("circular objects", () => {
  // This data structure is impossible to create without mutation, because you
  // can’t create a Person without creating a Person.
  type Person = {
    name: string;
    likes: Person;
  };

  const personDecoder1 = fields(
    (field): Person => ({
      name: field("name", string),
      likes: field("likes", personDecoder1),
    })
  );

  const personDecoder2: Decoder<Person> = fieldsAuto<Person>({
    name: string,
    likes: lazy(() => personDecoder2),
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

  // Be careful: Calling these functions would cause infinite recursion!
  const wouldCauseInfiniteRecursion1: () => Person = jest.fn(() =>
    personDecoder1(alice)
  );
  const wouldCauseInfiniteRecursion2: () => Person = jest.fn(() =>
    personDecoder2(alice)
  );

  expect(wouldCauseInfiniteRecursion1).not.toHaveBeenCalled();
  expect(wouldCauseInfiniteRecursion2).not.toHaveBeenCalled();
});
