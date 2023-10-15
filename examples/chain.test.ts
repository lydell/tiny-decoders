import { expect, test } from "vitest";

import { array, chain, Decoder, fieldsAuto, number, string } from "..";

test("decoding to a Set", () => {
  // Want to turn this into a Set of numbers?
  const data: unknown = [1, 2, 1, 3, 2];

  // First decode into an array, then turn that into a set! Remember that
  // decoders are just regular functions, so you can work with their return
  // values.
  expect(new Set(array(number)(data))).toMatchInlineSnapshot(`
    Set {
      1,
      2,
      3,
    }
  `);

  // But what if that’s part of a larger structure?
  const obj: unknown = {
    id: "123",
    numbers: data,
  };

  // Now `chain` comes in handy:
  const objDecoder = fieldsAuto({
    id: string,
    numbers: chain(array(number), (arr) => new Set(arr)),
  });
  expect(objDecoder(obj)).toMatchInlineSnapshot(`
    {
      "id": "123",
      "numbers": Set {
        1,
        2,
        3,
      },
    }
  `);

  // With `chain`, you don’t _have_ to change the type, though. For example, you
  // could use it to round numbers.
  const decoder: Decoder<number> = chain(number, Math.round);
  expect(decoder(4.9)).toMatchInlineSnapshot(`5`);
});
