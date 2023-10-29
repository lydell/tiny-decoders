import "../tests/helpers";

import { expect, test } from "vitest";

import {
  Codec,
  DecoderResult,
  fieldsAuto,
  format,
  primitiveUnion,
  string,
} from "../";

test("decode constrained", () => {
  const codec1 = fieldsAuto({
    status: string, // In a first codec, we have a pretty loose type.
  });

  const codec2 = fieldsAuto({
    status: primitiveUnion(["ok", "error"]), // In a second codec, we have a stricter type.
  });

  // `.decoder` of a codec usually accepts `unknown` – you can pass in anything.
  // This function constrains us constrain so we can only decode what the codec
  // has encoded.
  function decodeConstrained<Decoded, Encoded>(
    codec: Codec<Decoded, Encoded>,
    value: Encoded,
  ): DecoderResult<Decoded> {
    return codec.decoder(value);
  }

  const result1 = codec1.decoder({ status: "ok" });

  if (result1.tag === "DecoderError") {
    throw new Error(format(result1.error));
  }

  const result2 = decodeConstrained(codec2, result1.value);

  if (result2.tag === "DecoderError") {
    throw new Error(format(result2.error));
  }

  // With `decodeConstrained` it’s not possible to accidentally decode the wrong thing:
  // @ts-expect-error Argument of type '{ tag: "Valid"; value: { status: string; }; }' is not assignable to parameter of type '{ status: "ok" | "error"; }'.
  //   Property 'status' is missing in type '{ tag: "Valid"; value: { status: string; }; }' but required in type '{ status: "ok" | "error"; }'.
  decodeConstrained(codec2, result1);
  // @ts-expect-error Type 'number' is not assignable to type '"ok" | "error"'.
  decodeConstrained(codec2, { status: 0 });
  // @ts-expect-error Type '"other"' is not assignable to type '"ok" | "error"'.
  decodeConstrained(codec2, { status: "other" as const });

  // I’m not sure why TypeScript allows `string` to be assignable to `"ok" | "error"`,
  // but in this case it helps us since a string is what we have and want to decode further.
  const decoderResult = decodeConstrained(codec2, { status: "other" });
  expect(
    decoderResult.tag === "DecoderError"
      ? format(decoderResult.error)
      : decoderResult,
  ).toMatchInlineSnapshot(`
    At root["status"]:
    Expected one of these variants:
      "ok",
      "error"
    Got: "other"
  `);

  expect(result2.value).toStrictEqual({ status: "ok" });
});
