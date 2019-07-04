// @flow strict

import {
  andThen,
  array,
  boolean,
  constant,
  dict,
  either,
  field,
  fieldAndThen,
  group,
  number,
  optional,
  record,
  string,
} from "../src";

test("decoding based on a field", () => {
  // First, some types and their decoders:

  type Product = {|
    type: "Product",
    name: string,
    price: number,
    categories: Array<string>,
  |};

  const productDecoder: mixed => Product = record({
    type: constant("Product"),
    name: string,
    price: number,
    categories: array(string),
  });

  type Category = {|
    type: "Category",
    name: string,
    tags: { [string]: string, ... },
  |};

  const categoryDecoder: mixed => Category = record({
    type: constant("Category"),
    name: string,
    tags: dict(string),
  });

  type Offer = {|
    type: "Offer",
    discount: number,
    message: string,
    isActive: boolean,
  |};

  const offerDecoder: mixed => Offer = record({
    type: constant("Offer"),
    discount: number,
    message: string,
    isActive: boolean,
  });

  type SearchResult = Product | Category | Offer;

  function getSearchResultDecoder(type: string): mixed => SearchResult {
    switch (type) {
      case "Product":
        return productDecoder;
      case "Category":
        return categoryDecoder;
      case "Offer":
        return offerDecoder;
      default:
        throw new TypeError(`Expected a SearchResult type, but got: ${type}`);
    }
  }

  // Then, some sample data to decode:

  const offer: mixed = {
    type: "Offer",
    discount: 0.25,
    message: "25% off on all Ergonomic Keyboards!",
    isActive: true,
  };

  const incompleteProduct: mixed = {
    type: "Product",
    name: "Ergonomic Keyboard",
  };

  const user: mixed = {
    type: "User",
    firstName: "John",
    lastName: "Doe",
  };

  // Finally, three approaches of decoding search results:

  // This is the recommended way.
  const searchResultDecoder: mixed => SearchResult = fieldAndThen(
    "type",
    string,
    getSearchResultDecoder
  );
  expect((searchResultDecoder(offer): SearchResult)).toMatchInlineSnapshot(`
Object {
  "discount": 0.25,
  "isActive": true,
  "message": "25% off on all Ergonomic Keyboards!",
  "type": "Offer",
}
`);
  expect(() => searchResultDecoder(incompleteProduct))
    .toThrowErrorMatchingInlineSnapshot(`
object["price"]: Expected a number, but got: undefined
at "price" (missing) in {"type": "Product", "name": "Ergonomic Keyboard"}
`);
  expect(() => searchResultDecoder(user)).toThrowErrorMatchingInlineSnapshot(`
object["type"]: Expected a SearchResult type, but got: User
at "type" in {"type": "User", "firstName": "John", "lastName": "Doe"}
`);

  // This works the same way, but has worse error messages when "type" is invalid.
  const searchResultDecoder2: mixed => SearchResult = andThen(
    field("type", string),
    getSearchResultDecoder
  );
  expect((searchResultDecoder2(offer): SearchResult)).toMatchInlineSnapshot(`
Object {
  "discount": 0.25,
  "isActive": true,
  "message": "25% off on all Ergonomic Keyboards!",
  "type": "Offer",
}
`);
  expect(() => searchResultDecoder2(incompleteProduct))
    .toThrowErrorMatchingInlineSnapshot(`
object["price"]: Expected a number, but got: undefined
at "price" (missing) in {"type": "Product", "name": "Ergonomic Keyboard"}
`);
  expect(() => searchResultDecoder2(user)).toThrowErrorMatchingInlineSnapshot(
    `Expected a SearchResult type, but got: User`
  );

  // `either` is not very good in this case since it gives very confusing error
  // messages.
  const searchResultDecoder3: mixed => SearchResult = either(
    productDecoder,
    either(categoryDecoder, offerDecoder)
  );
  expect((searchResultDecoder3(offer): SearchResult)).toMatchInlineSnapshot(`
Object {
  "discount": 0.25,
  "isActive": true,
  "message": "25% off on all Ergonomic Keyboards!",
  "type": "Offer",
}
`);
  expect(() => searchResultDecoder3(incompleteProduct))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["price"]: Expected a number, but got: undefined
at "price" (missing) in {"type": "Product", "name": "Ergonomic Keyboard"}
object["type"]: Expected the value "Category", but got: "Product"
at "type" in {"type": "Product", "name": "Ergonomic Keyboard"}
object["type"]: Expected the value "Offer", but got: "Product"
at "type" in {"type": "Product", "name": "Ergonomic Keyboard"}
`);
  expect(() => searchResultDecoder3(user)).toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["type"]: Expected the value "Product", but got: "User"
at "type" in {"type": "User", "firstName": "John", "lastName": "Doe"}
object["type"]: Expected the value "Category", but got: "User"
at "type" in {"type": "User", "firstName": "John", "lastName": "Doe"}
object["type"]: Expected the value "Offer", but got: "User"
at "type" in {"type": "User", "firstName": "John", "lastName": "Doe"}
`);
});

