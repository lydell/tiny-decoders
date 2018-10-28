const baseRules = require("eslint-config-lydell");

module.exports = {
  parser: "babel-eslint",
  plugins: [
    "flowtype",
    "flowtype-errors",
    "import",
    "jest",
    "prettier",
    "sort-imports-es6-autofix",
  ],
  env: { es6: true },
  rules: Object.assign({}, baseRules({ import: true }), {
    "no-console": "error",
    "prettier/prettier": "error",
    "sort-imports-es6-autofix/sort-imports-es6": "error",
    "symbol-description": "off",
  }),
  overrides: [
    {
      files: [".*.js", "*.config.js"],
      env: { node: true },
    },
    {
      files: ["{src,flow,test}/*.js"],
      rules: Object.assign({}, baseRules({ builtin: false, flow: true }), {
        "flowtype-errors/show-errors": "error",
      }),
    },
    {
      files: ["test/*.js"],
      env: { node: true, jest: true },
      globals: baseRules.browserEnv(),
      rules: baseRules({ builtin: false, jest: true }),
    },
  ],
};
