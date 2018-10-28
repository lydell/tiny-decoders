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

### npm scripts

- `npm run flow`: Run [Flow].
- `npm run eslint`: Run [ESLint] \(including [Flow] and [Prettier]).
- `npm run eslint:fix`: Autofix [ESLint] errors.
- `npm run dtslint`: Run [dtslint].
- `npm run prettier`: Run [Prettier] for files other than JS.
- `npm run jest`: Run unit tests. During development, `npm run jest -- --watch`
  is nice.
- `npm run coverage`: Run unit tests with code coverage.
- `npm build`: Compile with [Babel].
- `npm test`: Check that everything works.
- `npm publish`: Publish to [npm], but only if `npm test` passes.

### Directories

- `src/`: Source code.
- `examples/`: Examples, in the form of [Jest] tests.
- `test/`: [Jest] tests.
- `flow/`: [Flow] typechecking tests. Turn off “ExpectError” in .flowconfig to
  see what the errors look like.
- `typescript/`: [TypeScript] type definitions, config and typechecking tests.
- `dist/`: Compiled code, built by `npm run build`. This is what is published in
  the npm package.

## License

[MIT](LICENSE)

[babel]: https://babeljs.io/
[cors]: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
[dtslint]: https://github.com/Microsoft/dtslint/
[eslint]: https://eslint.org/
[flow]: https://flow.org/
[jest]: https://jestjs.io/
[node.js]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[prettier]: https://prettier.io/
[typescript]: http://www.typescriptlang.org/
