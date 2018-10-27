# tiny-decoders

Type-safe data validation for the minimalist, inspired by [nvie/decoders] and
[Elm’s JSON Decoders].

[nvie/decoders]: https://github.com/nvie/decoders
[elm’s json decoders]:
  https://package.elm-lang.org/packages/elm/json/latest/Json-Decode

## Installation

```
npm install tiny-decoders
```

## Development

You can need [Node.js] 10 and npm 6.

- `npm run flow`: Run [Flow].
- `npm run eslint`: Run [ESLint] \(including [Flow] and [Prettier]).
- `npm run eslint:fix`: Autofix [ESLint] errors.
- `npm run jest`: Run unit tests. During development, `npm run jest -- --watch`
  is nice.
- `npm run coverage`: Run unit tests with code coverage.
- `npm build`: Compile with [Babel].
- `npm test`: Check that everything works.
- `npm publish`: Publish to [npm], but only if `npm test` passes.

## License

[MIT](LICENSE)

[babel]: https://babeljs.io/
[cors]: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
[eslint]: https://eslint.org/
[flow]: https://flow.org/
[jest]: https://jestjs.io/
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[prettier]: https://prettier.io/
