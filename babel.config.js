function presets({ modules }) {
  return ["@babel/preset-flow", ["@babel/env", { loose: true, modules }]];
}

module.exports = {
  presets: presets({ modules: "commonjs" }),
  env: {
    esm: {
      presets: presets({ modules: false }),
    },
  },
};
