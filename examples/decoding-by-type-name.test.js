// @flow strict

import {
  type Decoder,
  array,
  autoRecord,
  boolean,
  constant,
  dict,
  either,
  map,
  number,
  optional,
  record,
  repr,
  string,
} from "../src";

test("decoding based on a field", () => {
  // First, some types:

  type Product = {|
    type: "Product",
    name: string,
    price: number,
    categories: Array<string>,
  |};

  type Category = {|
    type: "Category",
    name: string,
    tags?: { [string]: string, ... },
  |};

  type Offer = {|
    type: "Offer",
    discount: number,
    message: string,
    isActive: boolean,
  |};

  type SearchResult = Product | Category | Offer;

  // Then, the decoders.

  // For some reason, we already had an Offer decoder in our code base.
  const offerDecoder: Decoder<Offer> = autoRecord({
    type: constant("Offer"),
    discount: number,
    message: string,
    isActive: boolean,
  });

  const searchResultDecoder1: Decoder<SearchResult> = record(
    (field, fieldError, obj, errors) => {
      const type = field("type", string);

      switch (type) {
        case "Product":
          return {
            type: "Product",
            name: field("name", string),
            price: field("price", number),
            categories: field("categories", array(string)),
          };

        case "Category":
          return {
            type: "Category",
            name: field("name", string),
            tags: field("tags", optional(dict(string))),
          };

        case "Offer":
          // Here we reuse the decoder we already had.
          return offerDecoder(obj, errors);

        default:
          throw fieldError(
            "type",
            `Expected a SearchResult type, but got: ${repr(type)}`
          );
      }
    }
  );

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

  expect((searchResultDecoder1(offer): SearchResult)).toMatchInlineSnapshot(`
    Object {
      "discount": 0.25,
      "isActive": true,
      "message": "25% off on all Ergonomic Keyboards!",
      "type": "Offer",
    }
  `);
  expect(() =>
    searchResultDecoder1(incompleteProduct)
  ).toThrowErrorMatchingInlineSnapshot(
    `object["price"] (missing): Expected a number, but got: undefined`
  );
  expect(() => searchResultDecoder1(user)).toThrowErrorMatchingInlineSnapshot(
    `object["type"]: Expected a SearchResult type, but got: "User"`
  );

  // Finally, if let’s say we already had decoders for products and categories as well.

  const productDecoder: Decoder<Product> = autoRecord({
    type: constant("Product"),
    name: string,
    price: number,
    categories: array(string),
  });

  const categoryDecoder: Decoder<Category> = autoRecord({
    type: constant("Category"),
    name: string,
    tags: optional(dict(string)),
  });

  // Then it might seem reasonable to use `either` to decode search results. But
  // `either` is not very good in this case since it gives very confusing error
  // messages.

  const searchResultDecoder2: Decoder<SearchResult> = either(
    productDecoder,
    either(categoryDecoder, offerDecoder)
  );
  expect(searchResultDecoder2(offer)).toEqual(searchResultDecoder1(offer));
  expect(() => searchResultDecoder2(incompleteProduct))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["price"] (missing): Expected a number, but got: undefined
object["type"]: Expected the value "Category", but got: "Product"
object["type"]: Expected the value "Offer", but got: "Product"
`);
  expect(() => searchResultDecoder2(user)).toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
object["type"]: Expected the value "Product", but got: "User"
object["type"]: Expected the value "Category", but got: "User"
object["type"]: Expected the value "Offer", but got: "User"
`);

  // This is a better approach:

  function getSearchResultDecoder(
    type: string
  ): Decoder<Product> | Decoder<Category> | Decoder<Offer> {
    switch (type) {
      case "Product":
        return productDecoder;
      case "Category":
        return categoryDecoder;
      case "Offer":
        return offerDecoder;
      default:
        throw new TypeError(
          `Expected a SearchResult type, but got: ${repr(type)}`
        );
    }
  }

  const searchResultDecoder3 = record((field, fieldError, obj, errors) => {
    const decoder = field("type", map(string, getSearchResultDecoder));
    return decoder(obj, errors);
  });

  expect(searchResultDecoder3(offer)).toEqual(searchResultDecoder1(offer));

  expect(() =>
    searchResultDecoder3(incompleteProduct)
  ).toThrowErrorMatchingInlineSnapshot(
    `object["price"] (missing): Expected a number, but got: undefined`
  );
  expect(() => searchResultDecoder3(user)).toThrowErrorMatchingInlineSnapshot(
    `object["type"]: Expected a SearchResult type, but got: "User"`
  );

  // `searchResultDecoder3` could also have been written like this, but that
  // gives a worse error message when `type` is invalid (which doesn’t indicate
  // that the error happened in the `type` field).
  const searchResultDecoder4 = record((field, fieldError, obj, errors) => {
    const decoder = getSearchResultDecoder(field("type", string));
    return decoder(obj, errors);
  });
  expect(() => searchResultDecoder4(user)).toThrowErrorMatchingInlineSnapshot(
    `Expected a SearchResult type, but got: "User"`
  );

  // Finally, a note abount `constant`. Note how the above decoders used
  // `constant` for the `type` field. What’s the point of that? Wouldn’t this
  // work just as well?
  const categoryDecoder2: Decoder<Category> = autoRecord({
    type: () => "Category",
    name: string,
    tags: optional(dict(string)),
  });

  // The difference is that if you accidentally run `categoryDecoder2` on a
  // product it will still succeed, while `categoryDecoder` throws an error,
  // saving you from your mistake.
  const product: mixed = {
    type: "Product",
    name: "Pineapple",
    price: 9,
    categories: ["Fruit"],
  };
  expect(categoryDecoder2(product)).toMatchInlineSnapshot(`
    Object {
      "name": "Pineapple",
      "tags": undefined,
      "type": "Category",
    }
  `);
  expect(() => categoryDecoder(product)).toThrowErrorMatchingInlineSnapshot(
    `object["type"]: Expected the value "Category", but got: "Product"`
  );

  // See also `typescript/type-annotations.ts` for additional examples of
  // decoding based on a field, and important information about type inference
  // about such decoders in TypeScript.
});

test("using several fields to decide how to decode", () => {
  // In this case one needs to look at several boolean fields to decide how to
  // decode the rest of the object.
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

  const personDecoder: Decoder<Person> = record((field) => {
    // First get the roles, and then decode based on those.
    const isUser = field("isUser", optional(boolean, false));
    const isAdmin = field("isAdmin", optional(boolean, false));
    const isPartner = field("isPartner", optional(boolean, false));

    return {
      user: isUser
        ? {
            name: field("name", string),
            email: field("email", string),
          }
        : null,
      admin: isAdmin
        ? {
            privileges: field("privileges", array(string)),
          }
        : null,
      partner: isPartner
        ? {
            affiliation: field("affiliation", string),
          }
        : null,
    };
  });

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
