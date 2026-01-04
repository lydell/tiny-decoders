import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";

const DIR = path.dirname(import.meta.dirname);
const BUILD = path.join(DIR, "build");
const MODULE_BUILD = path.join(BUILD, "module");

const READ_MORE =
  "**[➡️ Full readme](https://github.com/lydell/tiny-decoders/#readme)**";

type FileToCopy = {
  src: string;
  dest?: string;
  transform?: (content: string) => string;
};

const FILES_TO_COPY: Array<FileToCopy> = [
  { src: "LICENSE" },
  { src: "package-real.json", dest: "package.json" },
  {
    src: "README.md",
    transform: (content) => content.replace(/^##[^]*/m, READ_MORE),
  },
];

fs.rmSync(BUILD, { recursive: true, force: true });

fs.mkdirSync(BUILD);

for (const { src, dest = src, transform } of FILES_TO_COPY) {
  if (transform !== undefined) {
    fs.writeFileSync(
      path.join(BUILD, dest),
      transform(fs.readFileSync(path.join(DIR, src), "utf8")),
    );
  } else {
    fs.copyFileSync(path.join(DIR, src), path.join(BUILD, dest));
  }
}

childProcess.execSync(
  "npx tsc --allowJs false --checkJs false --module CommonJS --declaration",
  { stdio: "inherit" },
);

fs.renameSync(path.join(BUILD, "index.js"), path.join(BUILD, "index.cjs"));

childProcess.execSync(
  `npx tsc --allowJs false --checkJs false --outDir ${MODULE_BUILD}`,
  { stdio: "inherit" },
);

fs.renameSync(
  path.join(MODULE_BUILD, "index.js"),
  path.join(BUILD, "index.mjs"),
);

fs.rmSync(MODULE_BUILD, { recursive: true, force: true });

for (const file of fs.readdirSync(BUILD)) {
  if (file.startsWith("vitest")) {
    fs.rmSync(path.join(BUILD, file));
  }
}
