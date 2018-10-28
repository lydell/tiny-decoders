import { repr } from "tiny-decoders";

repr(undefined);
repr(null, {});

repr(0, {
  key: "key",
  recurse: false,
  printExtraProps: false,
  maxArrayChildren: 10,
  maxObjectChildren: 10,
  identifierRegex: /^/,
});

repr("", {
  key: 0,
  printExtraProps: true,
});

// Bad key:
// $ExpectError
repr(repr, {
  key: Symbol("key"),
  printExtraProps: true,
});

// Misspelled option ("maxObjetChildren" instead of "maxObjectChildren"):
repr([null, "", repr], {
  maxArrayChildren: 10,
  // $ExpectError
  maxObjetChildren: 10,
});
