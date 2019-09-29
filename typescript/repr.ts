import { repr } from "tiny-decoders";

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
repr([null, "", repr], {
  maxArrayChildren: 10,
  // $ExpectError
  maxObjetChildren: 10,
});

repr.sensitive = true;
repr.sensitive = false;
// $ExpectError
repr.sensitive = "true";
// $ExpectError
repr.shorts = false;
