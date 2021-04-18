// This file shows how to use `WithUndefinedAsOptional` to customize how
// optional fields work.

import { expectType } from "ts-expect";

import {
  Decoder,
  fieldsAuto,
  optional,
  string,
  WithUndefinedAsOptional,
} from "..";

test("optional fields", () => {
  // A decoder with an optional field:
  const itemDecoder = fieldsAuto({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<{ title: string; description: string | undefined }>>(
    itemDecoder
  );

  // As you can see above, fields using the `optional` decoder are always inferred
  // as `key: T | undefined`, and never as `key?: T`. This means that you always
  // have to specify the optional fields:
  type Item = ReturnType<typeof itemDecoder>;
  // @ts-expect-error Property 'description' is missing in type '{ title: string; }' but required in type '{ title: string; description: string | undefined; }'.
  const item1: Item = {
    title: "Pencil",
  };
  const item1_2: Item = {
    title: "Pencil",
    description: undefined,
  };
  void item1_2;

  // This may or may not be what you want. If you have a large number of optional
  // fields and need to construct a lot of such objects in code it might be
  // convenient not having to specify all optional fields at all times. To achieve
  // that, you can use `WithUndefinedAsOptional`. It changes all `key: T |
  // undefined` to `key?: T | undefined` of an object.
  type Item2 = WithUndefinedAsOptional<ReturnType<typeof itemDecoder>>;
  // Hover over `Item2`! You should see something like this:
  //   type Item2 = {
  //       description?: string | undefined;
  //       title: string;
  //   }
  // Hovering over `itemDecoder2` should be nice too:
  const itemDecoder2 = fieldsAuto<Item2>({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<{ title: string; description?: string | undefined }>>(
    itemDecoder2
  );
  const item2: Item2 = {
    title: "Pencil",
  };
  void item2;
  const item2_1: Item2 = {
    title: "Pencil",
    description: undefined,
  };
  void item2_1;
  const item2_2: Item2 = {
    title: "Pencil",
    description: "Mighty fine writer’s tool.",
  };
  void item2_2;
  // @ts-expect-error Type '{}' is missing the following properties from type '{ title: string; description: string | undefined; }': title, description
  const item2_3: Item = {};
  void item2_3;
  const item2_4: Item = {
    title: "Pencil",
    // @ts-expect-error Object literal may only specify known properties, and 'price' does not exist in type '{ title: string; description: string | undefined; }'.
    price: 10,
  };
  void item2_4;

  // Or provide an explicit type annotation:
  type Item3 = {
    title: string;
    description?: string;
  };
  const itemDecoder3 = fieldsAuto<Item3>({
    title: string,
    description: optional(string),
  });
  expectType<Decoder<Item3>>(itemDecoder3);
  const item3: Item3 = {
    title: "Pencil",
  };
  void item3;

  expect(itemDecoder3({ title: "Keyboard" })).toMatchInlineSnapshot(`
    Object {
      "description": undefined,
      "title": "Keyboard",
    }
  `);
});
