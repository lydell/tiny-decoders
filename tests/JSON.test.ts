import { describe, expect, test } from "vitest";

import {
  DecoderResult,
  field,
  fields,
  format,
  JSON,
  map,
  number,
  string,
  unknown,
} from "..";

expect.addSnapshotSerializer({
  test: (value: unknown): boolean => typeof value === "string",
  print: String,
});

function helper<Decoded>(
  decoderResult: DecoderResult<Decoded>,
): Decoded | string {
  switch (decoderResult.tag) {
    case "DecoderError":
      return format(decoderResult.error).replace(
        /(SyntaxError:) .+/,
        // To avoid slightly different error messages on different Node.js versions.
        "$1 (the JSON parse error)",
      );
    case "Valid":
      return decoderResult.value;
  }
}

describe("JSON.parse", () => {
  test("basic", () => {
    const codec = fields({
      lastName: field(string, { renameFrom: "last_name" }),
      port: map(number, {
        decoder: (value) => ({ tag: "Port" as const, value }),
        encoder: (value) => value.value,
      }),
    });

    expect(helper(JSON.parse(codec, `{"last_name": "Doe", "port": 1234}`)))
      .toMatchInlineSnapshot(`
      {
        lastName: Doe,
        port: {
          tag: Port,
          value: 1234,
        },
      }
    `);

    expect(helper(JSON.parse(codec, `{"lastName": "Doe", "port": 1234}`)))
      .toMatchInlineSnapshot(`
      At root:
      Expected an object with a field called: "last_name"
      Got: {
        "lastName": "Doe",
        "port": 1234
      }
    `);

    expect(helper(JSON.parse(codec, `{"last_name": "Doe", "port": 1234`)))
      .toMatchInlineSnapshot(`
        At root:
        SyntaxError: (the JSON parse error)
      `);
  });
});

describe("JSON.stringify", () => {
  test("basic", () => {
    const codec = fields({
      lastName: field(string, { renameFrom: "last_name" }),
      port: map(number, {
        decoder: (value) => ({ tag: "Port" as const, value }),
        encoder: (value) => value.value,
      }),
    });

    expect(
      JSON.stringify(
        codec,
        {
          lastName: "Doe",
          port: { tag: "Port" as const, value: 1234 },
        },
        2,
      ),
    ).toMatchInlineSnapshot(`
      {
        "last_name": "Doe",
        "port": 1234
      }
    `);
  });

  test("tab", () => {
    expect(JSON.stringify(unknown, [1], "\t")).toBe("[\n\t1\n]");
  });

  test("always returns a string", () => {
    expect(JSON.stringify(unknown, undefined)).toMatchInlineSnapshot("null");
    expect(JSON.stringify(unknown, Symbol())).toMatchInlineSnapshot("null");
    expect(JSON.stringify(unknown, Function.prototype)).toMatchInlineSnapshot(
      "null",
    );
  });
});
