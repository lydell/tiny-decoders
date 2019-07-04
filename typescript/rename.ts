import { Decoder, autoRecord, map, number, string } from "tiny-decoders";

interface Camel {
  firstName: string;
  age: number;
}

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
// Unlike Flow, TypeScript does not have exact types. Returning an object with
// extraneous properties is OK.
verifyCamel(
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
  // $ExpectError
  map(
    autoRecord({
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
    autoRecord({
      first_name: string,
      ago: number,
    }),
    ({ first_name: firstName, ...rest }) => ({ firstName, ...rest })
  )
);
