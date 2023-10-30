import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  Codec,
  fieldsAuto,
  Infer,
  InferEncoded,
  number,
  string,
  tag,
  taggedUnion,
} from "../";
import { run } from "../tests/helpers";

test("taggedUnion with common fields", () => {
  // This function takes two codecs for object types and returns
  // a new codec which is the intersection of those.
  // This function is not part of the tiny-decoders package because it has some caveats:
  // - If either codec uses `{ allowExtraFields: false }`, it fails.
  // - It’s not possible to disallow extra fields on the resulting codec.
  // - It’s type wise possible to intersect with a `Record`, but what does that mean?
  function intersection<
    Decoded1 extends Record<string, unknown>,
    Encoded1 extends Record<string, unknown>,
    Decoded2 extends Record<string, unknown>,
    Encoded2 extends Record<string, unknown>,
  >(
    codec1: Codec<Decoded1, Encoded1>,
    codec2: Codec<Decoded2, Encoded2>,
  ): Codec<Decoded1 & Decoded2, Encoded1 & Encoded2> {
    return {
      decoder: (value) => {
        const decoderResult1 = codec1.decoder(value);
        if (decoderResult1.tag === "DecoderError") {
          return decoderResult1;
        }
        const decoderResult2 = codec2.decoder(value);
        if (decoderResult2.tag === "DecoderError") {
          return decoderResult2;
        }
        return {
          tag: "Valid",
          value: {
            ...decoderResult1.value,
            ...decoderResult2.value,
          },
        };
      },
      encoder: (event) => ({
        ...codec1.encoder(event),
        ...codec2.encoder(event),
      }),
    };
  }

  type EventWithPayload = Infer<typeof EventWithPayload>;
  const EventWithPayload = taggedUnion("event", [
    {
      event: tag("opened"),
      payload: string,
    },
    {
      event: tag("closed"),
      payload: number,
    },
    {
      event: tag("reopened", { renameTagFrom: "undo_closed" }),
      payload: boolean,
    },
  ]);

  type EventMetadata = Infer<typeof EventMetadata>;
  const EventMetadata = fieldsAuto({
    id: string,
    timestamp: string,
  });

  type Event = Infer<typeof Event>;
  const Event = intersection(EventMetadata, EventWithPayload);

  expectType<
    TypeEqual<
      Event,
      {
        id: string;
        timestamp: string;
      } & (
        | {
            event: "closed";
            payload: number;
          }
        | {
            event: "opened";
            payload: string;
          }
        | {
            event: "reopened";
            payload: boolean;
          }
      )
    >
  >(true);

  expectType<
    TypeEqual<
      InferEncoded<typeof Event>,
      {
        id: string;
        timestamp: string;
      } & (
        | {
            event: "closed";
            payload: number;
          }
        | {
            event: "opened";
            payload: string;
          }
        | {
            event: "undo_closed";
            payload: boolean;
          }
      )
    >
  >(true);

  expect(
    run(Event, {
      id: "1",
      timestamp: "2023-10-29",
      event: "undo_closed",
      payload: true,
    }),
  ).toStrictEqual({
    id: "1",
    timestamp: "2023-10-29",
    event: "reopened",
    payload: true,
  });

  expect(
    Event.encoder({
      id: "1",
      timestamp: "2023-10-29",
      event: "reopened",
      payload: true,
    }),
  ).toStrictEqual({
    id: "1",
    timestamp: "2023-10-29",
    event: "undo_closed",
    payload: true,
  });

  expect(
    run(Event, {
      timestamp: "2023-10-29",
      event: "undo_closed",
      payload: true,
    }),
  ).toMatchInlineSnapshot(`
    At root:
    Expected an object with a field called: "id"
    Got: {
      "timestamp": "2023-10-29",
      "event": "undo_closed",
      "payload": true
    }
  `);

  expect(
    run(Event, {
      id: "1",
      timestamp: "2023-10-29",
      event: "other",
      payload: true,
    }),
  ).toMatchInlineSnapshot(`
    At root["event"]:
    Expected one of these tags:
      "opened",
      "closed",
      "undo_closed"
    Got: "other"
  `);
});
