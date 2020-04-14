// @flow

import * as d from "decoders";

import {
  array,
  autoRecord,
  boolean,
  either,
  number,
  optional,
  record,
  repr,
  string,
} from "../src";

beforeEach(() => {
  repr.sensitive = false;
});

test("the main readme example", () => {
  type User = {|
    name: string,
    active: boolean,
    age: ?number,
    interests: Array<string>,
    id: string | number,
  |};

  const userDecoder = record((field): User => ({
    name: field("full_name", string),
    active: field("is_active", boolean),
    age: field("age", optional(number)),
    interests: field("interests", array(string)),
    id: field("id", either(string, number)),
  }));

  const payload: mixed = getSomeJSON();

  const user: User = userDecoder(payload);

  expect(user).toMatchInlineSnapshot(`
    Object {
      "active": true,
      "age": 30,
      "id": 1,
      "interests": Array [
        "Programming",
        "Cooking",
      ],
      "name": "John Doe",
    }
  `);

  const payload2: mixed = getSomeInvalidJSON();

  expect(() => userDecoder(payload2)).toThrowErrorMatchingInlineSnapshot(
    `object["age"]: (optional) Expected a number, but got: "30"`
  );
});

function getSomeJSON(): mixed {
  return {
    full_name: "John Doe",
    is_active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
    id: 1,
  };
}

function getSomeInvalidJSON(): mixed {
  return {
    full_name: "John Doe",
    is_active: true,
    age: "30",
    interests: [],
    id: 1,
  };
}

test("error messages", () => {
  // Make snapshots easier to read.
  // Before: `"\\"string\\""`
  // After: `"string"`
  // This is like the serializer in jest.snapshots.config.js but for _all_ strings.
  expect.addSnapshotSerializer({
    test: (value) => typeof value === "string",
    print: (value) => value,
  });

  const accessoryDecoder1 = autoRecord({
    id: string,
    name: string,
    discount: optional(number),
  });
  const accessoryDecoder2 = d.object({
    id: d.string,
    name: d.string,
    discount: d.nullable(d.number),
  });

  const productDecoder1 = autoRecord({
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

  expect(() =>
    productsDecoder1(getProducts())
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1]["accessories"][0]["id"] (missing): Expected a string, but got: undefined`
  );

  expect(() =>
    productsDecoder1(getProducts({ missingId: false }))
  ).toThrowErrorMatchingInlineSnapshot(
    `array[1]["accessories"][0]["discount"]: (optional) Expected a number, but got: "5%"`
  );
});

function getProducts({
  missingId = true,
}: {| missingId: boolean |} = {}): mixed {
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
  const userDecoder = autoRecord({
    name: string,
    details: autoRecord({
      email: string,
      ssn: string,
    }),
  });

  const data: mixed = {
    name: "John Doe",
    details: {
      email: "john.doe@example.com",
      ssn: 123456789,
    },
  };

  expect(() => userDecoder(data)).toThrowErrorMatchingInlineSnapshot(
    `object["details"]["ssn"]: Expected a string, but got: 123456789`
  );

  repr.sensitive = true;
  expect(() => userDecoder(data)).toThrowErrorMatchingInlineSnapshot(
    `object["details"]["ssn"]: Expected a string, but got: number`
  );
});
