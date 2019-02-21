function presets({ modules }) {
  return [
    "@babel/preset-flow",
    [
      "@babel/env",
      {
        loose: true,
        modules,
        exclude: ["@babel/plugin-transform-regenerator"],
      },
    ],
  ];
}

module.exports = {
  presets: presets({ modules: "commonjs" }),
  env: {
    esm: {
      presets: presets({ modules: false }),
    },
  },
};
