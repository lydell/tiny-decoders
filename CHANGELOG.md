Note: I’m currently working on several breaking changes to tiny-decoders, but I’m trying out releasing them piece by piece. The idea is that you can either upgrade version by version only having to deal with one or a few breaking changes at a time, or wait and do a bunch of them at the same time.

### Version 18.0.0 (unreleased)

This release removes the second type variable from `Decoder`.

Before:

```ts
type Decoder<T, U = unknown> = (value: U) => DecoderResult<T>;
```

After:

```ts
type Decoder<T> = (value: unknown) => DecoderResult<T>;
```

This change unlocks further changes that will come in future releases.

### Version 17.0.1 (2023-10-29)

Fixed: `fieldsAuto` now reports the correct field name when there’s an error in a renamed field.

```ts
const decoder = fieldsAuto({
  firstName: field(string, { renameFrom: "first_name" }),
});

decoder({ first_name: false });
```

Before:

```
At root["firstName"]:
Expected a string
Got: false
```

After:

```
At root["first_name"]:
Expected a string
Got: false
```

### Version 17.0.0 (2023-10-28)

This release removes the second argument from `undefinedOr` and `nullable`, which was a default value to use in place of `undefined` or `null`, respectively. You now need to use `map` instead. This change unlocks further changes that will come in future releases.

Before:

```ts
const decoder1 = undefinedOr(string, "default value");
const decoder2 = nullable(string, undefined);
```

After:

```ts
const decoder1 = map(undefinedOr(string), (value) => value ?? "default value");
const decoder2 = map(nullable(string), (value) => value ?? undefined);
```

### Version 16.0.0 (2023-10-28)

This release changes decoders from throwing errors to returning a `DecoderResult`:

```ts
type Decoder<T> = (value: unknown) => DecoderResult<T>;

type DecoderResult<T> =
  | {
      tag: "DecoderError";
      error: DecoderError;
    }
  | {
      tag: "Valid";
      value: T;
    };
```

This change is nice because:

- It avoids `try-catch` when you run a decoder, which is annoying due to the caught error is typed as `any` or `unknown`, which required an `error instanceof DecoderError` check.
- You previously needed to remember to use the `.format()` method of `DecoderErrors`, but now it’s more obvious how to deal with errors.
- The type definition of `Decoder` tells the whole story: Now it’s explicit that they can fail, while previously it was implicit.

`DecoderError` is now a plain object instead of a class, and `DecoderErrorVariant` is no longer exposed – there’s just `DecoderError` now. Use the new `format` function to turn a `DecoderError` into a string, similar to what `DecoderError.prototype.format` did before.

You now _have_ to use the `Infer` utility type (added in version 15.1.0) instead of `ReturnType`. `ReturnType` gives you a `DecoderResult<T>` while `Infer` gives you just `T`.

`chain` has been removed and replaced with `map` and `flatMap`. In all places you used `chain`, you need to switch to `map` if the operation cannot fail (you just transform the data), or `flatMap` if it can fail. For `flatMap`, you should not throw errors but instead return a `DecoderResult`. You might need to use a `try-catch` to do this. For example, if you used the `RegExp` constructor in `chain` before to create a regex, you might have relied on tiny-decoders catching the errors for invalid regex syntax errors. Now you need to catch that yourself. Note that TypeScript won’t help you what you need to catch. Similarly, you also need to return a `DecoderError` instead of throwing in custom decoders.

This function can potentially help you migrate tricky decoders where you’re not sure if something might throw errors. It wraps a given decoder in a `try-catch` and returns a new decoder that swallows everything as `DecoderError`s.

```ts
function catcher<T>(decoder: Decoder<T>): Decoder<T> {
  return (value) => {
    try {
      return decoder(value);
    } catch (error) {
      return {
        tag: "DecoderError",
        error: {
          tag: "custom",
          message: error instanceof Error ? error.message : String(error),
          got: value,
          path: [],
        },
      };
    }
  };
}
```

### Version 15.1.0 (2023-10-23)

