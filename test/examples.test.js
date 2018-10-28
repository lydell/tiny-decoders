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
  fieldDeep,
  group,
  map,
  mixedArray,
  mixedDict,
  number,
  optional,
  record,
  repr,
  string,
} from "../src";

// Make snapshots for error messages easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
expect.addSnapshotSerializer({
  test: value => typeof value === "string" && value.includes("Expected"),
  print: value => value,
});

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
    tags: { [string]: string },
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

test("renaming fields", () => {
  type UserSnakeCase = {|
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  |};

  // Making decoders with `record` is convenient, but what if you want to rename
  // some fields?
  const userSnakeCaseDecoder: mixed => UserSnakeCase = record({
    first_name: string,
    last_name: string,
    age: number,
    active: boolean,
  });

  const user: mixed = {
    first_name: "John",
    last_name: "Doe",
    age: 30,
    active: true,
  };
  expect((userSnakeCaseDecoder(user): UserSnakeCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "first_name": "John",
  "last_name": "Doe",
}
`);

  type UserCamelCase = {|
    firstName: string,
    lastName: string,
    age: number,
    active: boolean,
  |};

  // One way is to use `group` and `field`.
  const userCamelCaseDecoder1: mixed => UserCamelCase = group({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
    age: field("age", number),
    active: field("active", boolean),
  });
  expect((userCamelCaseDecoder1(user): UserCamelCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "firstName": "John",
  "lastName": "Doe",
}
`);

  // Another way is to use `map` to rename some fields after `record` has done
  // its job. Might be nice if there’s only a few fields that need renaming.
  const userCamelCaseDecoder2: mixed => UserCamelCase = map(
    userSnakeCaseDecoder,
    ({ first_name: firstName, last_name: lastName, ...rest }) => ({
      firstName,
      lastName,
      ...rest,
    })
  );
  expect((userCamelCaseDecoder2(user): UserCamelCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "firstName": "John",
  "lastName": "Doe",
}
`);

  // A third way is to use `record`, `group`, `field` and `map` all at once.
  // TODO and WARNING: If you misspell "firstName" as "fistName" Flow doesn’t
  // catch it! Not sure if this is a bug in tiny-decoders or Flow.
  const userCamelCaseDecoder3: mixed => UserCamelCase = map(
    group({
      firstName: field("first_name", string),
      lastName: field("last_name", string),
      rest: record({
        age: number,
        active: boolean,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  );
  expect((userCamelCaseDecoder3(user): UserCamelCase)).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "firstName": "John",
  "lastName": "Doe",
}
`);
});

test("adding extra fields to records", () => {
  // Want to add an extra field to the result of `record`, that doesn’t look at
  // the input at all?
  type Product = {|
    name: string,
    price: number,
    version: number,
  |};

  const data: mixed = { name: "Comfortable Bed", price: 10e3 };

  // One way is to do it with `map`.
  const productDecoder1: mixed => Product = map(
    record({
      name: string,
      price: number,
    }),
    props => ({ ...props, version: 1 })
  );
  expect((productDecoder1(data): Product)).toMatchInlineSnapshot(`
Object {
  "name": "Comfortable Bed",
  "price": 10000,
  "version": 1,
}
`);

  // Another way is to add a decoder that always succeeds (a function that
  // ignores its input and always returns the same value).
  const productDecoder2: mixed => Product = record({
    name: string,
    price: number,
    version: () => 1,
  });
  expect((productDecoder2(data): Product)).toMatchInlineSnapshot(`
Object {
  "name": "Comfortable Bed",
  "price": 10000,
  "version": 1,
}
`);

  // If you don’t like that arrow function, you can use `always(1)` or
  // `hardcoded(1)` as mentioned in the next test.
});

