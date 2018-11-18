const baseRules = require("eslint-config-lydell");

module.exports = {
  root: true,
  parser: "babel-eslint",
  plugins: [
    "flowtype",
    "flowtype-errors",
    "import",
    "jest",
    "prettier",
    "simple-import-sort",
  ],
  env: { es6: true },
  rules: Object.assign({}, baseRules({ import: true }), {
    "no-console": "error",
    "prettier/prettier": "error",
    "simple-import-sort/sort": "error",
    "symbol-description": "off",
  }),
  overrides: [
    {
      files: [".*.js", "*.{config,script}.js"],
      env: { node: true },
      rules: {
        "import/order": ["error", { "newlines-between": "always" }],
      },
    },
    {
      files: ["{src,flow,examples,test}/*.js"],
      rules: Object.assign({}, baseRules({ builtin: false, flow: true }), {
        "flowtype-errors/show-errors": "error",
      }),
    },
    {
      files: ["{examples,test}/*.js"],
      env: { node: true, jest: true },
      globals: baseRules.browserEnv(),
      rules: baseRules({ builtin: false, jest: true }),
    },
  ],
};
