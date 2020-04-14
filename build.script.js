const fs = require("fs");
const path = require("path");

const babel = require("@babel/core");

const DIR = __dirname;
const DIST = path.join(DIR, "dist");
const INDEX = "src/index.js";

const READ_MORE =
  "**[➡️ Full readme](https://github.com/lydell/tiny-decoders/)**";

const FILES_TO_COPY = [
  { src: "LICENSE" },
  { src: "typescript/index.d.ts", dest: "index.d.ts" },
  { src: "package-real.json", dest: "package.json" },
  {
    src: "README.md",
    transform: (content) => content.replace(/<!--[^]*$/, READ_MORE),
  },
  {
    src: INDEX,
    dest: "index.js",
    transform: (content) => babel.transformSync(content).code,
  },
  {
    src: INDEX,
    dest: "index.mjs",
    transform: (content) =>
      babel.transformSync(content, { envName: "esm" }).code,
  },
  { src: INDEX, dest: "index.js.flow" },
];

if (fs.existsSync(DIST)) {
  fs.rmdirSync(DIST, { recursive: true });
}

fs.mkdirSync(DIST);

for (const { src, dest = src, transform } of FILES_TO_COPY) {
  if (transform) {
    fs.writeFileSync(
      path.join(DIST, dest),
      transform(fs.readFileSync(path.join(DIR, src), "utf8"))
    );
  } else {
    fs.copyFileSync(path.join(DIR, src), path.join(DIST, dest));
  }
}
