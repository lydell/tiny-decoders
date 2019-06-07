### Version 2.0.0 (2019-06-07)

- Changed: `mixedArray` now returns `$ReadOnlyArray<mixed>` instead of
  `Array<mixed>`. See this Flow issue for more information:
  <https://github.com/facebook/flow/issues/7684>
- Changed: `mixedDict` now returns `{ +[string]: mixed }` (readonly) instead of
  `{ [string]: mixed }`. See this Flow issue for more information:
  <https://github.com/facebook/flow/issues/7685>

### Version 1.0.0 (2018-11-13)

- Initial release.
