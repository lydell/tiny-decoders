import { repr } from "tiny-decoders";

repr(undefined);
repr(null, {});

repr(0, {
  key: "key",
  recurse: false,
  maxArrayChildren: 10,
  maxObjectChildren: 10,
});

repr("", {
  key: 0,
});

// Bad key:
// $ExpectError
repr(repr, {
  key: Symbol("key"),
});

// Misspelled option ("maxObjetChildren" instead of "maxObjectChildren"):
repr([null, "", repr], {
  maxArrayChildren: 10,
  // $ExpectError
  maxObjetChildren: 10,
});

repr.short = true;
repr.short = false;
// $ExpectError
repr.short = "true";
// $ExpectError
repr.shorts = false;
