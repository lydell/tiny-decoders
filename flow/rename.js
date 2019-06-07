// @flow strict

import { field, group, map, number, record, string } from "../src";

type Camel = {|
  firstName: string,
  age: number,
|};

const verifyCamel = (decoder: mixed => Camel): Camel => decoder(undefined);

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
verifyCamel(
  // $ExpectError
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
  // $ExpectError
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
  map(
    record({
      first_name: string,
      age: number,
    }),
    // $ExpectError
    ({ first_name: fistName, ...rest }) => ({ fistName, ...rest })
  )
);

// Misspelled field ("ago" instead of "age"):
verifyCamel(
  map(
    record({
      first_name: string,
      ago: number,
    }),
    // $ExpectError
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);

// Successful rename (approach 2):
verifyCamel(
  map(
    group({
      firstName: field("first_name", string),
      rest: record({
        // TODO: Flow errors on this line, even though it is correct.
        // $FlowIgnore
        age: number,
      }),
    }),
    ({ rest, ...renamed }) => ({ ...renamed, ...rest })
  )
);

// Forgot to spread:
verifyCamel(
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
// TODO and WARNING: Flow doesn’t catch this! This seems to be a bug in Flow,
// because TypeScript does catch it.
verifyCamel(
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
// TODO and WARNING: Flow doesn’t catch this! This seems to be a bug in Flow,
// because TypeScript does catch it.
verifyCamel(
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
