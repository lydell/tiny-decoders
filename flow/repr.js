// @flow strict

import { repr } from "../src";

repr(undefined);
repr(null, {});

repr(0, {
  recurse: false,
  maxArrayChildren: 10,
  maxObjectChildren: 10,
  maxLength: 10,
  recurseMaxLength: 10,
});

repr("", {});

// Misspelled option ("maxObjetChildren" instead of "maxObjectChildren"):
// $ExpectError
repr([null, "", repr], {
  maxArrayChildren: 10,
  maxObjetChildren: 10,
});
