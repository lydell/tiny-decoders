// @flow strict

import { array, number, record, string } from "../src";

test("allowing decoders to fail", () => {
  // If you have a record, an array or a dict and a single field or item fails
  // to decode, you might not want the entire thing to fail. For example, you
  // might want to use all the data that suceeded and swap in a default value
  // for the part that failed, or skip failing items of an array. The `array`,
  // `dict`, `record` and `tuple` decoders let you specify how to handle
  // failures, and where to save error messages. (By default, they _throw_
  // errors.)

  const productDecoder = record(field => ({
    id: field("id", number),
    name: field("name", string),
    description: field("description", string, { default: "" }),
  }));

  const data: mixed = {
    id: 123,
    name: "Apple",
    description: { html: "<p>Delicious fruit.</p>" },
  };

  // Pass in an array to let the decoders push error messages (strings) to it
  // when default values are used. This let’s you know what was ignored by the
  // decoder.
  const errors = [];
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
      object["description"]: Expected a string, but got: {"html": "<p>Delici…uit.</p>"}
    at "description" in {"description": Object(1), "id": 123, "name": "Apple"},
    ]
  `);

  // For `array` and `dict` you can also skip bad values.
  const namesDecoder1 = array(string, "skip");
  const namesDecoder2 = array(string, { default: "unknown" });

  const list: mixed = ["Alice", "Bob", null, "David", { value: "Edgar" }];

  const namesErrors = [];
  expect(namesDecoder1(list, namesErrors)).toMatchInlineSnapshot(`
    Array [
      "Alice",
      "Bob",
      "David",
    ]
  `);
  expect(namesErrors).toMatchInlineSnapshot(`
    Array [
      array[2]: Expected a string, but got: null
    at 2 in ["Alice", "Bob", (index 2) null, "David", Object(1)],
      array[4]: Expected a string, but got: {"value": "Edgar"}
    at 4 in ["Alice", "Bob", null, "David", (index 4) Object(1)],
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
