// @flow strict

import { record, string } from "../src";

test("decoding mixed", () => {
  // Have a piece of data with a very generic field?
  type Message = {|
    text: string,
    data: mixed,
  |};

  const message = { text: "Hello, world!", data: 15 };

  const messageDecoder: mixed => Message = record({
    text: string,
    // All fields are already `mixed` so you can pass them through as-is.
    data: value => value,
  });
  expect((messageDecoder(message): Message)).toMatchInlineSnapshot(`
Object {
  "data": 15,
  "text": "Hello, world!",
}
`);

  // If you like, you can define one of these helper functions:
  const identity = value => value;
  const mixed = identity;

  const messageDecoder2: mixed => Message = record({
    text: string,
    // All fields are already `mixed` so you can pass them through as-is.
    data: mixed,
  });
  expect((messageDecoder2(message): Message)).toMatchInlineSnapshot(`
Object {
  "data": 15,
  "text": "Hello, world!",
}
`);
});
