// @flow

import * as d from "decoders";

import {
  array,
  boolean,
  either,
  number,
  optional,
  record,
  string,
} from "../src";

test("the main readme example", () => {
  type User = {|
    name: string,
    active: boolean,
    age: ?number,
    interests: Array<string>,
    id: string | number,
  |};

  const userDecoder: mixed => User = record({
    name: string,
    active: boolean,
    age: optional(number),
    interests: array(string),
    id: either(string, number),
  });

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

  expect(() => userDecoder(payload2)).toThrowErrorMatchingInlineSnapshot(`
object["age"]: (optional) Expected a number, but got: "30"
at "age" in {"age": "30", "name": "John Doe", "active": true, (2 more)}
`);
});

function getSomeJSON(): mixed {
  return {
    name: "John Doe",
    active: true,
    age: 30,
    interests: ["Programming", "Cooking"],
    id: 1,
  };
}

function getSomeInvalidJSON(): mixed {
  return {
    name: "John Doe",
    active: true,
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
    test: value => typeof value === "string",
    print: value => value,
  });

  const accessoryDecoder1 = record({
    id: string,
    name: string,
    discount: optional(number),
  });
  const accessoryDecoder2 = d.object({
    id: d.string,
    name: d.string,
    discount: d.nullable(d.number),
  });

  const productDecoder1 = record({
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

  expect(() => productsDecoder1(getProducts()))
    .toThrowErrorMatchingInlineSnapshot(`
array[1]["accessories"][0]["id"]: Expected a string, but got: undefined
at "id" (missing) in {"name": "Keycap Puller", "image": "data:imag…AkQBADs=", "discount": "5%"}
at 0 in [(index 0) Object(3), Object(4)]
at "accessories" in {"accessories": Array(2), "id": "382973", "name": "Ergonomic Keyboard", (2 more)}
at 1 in [Object(5), (index 1) Object(5), Object(5)]
`);

  expect(() => productsDecoder1(getProducts({ missingId: false })))
    .toThrowErrorMatchingInlineSnapshot(`
array[1]["accessories"][0]["discount"]: (optional) Expected a number, but got: "5%"
at "discount" in {"discount": "5%", "id": "489382", "name": "Keycap Puller", (1 more)}
at 0 in [(index 0) Object(4), Object(4)]
at "accessories" in {"accessories": Array(2), "id": "382973", "name": "Ergonomic Keyboard", (2 more)}
at 1 in [Object(5), (index 1) Object(5), Object(5)]
`);
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
