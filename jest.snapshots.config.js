// Make snapshots for error messages easier to read.
// Before: `"\\"string\\""`
// After: `"string"`
module.exports = {
  test: (value) =>
    typeof value === "string" &&
    value.includes("Expected") &&
    !value.includes("\n"),
  print: (value) => value,
};
