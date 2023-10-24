import { expect, test } from "vitest";

import { Decoder, fieldsAuto, string } from "../";

test("decoding unknown values", () => {
  // Have a piece of data with a very generic field?
  type Message = {
    text: string;
    data: unknown;
  };

  const message: unknown = { text: "Hello, world!", data: 15 };

  const messageDecoder1: Decoder<Message> = fieldsAuto({
    text: string,
    // All fields are already `unknown` so you can pass them through as-is.
    data: (value) => ({ tag: "Valid", value }),
  });
  expect(messageDecoder1(message)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "data": 15,
        "text": "Hello, world!",
      },
    }
  `);

  // If you like, you can define this helper function:
  const unknown: Decoder<unknown> = (value) => ({ tag: "Valid", value });

  const messageDecoder2: Decoder<Message> = fieldsAuto({
    text: string,
    data: unknown,
  });
  expect(messageDecoder2(message)).toMatchInlineSnapshot(`
    {
      "tag": "Valid",
      "value": {
        "data": 15,
        "text": "Hello, world!",
      },
    }
  `);
});
