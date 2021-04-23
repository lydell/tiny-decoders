import { fieldsAuto, string } from "../";

test("decoding unknown values", () => {
  // Have a piece of data with a very generic field?
  type Message = {
    text: string;
    data: unknown;
  };

  const message: unknown = { text: "Hello, world!", data: 15 };

  const messageDecoder1 = fieldsAuto<Message>({
    text: string,
    // All fields are already `unknown` so you can pass them through as-is.
    data: (value) => value,
  });
  expect(messageDecoder1(message)).toMatchInlineSnapshot(`
    Object {
      "data": 15,
      "text": "Hello, world!",
    }
  `);

  // If you like, you can define one of these helper functions:
  const identity = <T>(value: T): T => value;
  const unknown = identity;

  const messageDecoder2 = fieldsAuto<Message>({
    text: string,
    data: unknown,
  });
  expect(messageDecoder2(message)).toMatchInlineSnapshot(`
    Object {
      "data": 15,
      "text": "Hello, world!",
    }
  `);
});
