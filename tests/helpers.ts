import { expect } from "vitest";

import { Decoder, format, ReprOptions } from "..";

export function run<T>(
  decoder: Decoder<T>,
  value: unknown,
  options?: ReprOptions,
): T | string {
  const decoderResult = decoder(value);
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