test("when fieldAndThen isn’t enough", () => {
  // In this case one needs to look at several boolean fields to decide how to
  // decode the rest of the object. So we can’t use `fieldAndThen` as in the
  // last test. Instead we use the more general `andThen`.
  const persons: mixed = [
    {
      isUser: true,
      name: "John Doe",
      email: "john@example.com",
    },
    {
      isUser: true,
      isAdmin: true,
      name: "Jane Doe",
      email: "jane@example.com",
      privileges: ["edit", "delete"],
    },
    {
      isUser: false,
      isAdmin: true,
      privileges: ["publish"],
    },
    {
      isAdmin: true,
      isPartner: true,
      privileges: ["publish"],
      affiliation: "investor",
    },
    {
      isUser: true,
      isAdmin: true,
      isPartner: true,
      name: "Donald Duck",
      email: "don@example.org",
      privileges: ["edit"],
      affiliation: "investor",
    },
    {
      isUser: true,
      name: "John Doe",
      email: "john@example.com",
      // This user has somehow tried to gain admin privileges!
      privileges: ["publish", "edit", "delete"],
    },
  ];

  // This is how we’d like to represent the data in a type-safe way.
  type Person = {|
    user: ?{|
      name: string,
      email: string,
    |},
    admin: ?{|
      privileges: Array<string>,
    |},
    partner: ?{|
      affiliation: string,
    |},
  |};

  type Roles = {|
    isUser: boolean,
    isAdmin: boolean,
    isPartner: boolean,
  |};

  const rolesDecoder: mixed => Roles = record({
    isUser: optional(boolean, false),
    isAdmin: optional(boolean, false),
    isPartner: optional(boolean, false),
  });

  function getPersonDecoder(roles: Roles): mixed => Person {
    return group({
      user: roles.isUser
        ? record({
            name: string,
            email: string,
          })
        : () => null,
      admin: roles.isAdmin
        ? record({
            privileges: array(string),
          })
        : () => null,
      partner: roles.isPartner
        ? record({
            affiliation: string,
          })
        : () => null,
    });
  }

  // First get the roles, and then get a person decoder based on the roles.
  const personDecoder: mixed => Person = andThen(
    rolesDecoder,
    getPersonDecoder
  );

  expect(array(personDecoder)(persons)).toMatchInlineSnapshot(`
Array [
  Object {
    "admin": null,
    "partner": null,
    "user": Object {
      "email": "john@example.com",
      "name": "John Doe",
    },
  },
  Object {
    "admin": Object {
      "privileges": Array [
        "edit",
        "delete",
      ],
    },
    "partner": null,
    "user": Object {
      "email": "jane@example.com",
      "name": "Jane Doe",
    },
  },
  Object {
    "admin": Object {
      "privileges": Array [
        "publish",
      ],
    },
    "partner": null,
    "user": null,
  },
  Object {
    "admin": Object {
      "privileges": Array [
        "publish",
      ],
    },
    "partner": Object {
      "affiliation": "investor",
    },
    "user": null,
  },
  Object {
    "admin": Object {
      "privileges": Array [
        "edit",
      ],
    },
    "partner": Object {
      "affiliation": "investor",
    },
    "user": Object {
      "email": "don@example.org",
      "name": "Donald Duck",
    },
  },
  Object {
    "admin": null,
    "partner": null,
    "user": Object {
      "email": "john@example.com",
      "name": "John Doe",
    },
  },
]
`);
});