test("allowing decoders, such as fieldDeep, to fail", () => {
  const decoder = fieldDeep(
    ["store", "products", 0, "accessories", 0, "price"],
    number
  );

  const data = { store: { products: [{ accessories: [{ price: 123 }] }] } };
  const incompleteData = { store: { products: [{ accessories: [] }] } };

  // `fieldDeep` lets you reach into deeply nested structures. But on the way
  // down, there’s lots that can go wrong. What if you’ like to provide a
  // default value in such cases?
  expect(decoder(data)).toMatchInlineSnapshot(`123`);
  expect(() => decoder(incompleteData)).toThrowErrorMatchingInlineSnapshot(`
object["store"]["products"][0]["accessories"][0]: Expected an object, but got: undefined
at 0 (out of bounds) in []
at "accessories" in {"accessories": Array(0)}
at 0 in [(index 0) Object(1)]
at "products" in {"products": Array(1)}
at "store" in {"store": Object(1)}
`);

  // By combining the decoder with another decoder that always succeeds (a
  // function that ignores its input and always returns the same value) you can
  // provide a default value.
  expect(either(decoder, () => 0)(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(either(decoder, () => null)(incompleteData)).toMatchInlineSnapshot(
    `null`
  );

  // If you like, you can define one of these helper functions:
  const always = value => () => value;
  const hardcoded = value => () => value;
  expect(either(decoder, always(0))(incompleteData)).toMatchInlineSnapshot(`0`);
  expect(
    either(decoder, hardcoded(null))(incompleteData)
  ).toMatchInlineSnapshot(`null`);

  // Note that `optional` doesn’t help in this case:
  expect(() => optional(decoder)(incompleteData))
    .toThrowErrorMatchingInlineSnapshot(`
(optional) object["store"]["products"][0]["accessories"][0]: Expected an object, but got: undefined
at 0 (out of bounds) in []
at "accessories" in {"accessories": Array(0)}
at 0 in [(index 0) Object(1)]
at "products" in {"products": Array(1)}
at "store" in {"store": Object(1)}
`);
  // `optional` only does its job if the toplevel value is missing.
  expect(optional(decoder, 0)(undefined)).toMatchInlineSnapshot(`0`);

  // Btw, curious how `fieldDeep` works? The decoder we made at the start of
  // this example is equivalent to:
  const decoder2 = field(
    "store",
    field(
      "products",
      field(0, field("accessories", field(0, field("price", number))))
    )
  );
  expect(decoder2(data)).toMatchInlineSnapshot(`123`);
});

test("decoding to a Set", () => {
  // Want to turn this into a Set of numbers?
  const data: mixed = [1, 2, 1, 3, 2];

  // First decode into an array, then turn that into a set! Remember that
  // decoders are just regular functions, so you can work with their return
  // values.
  expect(new Set(array(number)(data))).toMatchInlineSnapshot(`
Set {
  1,
  2,
  3,
}
`);

  // But what if that’s part of a larger structure?
  const obj = {
    id: "123",
    numbers: data,
  };

  // In the above example we made a decoder (`array(number)`) and immediately
  // called it on some data (`array(number)(data)`). But `record` expects the
  // values to be decoders themselves and calls them for you. So how do we do it now?
  // Using `map`! It lets you transform the result of a decoder, but still
  // returns a decoder so it fits with `record`! In this case, the return value
  // of the `map` call is a function that looks like this: `mixed =>
  // Set<number>`.
  const objDecoder = record({
    id: string,
    numbers: map(array(number), arr => new Set(arr)),
  });
  expect(objDecoder(obj)).toMatchInlineSnapshot(`
Object {
  "id": "123",
  "numbers": Set {
    1,
    2,
    3,
  },
}
`);

  // With `map`, you don’t _have_ to change the type, though. For example, you
  // could use it to round numbers.
  const decoder: mixed => number = map(number, Math.round);
  expect(decoder(4.9)).toMatchInlineSnapshot(`5`);
});

test("decoding mixed", () => {
  // Have a piece of data with a very generic field?
  type Message = {|
    text: string,
    data: mixed,
  |};

  const message = { text: "Hello, world!", data: 15 };

  const messageDecoder: mixed => Message = record({
    text: string,
    // All fields are already `mixed` so you can pass them through as-is.
    data: value => value,
  });
  expect((messageDecoder(message): Message)).toMatchInlineSnapshot(`
Object {
  "data": 15,
  "text": "Hello, world!",
}
`);

  // If you like, you can define one of these helper functions:
  const identity = value => value;
  const mixed = identity;

  const messageDecoder2: mixed => Message = record({
    text: string,
    // All fields are already `mixed` so you can pass them through as-is.
    data: mixed,
  });
  expect((messageDecoder2(message): Message)).toMatchInlineSnapshot(`
Object {
  "data": 15,
  "text": "Hello, world!",
}
`);
});

test("decoding tuples", () => {
  type Point = {|
    x: number,
    y: number,
  |};

  type PointTuple = [number, number];

  const data: mixed = [50, 325];

  // If you want to pick out items at certain indexes of an array, treating it
  // is a tuple, use `field` and save the results in a `group`.
  const pointDecoder: mixed => Point = group({
    x: field(0, number),
    y: field(1, number),
  });
  expect((pointDecoder(data): Point)).toMatchInlineSnapshot(`
Object {
  "x": 50,
  "y": 325,
}
`);

  // If you the decoded value to be a tuple rather than a record, `map` the values:
  const pointDecoder2: mixed => PointTuple = map(pointDecoder, ({ x, y }) => [
    x,
    y,
  ]);
  expect((pointDecoder2(data): PointTuple)).toMatchInlineSnapshot(`
Array [
  50,
  325,
]
`);
});

test("custom decoders", () => {
  function finite(value: number): number {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Expected a finite number, but got: ${repr(value)}`);
    }
    return value;
  }

  // Want `number` but want to disallow `Infinity`, `-Infinity` and `NaN`?
  // Compose `number` with a custom function using `map`. `map` is not only for
  // transforming values, but also for chaining decoders!
  const finiteNumber: mixed => number = map(number, finite);
  expect(finiteNumber(1)).toMatchInlineSnapshot(`1`);
  expect(() => finiteNumber(Infinity)).toThrowErrorMatchingInlineSnapshot(
    `Expected a finite number, but got: Infinity`
  );
  expect(() => finiteNumber("string")).toThrowErrorMatchingInlineSnapshot(
    `Expected a number, but got: "string"`
  );

  type Alignment = "top" | "right" | "bottom" | "left";

  // A common custom decoder is to turn a string into an enum:
  function alignmentDecoder(value: string): Alignment {
    switch (value) {
      case "top":
      case "right":
      case "bottom":
      case "left":
        return value;
      default:
        throw new TypeError(`Expected a Alignment, but got: ${repr(value)}`);
    }
  }

  const shapeDecoder = record({
    width: number,
    height: number,
    // Now `map` comes in handy again to chain decoders!
    align: map(string, alignmentDecoder),
  });
  expect(shapeDecoder({ width: 100, height: 100, align: "left" }))
    .toMatchInlineSnapshot(`
Object {
  "align": "left",
  "height": 100,
  "width": 100,
}
`);

  // There’s also a custom decoder in the next test that you might be interested in.
});

test("distinguishing between undefined, null and missing values", () => {
  // When decoding objects, arrays and tuple, the value for a proerty or index
  // can be missing in three ways:
  //
  // - The value is `null`.
  // - The value is `undefined`.
  // - The property is not set, or the index is out of bounds or pointing to a
  //   hole in the array. Trying to access the property or index anyway returns
  //   the value `undefined`.
  //
  // tiny-decoders makes no attempt to distinguish between those cases. It never
  // checks if a property or index exists before trying to access it, and
  // `optional` treats `null` and `undefined` the same. Luckily, there’s
  // seldomly any need to distingush the three cases so that’s whay
  // tiny-decoders have kept things simple, rather than providing three or more
  // confusingly similar functions. I wouldn’t want to have to learn the
  // difference between `optional`, `maybe`, `nullable`, etc.
  //
  // If you ever end up in a situation where you do need to disinguish between
  // them, it’s still possible with a little trickery.

  // If you don’t need to check for missing values and need `optional` but only
  // for `null` OR `undefined` (not both), you can use `either` and
  // `constant(null)` or `constant(undefined)`.
  expect(either(number, constant(null))(0)).toMatchInlineSnapshot(`0`);
  expect(either(number, constant(null))(null)).toMatchInlineSnapshot(`null`);
  expect(() => either(number, constant(null))(undefined))
    .toThrowErrorMatchingInlineSnapshot(`
Several decoders failed:
Expected a number, but got: undefined
Expected the value null, but got: undefined
`);

  // If you also need to consider missing values, there are a couple of approaches.

  type Age = "missing" | void | null | number;

  type User = {|
    name: string,
    age: Age,
  |};

  const userDecoder: mixed => User = group({
    name: field("name", string),
    age: andThen(
      mixedDict,
      // This manual checking is ugly but also kind of clear in what it is doing.
      obj =>
        !("age" in obj)
          ? () => "missing"
          : obj.age === null
            ? () => null
            : obj.age === undefined
              ? () => undefined
              : field("age", number)
    ),
  });
  expect(userDecoder({ name: "John" })).toMatchInlineSnapshot(`
Object {
  "age": "missing",
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: undefined })).toMatchInlineSnapshot(`
Object {
  "age": undefined,
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: null })).toMatchInlineSnapshot(`
Object {
  "age": null,
  "name": "John",
}
`);
  expect(userDecoder({ name: "John", age: 30 })).toMatchInlineSnapshot(`
Object {
  "age": 30,
  "name": "John",
}
`);

  // You could also make a custom decoder.
  function maybeField<T, U>(
    key: string | number,
    decoder: mixed => T,
    valueIfMissing: U
  ): mixed => ?T | U {
    return function maybeFieldDecoder(value: mixed): T | U {
      const obj = either(mixedDict, mixedArray)(value);
      return !(key in obj)
        ? valueIfMissing
        : field(
            key,
            either(decoder, either(constant(null), constant(undefined)))
          )(obj);
    };
  }

  const userDecoder2: mixed => User = group({
    name: field("name", string),
    age: maybeField("age", number, "missing"),
  });
  expect(userDecoder2({ name: "John" })).toMatchInlineSnapshot(`
Object {
  "age": "missing",
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: undefined })).toMatchInlineSnapshot(`
Object {
  "age": undefined,
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: null })).toMatchInlineSnapshot(`
Object {
  "age": null,
  "name": "John",
}
`);
  expect(userDecoder2({ name: "John", age: 30 })).toMatchInlineSnapshot(`
Object {
  "age": 30,
  "name": "John",
}
`);
});

test("inferring types", () => {
  // Feels like you are specifying everything twice – once in `type`, once in
  // the decoder? There is a way to let Flow infer the type from a decoder!
  // This approach is taken from:
  // https://github.com/nvie/decoders/issues/93
  // https://gist.github.com/girvo/b4207d4fc92f6b336813d1404309baab

  const userDecoder = record({
    id: either(string, number),
    name: string,
    age: number,
    active: boolean,
    country: optional(string),
  });

  // First, a general helper type:
  type ExtractDecoderType = <T>((mixed) => T) => T;
  // Then, let Flow infer the `User` type!
  type User = $Call<ExtractDecoderType, typeof userDecoder>;

  const data = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
  };

  const user: User = userDecoder(data);
  expect(user).toMatchInlineSnapshot(`
Object {
  "active": true,
  "age": 30,
  "country": undefined,
  "id": 1,
  "name": "John Doe",
}
`);

  // $ExpectError: `User` is exact, so `extra: "prop"` is not allowed.
  const user2: User = {
    id: 1,
    name: "John Doe",
    age: 30,
    active: true,
    country: undefined,
    extra: "prop",
  };
  expect(user2).toMatchObject(user);
});
