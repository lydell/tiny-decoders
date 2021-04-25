import { array, DecoderError, fields, number, string } from "..";

expect.addSnapshotSerializer({
  test: (value: unknown): boolean =>
    typeof value === "string" && value.includes("At root"),
  print: String,
});

test("tolerant decoding", () => {
  // If you have an object or array and a single field or item fails to decode,
  // you might not want the entire thing to fail. For example, you might want to
  // use all the data that suceeded and swap in a default value for the part
  // that failed, or skip failing items of an array. The `array`, `record` and
  // `fields` decoders let you specify how to handle failures, and where to save
  // error messages. (By default, they _throw_ errors.)

  const productDecoder = fields((field) => ({
    id: field("id", number),
    name: field("name", string),
    description: field("description", string, { mode: { default: "" } }),
  }));

  const data: unknown = {
    id: 123,
    name: "Apple",
    description: { html: "<p>Delicious fruit.</p>" },
  };

  // Pass in an array to let the decoders push `DecoderError`s to it when
  // default values are used. This let’s you know what was ignored by the
  // decoder.
  const errors: Array<DecoderError> = [];
  const product = productDecoder(data, errors);

  expect(product).toMatchInlineSnapshot(`
    Object {
      "description": "",
      "id": 123,
      "name": "Apple",
    }
  `);
  // Jest’s snapshots show the errors as `TypeError`. `DecoderError` subclasses `TypeError`.
  expect(errors.map((error) => error.format()).join("\n\n"))
    .toMatchInlineSnapshot(`
    At root["description"]:
    Expected a string
    Got: {"html": "<p>Delici…ruit.</p>"}
  `);
  for (const error of errors) {
    expect(error).toBeInstanceOf(DecoderError);
  }

  // For `array` and `record` you can also skip bad values.
  const namesDecoder1 = array(string, { mode: "skip" });
  const namesDecoder2 = array(string, { mode: { default: "unknown" } });

  const list: unknown = ["Alice", "Bob", null, "David", { value: "Edgar" }];

  const namesErrors: Array<DecoderError> = [];
  expect(namesDecoder1(list, namesErrors)).toMatchInlineSnapshot(`
    Array [
      "Alice",
      "Bob",
      "David",
    ]
  `);
  expect(namesErrors.map((error) => error.format()).join("\n\n"))
    .toMatchInlineSnapshot(`
    At root[2]:
    Expected a string
    Got: null

    At root[4]:
    Expected a string
    Got: {"value": "Edgar"}
  `);
  expect(namesDecoder2(list)).toMatchInlineSnapshot(`
    Array [
      "Alice",
      "Bob",
      "unknown",
      "David",
      "unknown",
    ]
  `);
});
