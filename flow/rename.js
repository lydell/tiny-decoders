// @flow strict

import { type Decoder, autoRecord, map, number, string } from "../src";

type Camel = {|
  firstName: string,
  age: number,
|};

const verifyCamel = (decoder: Decoder<Camel>): Camel => decoder(undefined);

// Successful rename (approach 1):
verifyCamel(
  map(
    autoRecord({
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
    autoRecord({
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
    autoRecord({
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
    autoRecord({
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
    autoRecord({
      first_name: string,
      ago: number,
    }),
    // $ExpectError
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);
