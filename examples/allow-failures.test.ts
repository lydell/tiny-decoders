import { array, DecoderError, fields, number, string } from "../";

test("allowing decoders to fail", () => {
  // If you have a record, an array or a dict and a single field or item fails
  // to decode, you might not want the entire thing to fail. For example, you
  // might want to use all the data that suceeded and swap in a default value
  // for the part that failed, or skip failing items of an array. The `array`,
  // `dict` and `fields` decoders let you specify how to handle failures, and
  // where to save error messages. (By default, they _throw_ errors.)

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
  expect(errors).toMatchInlineSnapshot(`
    Array [
      [TypeError: Expected a string
    Got: {"html": string}],
    ]
  `);
  // Jest’s snapshots show the errors as `TypeError`. `DecoderError` subclasses `TypeError`.
  for (const error of errors) {
    expect(error).toBeInstanceOf(DecoderError);
  }

  // For `array` and `dict` you can also skip bad values.
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
  expect(namesErrors).toMatchInlineSnapshot(`
    Array [
      [TypeError: Expected a string
    Got: null],
      [TypeError: Expected a string
    Got: {"value": string}],
    ]
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
