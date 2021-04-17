import * as d from "decoders";

import {
  array,
  boolean,
  Decoder,
  DecoderError,
  fields,
  fieldsAuto,
  number,
  optional,
  repr,
  ReprOptions,
  string,
} from "..";

function run<T>(
  decoder: Decoder<T>,
  value: unknown,
  options?: ReprOptions
): T | string {
  try {
    return decoder(value);
  } catch (error) {
    return error instanceof DecoderError
      ? error.format(options)
      : error instanceof Error
      ? error.message
      : `Unknown error: ${repr(error)}`;
  }
}

test("the main readme example", () => {
  type User = {
    name: string;
    active: boolean;
    age?: number;
    interests: Array<string>;
  };

  const userDecoder = fields(
    (field): User => ({
      name: field("full_name", string),
      active: field("is_active", boolean),
      age: field("age", optional(number)),
      interests: field("interests", array(string)),
    })
  );

  const payload: unknown = getSomeJSON();

  const user: User = userDecoder(payload);

  expect(user).toMatchInlineSnapshot(`
    Object {
      "active": true,
      "age": 30,
      "interests": Array [
        "Programming",
        "Cooking",
      ],
      "name": "John Doe",
    }
  `);

  const payload2: unknown = getSomeInvalidJSON();

  expect(run(userDecoder, payload2)).toMatchInlineSnapshot(`
    "At root[\\"age\\"] (optional):
    Expected a number
    Got: \\"30\\""
  `);
});

function getSomeJSON(): unknown {
  return {
    full_name: "John Doe",
    is_active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
  };
}

function getSomeInvalidJSON(): unknown {
  return {
    full_name: "John Doe",
    is_active: true,
    age: "30",
    interests: [],
  };
}

test("error messages", () => {
  expect.addSnapshotSerializer({
    test: (value: unknown): boolean => typeof value === "string",
    print: String,
  });

  const accessoryDecoder1 = fieldsAuto({
    id: string,
    name: string,
    discount: optional(number),
  });
  const accessoryDecoder2 = d.object({
    id: d.string,
    name: d.string,
    discount: d.nullable(d.number),
  });

  const productDecoder1 = fieldsAuto({
    id: string,
    name: string,
    price: number,
    accessories: array(accessoryDecoder1),
  });

  const productDecoder2 = d.object({
    id: d.string,
    name: d.string,
    price: d.number,
    accessories: d.array(accessoryDecoder2),
  });

  const productsDecoder1 = array(productDecoder1);
  const productsDecoder2 = d.guard(d.array(productDecoder2));

  expect(() => productsDecoder2(getProducts()))
    .toThrowErrorMatchingInlineSnapshot(`

      [
        {
          "id": "512971",
          "name": "Ergonomic Mouse",
          "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          "price": 499,
          "accessories": [],
        },
        {
          "id": "382973",
          "name": "Ergonomic Keyboard",
          "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          "price": 998,
          "accessories": [
            {
              "name": "Keycap Puller",
              "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
              "discount": "5%",
                          ^^^^
                          Either:
                          - Must be null
                          - Must be number
            },
            ^ Missing key: "id" (at index 0)
            {
              "id": 892873,
              "name": "Keycap Set",
              "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
              "discount": null,
            },
          ],
        },
        ^ index 1
        {
          "id": "493673",
          "name": "Foot Pedals",
          "image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          "price": 299,
          "accessories": [],
        },
      ]
    `);

  expect(run(productsDecoder1, getProducts())).toMatchInlineSnapshot(`
    At root[1]["accessories"][0]["id"]:
    Expected a string
    Got: undefined
  `);

  expect(run(productsDecoder1, getProducts({ missingId: false })))
    .toMatchInlineSnapshot(`
      At root[1]["accessories"][0]["discount"] (optional):
      Expected a number
      Got: "5%"
    `);
});

function getProducts({
  missingId = true,
}: { missingId?: boolean } = {}): unknown {
  return [
    {
      id: "512971",
      name: "Ergonomic Mouse",
      image:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
      price: 499,
      accessories: [],
    },
    {
      id: "382973",
      name: "Ergonomic Keyboard",
      image:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
      price: 998,
      accessories: [
        {
          ...(missingId ? {} : { id: "489382" }),
          name: "Keycap Puller",
          image:
            "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          discount: "5%",
        },
        {
          id: 892873,
          name: "Keycap Set",
          image:
            "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          discount: null,
        },
      ],
    },
    {
      id: "493673",
      name: "Foot Pedals",
      image:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
      price: 299,
      accessories: [],
    },
  ];
}

test("default vs sensitive error messages", () => {
  const userDecoder = fieldsAuto({
    name: string,
    details: fieldsAuto({
      email: string,
      ssn: string,
    }),
  });

  const data: unknown = {
    name: "John Doe",
    details: {
      email: "john.doe@example.com",
      ssn: 123456789,
    },
  };

  expect(run(userDecoder, data)).toMatchInlineSnapshot(`
    At root["details"]["ssn"]:
    Expected a string
    Got: 123456789
  `);

  expect(run(userDecoder, data, { sensitive: true })).toMatchInlineSnapshot(`
    At root["details"]["ssn"]:
    Expected a string
    Got: number
  `);
});
