### Version 3.0.1 (2019-08-08)

- Fixed an oversight regarding the recommended type annotation for `autoRecord`
  decoders in Flow. No code changes.

### Version 3.0.0 (2019-08-08)

After using this library for a while in a real project, I found a bunch of
things that could be better. This version brings some bigger changes to the API,
making it more powerful and easier to use, and working better with TypeScript.

The new features adds half a kilobyte to the bundle, but it’s worth it.

- Added: When decoding arrays and objects, you can now opt into tolerant
  decoding, where you can recover from errors, either by skipping values or
  providing defaults. Whenever that happens, the message of the error that would
  otherwise have been thrown is pushed to an `errors` array (`Array<string>`, if
  provided), allowing you to inspect what was ignored.

- Added: A new `record` function. This makes renaming and combining fields much
  easier, and allows decoding by type name easily without having to learn about
  `andThen` and `fieldAndThen`. `field` has been integrated into `record` rather
  than being its own decoder. The old `record` function is now called
  `autoRecord`.

- Added: `tuple`. It’s like `record`, but for arrays/tuples.

- Added: `pair` and `triple`. These are convenience functions for decoding
  tuples of length 2 and 3. I found myself decoding quite a few pairs and the
  old way of doing it felt overly verbose. And the new `tuple` API wasn’t short
  enough either for these common cases.

- Changed: `record` has been renamed to `autoRecord`. (A new function has been
  added, and it’s called `record` but does not work like the old `record`.)
  `autoRecord` also has a new TypeScript type annotation, which is better and
  easier to understand.

- Changed: `fieldDeep` has been renamed to just `deep`, since `field` has been
  removed.

- Removed: `group`. There’s no need for it with the new API. It was mostly used
  to decode objects/records while renaming some keys. Many times the migration
  is easy:

  ```ts
  // Before:
  group({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
  });

  // After:
  record(field => ({
    firstName: field("first_name", string),
    lastName: field("last_name", string),
  }));
  ```

- Removed: `field`. It is now part of the new `record` and `tuple` functions
  (for `tuple` it’s called `item`). If you used `field` to pluck a single value
  you can migrate as follows:

  ```ts
  // Before:
  field("name", string);
  field(0, string);

  // After:
  record(field => field("name", string));
  tuple(item => item(0, string));
  ```

- Removed: `andThen`. I found no use cases for it after the new `record`
  function was added.

- Removed: `fieldAndThen`. There’s no need for it with the new `record`
  function. Here’s an example migration:

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

  const shapeDecoder = record(
    (field, fieldError): Shape => {
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
    }
  );
  ```

### Version 2.0.0 (2019-06-07)

- Changed: `mixedArray` now returns `$ReadOnlyArray<mixed>` instead of
  `Array<mixed>`. See this Flow issue for more information:
  <https://github.com/facebook/flow/issues/7684>
- Changed: `mixedDict` now returns `{ +[string]: mixed }` (readonly) instead of
  `{ [string]: mixed }`. See this Flow issue for more information:
  <https://github.com/facebook/flow/issues/7685>

### Version 1.0.0 (2018-11-13)

- Initial release.
