const baseRules = require("eslint-config-lydell");

module.exports = {
  root: true,
  parser: "babel-eslint",
  plugins: ["flowtype", "import", "jest", "simple-import-sort"],
  env: { es6: true },
  rules: {
    ...baseRules({ import: true }),
    "no-console": "error",
    "simple-import-sort/sort": "error",
    "symbol-description": "off",
  },
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
      rules: baseRules({ builtin: false, flow: true }),
    },
    {
      files: ["{examples,test}/*.js"],
      env: { node: true, jest: true },
      globals: baseRules.browserEnv(),
      rules: baseRules({ builtin: false, jest: true }),
    },
  ],
};
