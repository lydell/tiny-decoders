import { expectType, TypeEqual } from "ts-expect";
import { expect, test } from "vitest";

import {
  boolean,
  Codec,
  DecoderResult,
  fieldsAuto,
  fieldsUnion,
  Infer,
  InferEncoded,
  number,
  string,
  tag,
} from "../";
import { run } from "../tests/helpers";

test("fieldsUnion with common fields", () => {
  type EventWithPayload = Infer<typeof EventWithPayload>;
  const EventWithPayload = fieldsUnion("event", [
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

  type EncodedEvent = InferEncoded<typeof EventMetadata> &
    InferEncoded<typeof EventWithPayload>;

  type Event = EventMetadata & EventWithPayload;

  const Event: Codec<Event, EncodedEvent> = {
    decoder: (value: unknown): DecoderResult<Event> => {
      const eventMetadataResult = EventMetadata.decoder(value);
      if (eventMetadataResult.tag === "DecoderError") {
        return eventMetadataResult;
      }
      const eventWithPayloadResult = EventWithPayload.decoder(value);
      if (eventWithPayloadResult.tag === "DecoderError") {
        return eventWithPayloadResult;
      }
      return {
        tag: "Valid",
        value: {
          ...eventMetadataResult.value,
          ...eventWithPayloadResult.value,
        },
      };
    },
    encoder: (event: Event): EncodedEvent => ({
      ...EventMetadata.encoder(event),
      ...EventWithPayload.encoder(event),
    }),
  };

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
      EncodedEvent,
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
