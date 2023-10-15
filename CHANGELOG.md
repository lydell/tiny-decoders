Note: I’m currently working on several breaking changes to tiny-decoders, but I’m trying out releasing them piece by piece. The idea is that you can either upgrade version by version only having to deal with one or a few breaking changes at a time, or wait and do a bunch of them at the same time.

### Version 10.0.0 (unreleased)

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
