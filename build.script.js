/* eslint-disable no-console */

const shell = require("shelljs");

shell.config.fatal = true;
shell.config.verbose = true;

const DIST = "dist";
const INDEX = "src/index.js";

shell.cd(__dirname);
shell.rm("-rf", DIST);
shell.mkdir(DIST);

shell.exec(`babel ${INDEX} --out-file ${DIST}/index.js`);
shell.exec(`babel --env-name esm ${INDEX} --out-file ${DIST}/index.mjs`);
shell.cp(INDEX, `${DIST}/index.js.flow`);
shell.cp("typescript/index.d.ts", `${DIST}/index.d.ts`);

console.log(shell.ls(DIST).join("  "));
