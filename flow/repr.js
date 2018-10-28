// @flow strict

import { repr } from "../src";

repr(undefined);
repr(null, {});

repr(0, {
  key: "key",
  recurse: false,
  printExtraProps: false,
  maxArrayChildren: 10,
  maxObjectChildren: 10,
});

repr("", {
  key: 0,
  printExtraProps: true,
});

// Bad key:
repr(repr, {
  // $ExpectError
  key: Symbol("key"),
  printExtraProps: true,
});

// Misspelled option ("maxObjetChildren" instead of "maxObjectChildren"):
// $ExpectError
repr([null, "", repr], {
  maxArrayChildren: 10,
  maxObjetChildren: 10,
});