This release adds the `Infer` utility type. It’s currently basically just an alias to the TypeScript built-in `ReturnType` utility type, but in a future version of tiny-decoders it’ll need to do a little bit more than just `ReturnType`. If you’d like to reduce the amount of migration work when upgrading to that future version, change all your `ReturnType<typeof myDecoder>` to `Infer<typeof myDecoder>` now!

### Version 15.0.0 (2023-10-23)

This release changes the options parameter of `fieldsAuto` and `fieldsUnion` from:

```ts
{ exact = "allow extra" }: { exact?: "allow extra" | "throw" } = {}
```

To:

```ts
{ allowExtraFields = true }: { allowExtraFields?: boolean } = {}
```

This is because:

- A future tiny-decoders version will be return value based instead of throwing errors, so `"throw"` will not make sense anymore.
- tiny-decoders used to have a third alternative for that option – that’s why it’s currently a string union rather than a boolean. While at it, we could just as well simplify into a boolean.

### Version 14.0.0 (2023-10-22)

This release removes the `fields` function, which was deprecated in version 11.0.0. See the release notes for version 11.0.0 for how to replace `fields` with `fieldsAuto`, `chain` and custom decoders.

### Version 13.0.0 (2023-10-22)

> **Warning**  
> This release contains a breaking change, but no TypeScript errors! Be careful!

Version 11.0.0 made changes to `fieldsAuto`, but had a temporary behavior for backwards compatibility, awaiting the changes to `fieldsUnion` in version 12.0.0. This release (13.0.0) removes that temporary behavior.

You need to be on the lookout for these two patterns:

```ts
fieldsAuto({
  field1: undefinedOr(someDecoder),
  field2: () => someValue,
});
```

Previously, the above decoder would succeed even if `field1` or `field2` were missing.

- If `field1` was missing, the temporary behavior in `fieldsAuto` would call the decoder at `field1` with `undefined`, which would succeed due to `undefinedOr`. If you did the version 11.0.0 migration perfectly, this shouldn’t matter. But upgrading to 13.0.0 might uncover some places where you use `undefinedOr(someDecoder)` but meant to use `field(someDecoder, { optional(true) })` or `field(undefinedOr(someDecoder), { optional(true) })` (the latter is the “safest” approach in that it is the most permissive).
- If `field2` was missing, the temporary behavior in `fieldsAuto` would call the decoder at `field2` with `undefined`, which would succeed due to that decoder ignoring its input and always succeeding with the same value.

Here’s an example of how to upgrade the “always succeed” pattern:

```ts
const productDecoder: Decoder<Product> = fieldsAuto({
  name: string,
  price: number,
  version: () => 1,
});
```

Use `chain` instead:

```ts
const productDecoder: Decoder<Product> = chain(
  fieldsAuto({
    name: string,
    price: number,
  }),
  (props) => ({ ...props, version: 1 }),
);
```

It’s a little bit more verbose, but unlocks further changes that will come in future releases.

### Version 12.0.0 (2023-10-22)

This release changes how `fieldsUnion` works. The new way should be easier to use, and it looks more similar to the type definition of a tagged union.

- Changed: The first argument to `fieldsUnion` is no longer the common field name used in the JSON, but the common field name used in TypeScript. This doesn’t matter if you use the same common field name in both JSON and TypeScript. But if you did use different names – don’t worry, you’ll get TypeScript errors so you won’t forget to update something.

- Changed: The second argument to `fieldsUnion` is now an array of objects, instead of an object with decoders. The objects in the array are “`fieldsAuto` objects” – they fit when passed to `fieldsAuto` as well. All of those objects must have the first argument to `fieldsUnion` as a key, and use the new `tag` function on that key.

- Added: The `tag` function. Used with `fieldsUnion`, once for each variant of the union. `tag("MyTag")` returns a `Field` with a decoder that requires the input `"MyTag"` and returns `"MyTag"`. The metadata of the `Field` also advertises that the tag value is `"MyTag"`, which `fieldsUnion` uses to know what to do. The `tag` function also lets you use a different common field in JSON than in TypeScript (similar to the `field` function for other fields).

Here’s an example of how to upgrade:

