import { expectType, TypeEqual } from "ts-expect";

import type { Decoder, UnDecoder } from "..";

test("UnDecoder", () => {
  type OriginalType = { foo: 42; bar: ["halloj", "fågel"] };
  type DerivedType = UnDecoder<Decoder<OriginalType>>;
  expectType<TypeEqual<DerivedType, OriginalType>>(true);
});
