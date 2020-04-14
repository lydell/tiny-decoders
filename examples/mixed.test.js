// @flow strict

import { type Decoder, autoRecord, string } from "../src";

test("decoding mixed", () => {
  // Have a piece of data with a very generic field?
  type Message = {
    text: string,
    data: mixed,
  };

  const message: mixed = { text: "Hello, world!", data: 15 };

  const messageDecoder1: Decoder<Message> = autoRecord({
    text: string,
    // All fields are already `mixed` so you can pass them through as-is.
    data: (value) => value,
  });
  expect((messageDecoder1(message): Message)).toMatchInlineSnapshot(`
    Object {
      "data": 15,
      "text": "Hello, world!",
    }
  `);

  // If you like, you can define one of these helper functions:
  const identity = (value) => value;
  const mixed = identity;

  const messageDecoder2: Decoder<Message> = autoRecord({
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
