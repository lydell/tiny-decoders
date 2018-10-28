import { field, group, map, number, record, string } from "tiny-decoders";

interface Camel {
  firstName: string;
  age: number;
}

const verifyCamel = (decoder: (value: unknown) => Camel): Camel =>
  decoder(undefined);

// Successful rename (approach 1):
verifyCamel(
  map(
    record({
      first_name: string,
      age: number,
    }),
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

// Didn’t remove "first_name":
// TODO: Can this be made an error, just like in Flow?
verifyCamel(
  map(
    record({
      first_name: string,
      age: number,
    }),
    ({ ...props }) => ({ ...props, firstName: props.first_name })
  )
);

// Misspelled field ("fist_name" instead of "first_name"):
verifyCamel(
  map(
    record({
      first_name: string,
      age: number,
    }),
    // $ExpectError
    ({ fist_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

// Misspelled field ("fistName" instead of "firstName"):
verifyCamel(
  // $ExpectError
  map(
    record({
      first_name: string,
      age: number,
    }),
    ({ first_name: fistName, ...rest }) => ({ fistName, ...rest })
  )
);

// Misspelled field ("ago" instead of "age"):
verifyCamel(
  // $ExpectError
  map(
    record({
      first_name: string,
      ago: number,
    }),
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

// Successful rename (approach 2):
verifyCamel(
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

// Forgot to spread:
verifyCamel(
  // $ExpectError
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    // $ExpectError
    ({ rest, renamed }) => ({ renamed, rest })
  )
);

// Misspelled field ("fistName" instead of "firstName"):
verifyCamel(
  // $ExpectError
  map(
    group({
      fistName: field("first_name", string),
      rest: record({
        age: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

// Misspelled field ("ago" instead of "age"):
verifyCamel(
  // $ExpectError
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        ago: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);
