import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";

const DIR = path.dirname(__dirname);
const BUILD = path.join(DIR, "build");

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
    transform: (content) =>
      content.replace(/^#[^]+?\n# /, "# ").replace(/^##[^]*/m, READ_MORE),
  },
];

if (fs.existsSync(BUILD)) {
  rimraf.sync(BUILD);
}

fs.mkdirSync(BUILD);

for (const { src, dest = src, transform } of FILES_TO_COPY) {
  if (transform !== undefined) {
    fs.writeFileSync(
      path.join(BUILD, dest),
      transform(fs.readFileSync(path.join(DIR, src), "utf8"))
    );
  } else {
    fs.copyFileSync(path.join(DIR, src), path.join(BUILD, dest));
  }
}

childProcess.spawnSync("npx", ["--no-install", "tsc"], {
  shell: true,
  stdio: "inherit",
});