```ts
fieldsUnion("tag", {
  Circle: fieldsAuto({
    tag: () => "Circle" as const,
    radius: number,
  }),
  Rectangle: fields((field) => ({
    tag: "Rectangle" as const,
    width: field("width_px", number),
    height: field("height_px", number),
  })),
});
```

After:

```ts
fieldsUnion("tag", [
  {
    tag: tag("Circle"),
    radius: number,
  },
  {
    tag: tag("Rectangle"),
    width: field(number, { renameFrom: "width_px" }),
    height: field(number, { renameFrom: "height_px" }),
  },
]);
```

And here’s an example of how to upgrade a case where the JSON and TypeScript names are different:

```ts
fieldsUnion("type", {
  circle: fieldsAuto({
    tag: () => "Circle" as const,
    radius: number,
  }),
  square: fieldsAuto({
    tag: () => "Square" as const,
    size: number,
  }),
});
```

After:

```ts
fieldsUnion("tag", [
  {
    tag: tag("Circle", { renameTagFrom: "circle", renameFieldFrom: "type" }),
    radius: number,
  },
  {
    tag: tag("Square", { renameTagFrom: "square", renameFieldFrom: "type" }),
    size: number,
  },
]);
```

### Version 11.0.0 (2023-10-21)

This release deprecates `fields`, and makes `fieldsAuto` more powerful so that it can do most of what only `fields` could before. Removing `fields` unlocks further changes that will come in future releases. It’s also nice to have just one way of decoding objects (`fieldsAuto`), instead of having two. Finally, the changes to `fieldsAuto` gets rid of a flawed design choice which solves several reported bugs: [#22](https://github.com/lydell/tiny-decoders/issues/22) and [#24](https://github.com/lydell/tiny-decoders/issues/24).

- Changed: `optional` has been removed and replaced by `undefinedOr` and a new function called `field`. The `optional` function did two things: It made a decoder also accept `undefined`, and marked fields as optional. Now there’s one function for each use case.

- Added: The new `field` function returns a `Field` type, which is a decoder with some metadata. The metadata tells whether the field is optional, and whether the field has a different name in the JSON object.

- Changed: `fieldsAuto` takes an object like before, where the values are `Decoder`s like before, but now the values can be `Field`s as well (returned from the `field` function). Passing a plain `Decoder` instead of a `Field` is just a convenience shortcut for passing a `Field` with the default metadata (the field is required, and has the same name both in TypeScript and in JSON).

- Changed: `fieldsAuto` no longer computes which fields are optional by checking if the type of the field includes `| undefined`. Instead, it’s based purely on the `Field` metadata.

- Changed: `const myDecoder = fieldsAuto<MyType>({ /* ... */ })` now needs to be written as `const myDecoder: Decoder<MyType> = fieldsAuto({ /* ... */ })`. It is no longer recommended to specify the generic of `fieldsAuto`, and doing so does not mean the same thing anymore. Either annotate the decoder as any other, or don’t and infer the type.

- Added: `recursive`. It’s needed when making a decoder for a recursive data structure using `fieldsAuto`. (Previously, the recommendation was to use `fields` for recursive objects.)

- Changed: TypeScript 5+ is now required, because the above uses [const type parameters](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#const-type-parameters)) (added in 5.0), and leads to the [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes) (added in 4.4) option in `tsconfig.json` being recommended (see the documentation for the `field` function for why).

The motivation for the changes are:

- Supporting TypeScript’s [exactOptionalPropertyTypes](https://devblogs.microsoft.com/typescript/announcing-typescript-4-4/#exact-optional-property-types) option. That option decouples optional fields (`field?:`) and union with undefined (`| undefined`). Now tiny-decoders has done that too.

- Supporting generic decoders. Marking the fields as optional was previously done by looking for fields with `| undefined` in their type. However, if the type of a field is generic, TypeScript can’t know if the type is going to have `| undefined` until the generic type is instantiated with a concrete type. As such it couldn’t know if the field should be optional or not yet either. This resulted in it being very difficult and ugly trying to write a type annotation for a generic function returning a decoder – in practice it was unusable without forcing TypeScript to the wanted type annotation. [#24](https://github.com/lydell/tiny-decoders/issues/24)

- Stop setting all optional fields to `undefined` when they are missing (rather than leaving them out). [#22](https://github.com/lydell/tiny-decoders/issues/22)

- Better error messages for missing required fields.

  Before:

  ```
  At root["firstName"]:
  Expected a string

  Got: undefined
  ```

  After:

  ```
  At root:
  Expected an object with a field called: "firstName"
  Got: {
    "id": 1,
    "first_name": "John"
  }
  ```

  In other words, `fieldsAuto` now checks if fields exist, rather than trying to access them regardless. Previously, `fieldsAuto` ran `decoderAtKey(object[key])` even when `key` did not exist in `object`, which is equivalent to `decoderAtKey(undefined)`. Whether or not that succeeded was up to if `decoderAtKey` was using `optional` or not. This resulted in the worse (but technically correct) error message. The new version of `fieldsAuto` knows if the field is supposed to be optional or not thanks to the `Field` type and the `field` function mentioned above.

  > **Warning**  
  > Temporary behavior: If a field is missing and _not_ marked as optional, `fieldsAuto` still _tries_ the decoder at the field (passing `undefined` to it). If the decoder succeeds (because it allows `undefined` or succeeds for any input), that value is used. If it fails, the regular “missing field” error is thrown. This means that `fieldsAuto({ name: undefinedOr(string) })` successfully produces `{ name: undefined }` if given `{}` as input. It is supposed to fail in that case (because a required field is missing), but temporarily it does not fail. This is to support how `fieldsUnion` is used currently. When `fieldsUnion` is updated to a new API in an upcoming version of tiny-decoders, this temporary behavior in `fieldsAuto` will be removed.

- Being able to rename fields with `fieldsAuto`. Now you don’t need to refactor from `fieldsAuto` to `fields` anymore if you need to rename a field. This is done by using the `field` function.

- Getting rid of `fields` unlocks further changes that will come in future releases. (Note: `fields` is only deprecated in this release, not removed.)

Here’s an example illustrating the difference between optional fields and accepting `undefined`:

```ts
fieldsAuto({
  // Required field.
  a: string,

  // Optional field.
  b: field(string, { optional: true }),

  // Required field that can be set to `undefined`:
  c: undefinedOr(string),

  // Optional field that can be set to `undefined`:
  d: field(undefinedOr(string), { optional: true }),
});
```

The inferred type of the above is:

```ts
type Inferred = {
  a: string;
  b?: string;
  c: string | undefined;
  d?: string | undefined;
};
```

In all places where you use `optional(x)` currently, you need to figure out if you should use `undefinedOr(x)` or `field(x, { optional: true })` or `field(undefinedOr(x), { optional: true })`.

The `field` function also lets you rename fields. This means that you can refactor:

```ts
fields((field) => ({
  firstName: field("first_name", string),
}));
```

Into:

```ts
fieldsAuto({
  firstName: field(string, { renameFrom: "first_name" }),
});
```

If you used `fields` for other reasons, you can refactor them away by using `recursive`, `chain` and writing custom decoders.

Read the documentation for `fieldsAuto` and `field` to learn more about how they work.

### Version 10.0.0 (2023-10-15)

Changed: `multi` has a new API.

Before:

```ts
type Id = { tag: "Id"; id: string } | { tag: "LegacyId"; id: number };

const idDecoder: Decoder<Id> = multi({
  string: (id) => ({ tag: "Id" as const, id }),
  number: (id) => ({ tag: "LegacyId" as const, id }),
});
```

After:

```ts
type Id = { tag: "Id"; id: string } | { tag: "LegacyId"; id: number };

const idDecoder: Decoder<Id> = chain(multi(["string", "number"]), (value) => {
  switch (value.type) {
    case "string":
      return { tag: "Id" as const, id: value.value };
    case "number":
      return { tag: "LegacyId" as const, id: value.value };
  }
});
```

Like before, you specify the types you want (`string` and `number` above), but now you get a tagged union back (`{ type: "string", value: string } | { type: "number", value: number }`) instead of supplying functions to call for each type. You typically want to pair this with `chain`, switching on the different variants of the tagged union.

This change unlocks further changes that will come in future releases.

### Version 9.0.0 (2023-10-15)

Changed: `repr` now prints objects and arrays slightly differently, and some options have changed.

tiny-decoders has always printed representations of values on a single line. This stems back to when tiny-decoders used to print a “stack trace” (showing you a little of each parent object and array) – then it was useful to have a very short, one-line representation. Since that’s not a thing anymore, it’s more helpful to print objects and arrays multi-line: One array item or object key–value per line.

Here’s how the options have changed:

- `recurse: boolean`: Replaced by `depth: number`. Defaults to 0 (which prints the current object or array, but does not recurse).
- `recurseMaxLength`: Removed. `maxLength` is now used always. This is because values are printed multi-line; apart for the indentation there’s the same amount of space available regardless of how deeply nested a value is.
- `maxObjectChildren`: The default has changed from 3 to 5, which is the same as for `maxArrayChildren`.
- Finally, the new `indent: string` option is the indent used when recursing. It defaults to `"  "` (two spaces).

Before:

```
At root["user"]:
Expected a string
Got: {"firstName": "John", "lastName": "Doe", "dateOfBirth": Date, (4 more)}
```

After:

```
At root["user"]:
Expected a string
Got: {
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": Date,
  "tags": Array(2),
  "likes": 42,
  (2 more)
}
```

### Version 8.0.0 (2023-10-14)

Changed: `stringUnion` now takes an array instead of an object.

Before:

```ts
stringUnion({ green: null, red: null });
```

After:

```ts
stringUnion(["green", "red"]);
```

This is clearer, and made the implementation of `stringUnion` simpler.

If you have an object and want to use its keys for a string union there’s an example of that in the [type inference file](examples/type-inference.test.ts).

### Version 7.0.1 (2022-08-07)

- Fixed: The TypeScript definitions can now be found if you use `"type": "module"` in your package.json and `"module": "Node16"` or `"module": "NodeNext"` in your tsconfig.json.

### Version 7.0.0 (2022-03-27)

- Changed: Removed “tolerant decoding”:

  - Decoders no longer take an optional second `errors` parameter.
  - The `mode` option has been removed from `array`, `record` and `field`.
  - The `"push"` value has been removed from the `exact` option of `fields` and `fieldsAuto`.

  Out of all the projects I’ve used tiny-decoders in, only one of them has used this feature. And even in that case it was overkill. Regular all-or-nothing decoding is enough.

  Removing this feature makes tiny-decoders easier to understand, and tinier, which is the goal.

- Changed: `stringUnion` now accepts `Record<string, unknown>` instead of `Record<string, null>`. If you already have an object with the correct keys but non-null values, then it can be handy to be able to use that object.

### Version 6.0.1 (2022-02-20)

- Improved: `.message` of `DecoderError`s now link to the docs, which point you to using `.format()` instead for better error messages.
- Improved: Sensitive formatting now has `(Actual values are hidden in sensitive mode.)` in the message to make it more clear that it is _possible_ to get the actual values in the messages.

### Version 6.0.0 (2021-04-25)

- Removed: Flow support. This package has been re-written in TypeScript and is now TypeScript only.

- Changed: New API.

  - Renamed: `map` → `chain`
  - Renamed: `dict` → `record`
  - Renamed: `pair` → `tuple`
  - Renamed: `triple` → `tuple`
  - Renamed: `autoFields` → `fieldsAuto`

  - Removed: `lazy`. Use `fields` or `multi` instead.
  - Removed: `either`. Use `multi` or `fields` instead.
  - Removed: `constant`. I have not found any use case for it.
  - Removed: `WithUndefinedAsOptional`. `fields` and `fieldsAuto` do that (adding `?` to optional fields) automatically.
  - Removed: `repr.sensitive`. `repr` now takes a `sensitive: boolean` option instead, since you’re in control of formatting via `DecoderError`. For example, call `error.format({ sensitive: true })` on a caught `error` to format it sensitively.

  - Added: `multi`
  - Added: `tuple`
  - Added: `stringUnion`
  - Added: `fieldsUnion`
  - Added: `nullable`
  - Added: The `exact` option for `fields` and `fieldsAuto`, which lets you error on extraneous properties.

  - Changed: `optional` now only deals with `undefined`, not `null`. Use `nullable` for `null`. Use both if you want to handle both `undefined` and `null`.
  - Changed: Decoders now works on _either_ objects or arrays, not both. For example, `array` only accepts `Array`s, not array-like types. For array-like types, `instanceof`-check instead. `fields` still lets you work on arrays if you pass the `{ allow: "array" }`, for cases where `tuple` won’t cut it.
  - Decoders that take options now take an _object_ of options. For example, change `array(string, { default: undefined })` into `array(string, { mode: { default: undefined } })`.

- Changed: A few modern JavaScript features such as `class` and `...` spread are now used (which should be supported in all evergreen browsers, but not Internet Explorer).

- Changed: Slightly different error messages.

- Fixed: The package now works both in ESM and CJS.

- Fixed: `record` and `fieldsAuto` now avoid assigning to `__proto__`. The TypeScript types won’t even let you do it!

- Improved: The decoders now throw `DecoderError`s, which you can format in any way you like. Or just call `.format()` on them to go with the default formatting.

### Version 5.0.0 (2020-04-19)

- Changed: `record` is now called `fields` and now works with both objects and arrays. Besides being more flexible, this reduces the footprint of the library and means there’s one thing less to learn.
- Removed: `tuple`. Use `fields` instead.
- Changed: `pair`, `tuple` and `array` now work with any array-like objects, not just `Array`s.
- Removed: `mixedArray` and `mixedDict`. Because of the above changes, `mixedArray` isn’t used internally anymore and `mixedDict` had to change to allow arrays. I haven’t really had a need for these outside tiny-decoders so I decided to remove them both.
- Added: The `WithUndefinedAsOptional` helper type for TypeScript. When inferring types from `fields` and `autoRecord` decoders, all fields are inferred as required, even ones where you use the `optional` decoder. The helper type lets you turn fields that can be undefined into optional fields, by changing all `key: T | undefined` to `key?: T | undefined`.

### Version 4.0.0 (2019-09-29)

- Removed: The “stack trace,” showing you a little of each parent object and array, in error messages is now gone. After using tiny-decoders for a while I noticed this not being super useful. It’s nicer to look at the whole object in a tool of choice, and just use the error message to understand _where_ the error is, and what is wrong.
- Changed: `repr.short` is now called `repr.sensitive` because of the above change.
- Removed: The `key` option of `repr`. It’s not needed since the “stack traces” were removed.
- Changed: Object keys in the part showing you _where_ an error occurred are no longer truncated.
- Changed: Literals, such as strings, are now allowed to be 100 characters long before being truncated. Inside objects and arrays, the limit is 20 characters, just like before. The idea is that printed values are at most 100–120 characters roughly. Now, strings and other literals can utilize more of that space (rather than always being clipped already at 20 characters).
- Added: The `maxLength` and `recurseMaxLength` options of `repr` which control the above change.

### Version 3.1.0 (2019-09-15)

- Added: You can now set `repr.short = true` to get shorter error messages, containing only _where_ the error happened and the actual and expected types, but not showing any actual values. This is useful if you’re dealing with sensitive data, such as email addresses, passwords or social security numbers, you might not want that data to potentially appear in error logs. Another use case is if you simply prefer a shorter, one-line message.
- Improved: Documentation on type inference in TypeScript.

### Version 3.0.1 (2019-08-08)

- Fixed an oversight regarding the recommended type annotation for `autoRecord` decoders in Flow. No code changes.

### Version 3.0.0 (2019-08-08)

After using this library for a while in a real project, I found a bunch of things that could be better. This version brings some bigger changes to the API, making it more powerful and easier to use, and working better with TypeScript.

The new features adds half a kilobyte to the bundle, but it’s worth it.

- Added: When decoding arrays and objects, you can now opt into tolerant decoding, where you can recover from errors, either by skipping values or providing defaults. Whenever that happens, the message of the error that would otherwise have been thrown is pushed to an `errors` array (`Array<string>`, if provided), allowing you to inspect what was ignored.

- Added: A new `record` function. This makes renaming and combining fields much easier, and allows decoding by type name easily without having to learn about `andThen` and `fieldAndThen`. `field` has been integrated into `record` rather than being its own decoder. The old `record` function is now called `autoRecord`.

- Added: `tuple`. It’s like `record`, but for arrays/tuples.

- Added: `pair` and `triple`. These are convenience functions for decoding tuples of length 2 and 3. I found myself decoding quite a few pairs and the old way of doing it felt overly verbose. And the new `tuple` API wasn’t short enough either for these common cases.

- Changed: `record` has been renamed to `autoRecord`. (A new function has been added, and it’s called `record` but does not work like the old `record`.) `autoRecord` also has a new TypeScript type annotation, which is better and easier to understand.

- Changed: `fieldDeep` has been renamed to just `deep`, since `field` has been removed.

- Removed: `group`. There’s no need for it with the new API. It was mostly used to decode objects/records while renaming some keys. Many times the migration is easy:

  ```ts
  // Before:
  group({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
  });

  // After:
  record((field) => ({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
  }));
  ```

- Removed: `field`. It is now part of the new `record` and `tuple` functions (for `tuple` it’s called `item`). If you used `field` to pluck a single value you can migrate as follows:

  ```ts
  // Before:
  field("name", string);
  field(0, string);

  // After:
  record((field) => field("name", string));
  tuple((item) => item(0, string));
  ```

- Removed: `andThen`. I found no use cases for it after the new `record` function was added.

- Removed: `fieldAndThen`. There’s no need for it with the new `record` function. Here’s an example migration:

  Before:

  ```ts
  type Shape =
    | {
        type: "Circle";
        radius: number;
      }
    | {
        type: "Rectangle";
        width: number;
        height: number;
      };

  function getShapeDecoder(type: string): (value: unknown) => Shape {
    switch (type) {
      case "Circle":
        return record({
          type: () => "Circle",
          radius: number,
        });

      case "Rectangle":
        return record({
          type: () => "Rectangle",
          width: number,
          height: number,
        });

      default:
        throw new TypeError(`Invalid Shape type: ${repr(type)}`);
    }
  }

  const shapeDecoder = fieldAndThen("type", string, getShapeDecoder);
  ```

  After:

  ```ts
  type Shape =
    | {
        type: "Circle";
        radius: number;
      }
    | {
        type: "Rectangle";
        width: number;
        height: number;
      };

  function getShapeDecoder(type: string): Decoder<Shape> {
    switch (type) {
      case "Circle":
        return autoRecord({
          type: () => "Circle",
          radius: number,
        });

      case "Rectangle":
        return autoRecord({
          type: () => "Rectangle",
          width: number,
          height: number,
        });

      default:
        throw new TypeError(`Invalid Shape type: ${repr(type)}`);
    }
  }

  const shapeDecoder = record((field, fieldError, obj, errors) => {
    const decoder = field("type", getShapeDecoder);
    return decoder(obj, errors);
  });
  ```

  Alternatively:

  ```ts
  type Shape =
    | {
        type: "Circle";
        radius: number;
      }
    | {
        type: "Rectangle";
        width: number;
        height: number;
      };

  const shapeDecoder = record((field, fieldError): Shape => {
    const type = field("type", string);

    switch (type) {
      case "Circle":
        return {
          type: "Circle",
          radius: field("radius", number),
        };

      case "Rectangle":
        return autoRecord({
          type: "Rectangle",
          width: field("width", number),
          height: field("height", number),
        });

      default:
        throw fieldError("type", `Invalid Shape type: ${repr(type)}`);
    }
  });
  ```

### Version 2.0.0 (2019-06-07)

- Changed: `mixedArray` now returns `$ReadOnlyArray<mixed>` instead of `Array<mixed>`. See this Flow issue for more information: <https://github.com/facebook/flow/issues/7684>
- Changed: `mixedDict` now returns `{ +[string]: mixed }` (readonly) instead of `{ [string]: mixed }`. See this Flow issue for more information: <https://github.com/facebook/flow/issues/7685>

### Version 1.0.0 (2018-11-13)

- Initial release.
