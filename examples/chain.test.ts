import {expect,test} from "vitest"

import {
  array,
  chain,
  Decoder,
  fields,
  fieldsAuto,
  number,
  optional,
  string,
} from "..";

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

  // Still no problem, really:
  const objDecoder1 = fields((field) => ({
    id: field("id", string),
    numbers: new Set(field("numbers", array(number))),
  }));
  expect(objDecoder1(obj)).toMatchInlineSnapshot(`
    {
      "id": "123",
      "numbers": Set {
        1,
        2,
        3,
      },
    }
  `);

  // But what if the `numbers` field is optional?
  //
  //     field("numbers", optional(array(number)))
  //
  // You can’t call `new Set()` on that, because it might be `undefined`. `chain`
  // to the rescue! It lets you transform the result of a decoder, but still
  // returns a decoder, so it can be used with `optional`! In this case, the
  // return value of the `chain` call is a function that looks like this:
  //
  //    (value: unknown) => Set<number>
  const objDecoder2 = fields((field) => ({
    id: field("id", string),
    numbers: field(
      "numbers",
      optional(chain(array(number), (arr) => new Set(arr))),
    ),
  }));
  expect(objDecoder2(obj)).toEqual(objDecoder1(obj));

  // `chain` also comes in handy when using `fieldsAuto` (and other functions that
  // accepts decoders as arguments):
  const objDecoder3 = fieldsAuto({
    id: string,
    numbers: chain(array(number), (arr) => new Set(arr)),
  });
  expect(objDecoder3(obj)).toEqual(objDecoder1(obj));

  // With `chain`, you don’t _have_ to change the type, though. For example, you
  // could use it to round numbers.
  const decoder: Decoder<number> = chain(number, Math.round);
  expect(decoder(4.9)).toMatchInlineSnapshot(`5`);
});
