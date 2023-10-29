import { expect } from "vitest";

import { Codec, format, ReprOptions } from "..";

export function run<Decoded, Encoded>(
  codec: Codec<Decoded, Encoded>,
  value: unknown,
  options?: ReprOptions,
): Decoded | string {
  const decoderResult = codec.decoder(value);
  switch (decoderResult.tag) {
    case "DecoderError":
      return format(decoderResult.error, options);
    case "Valid":
      return decoderResult.value;
  }
}

expect.addSnapshotSerializer({
  test: (value: unknown): boolean =>
    typeof value === "string" && value.includes("At root"),
  print: String,
});
