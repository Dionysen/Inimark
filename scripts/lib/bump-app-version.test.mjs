import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAppVersion,
  setCargoLockPackageVersion,
  setCargoPackageVersion,
  setConstVersion,
  setJsonVersion,
} from "./bump-app-version.mjs";

test("parseAppVersion accepts a plain or v-prefixed semver", () => {
  assert.equal(parseAppVersion("0.1.1"), "0.1.1");
  assert.equal(parseAppVersion("v0.1.1"), "0.1.1");
  assert.equal(parseAppVersion("V1.2.3-rc.1"), "1.2.3-rc.1");
  assert.equal(parseAppVersion("vellum-v0.1.1"), null);
  assert.equal(parseAppVersion(""), null);
});

test("setJsonVersion changes only the first version field", () => {
  const text = `{
  "name": "@vellum/app",
  "version": "0.1.0",
  "dependencies": { "tauri": "2" }
}
`;
  const next = setJsonVersion(text, "0.2.0");
  assert.match(next, /"version": "0.2.0"/);
  assert.match(next, /"tauri": "2"/);
  assert.equal(setJsonVersion("{}", "0.2.0"), null);
});

test("setCargoPackageVersion ignores dependency versions", () => {
  const text = `[package]
name = "vellum-app"
version = "0.1.0"

[dependencies]
rfd = "0.16"
`;
  const next = setCargoPackageVersion(text, "0.2.0");
  assert.match(next, /name = "vellum-app"\nversion = "0.2.0"/);
  assert.match(next, /rfd = "0.16"/);
});

test("setCargoLockPackageVersion updates one package", () => {
  const text = `[[package]]
name = "inimark-app"
version = "1.0.9"

[[package]]
name = "vellum-app"
version = "0.1.0"
`;
  const next = setCargoLockPackageVersion(text, "vellum-app", "0.2.0");
  assert.match(next, /name = "inimark-app"\nversion = "1.0.9"/);
  assert.match(next, /name = "vellum-app"\nversion = "0.2.0"/);
  assert.equal(setCargoLockPackageVersion(text, "missing", "0.2.0"), null);
  assert.equal(setCargoLockPackageVersion(next, "vellum-app", "0.2.0"), next);
});

test("setConstVersion replaces the about-page fallback", () => {
  const text = `const ABOUT_VERSION_FALLBACK = "0.1.0";\n`;
  assert.equal(
    setConstVersion(text, "ABOUT_VERSION_FALLBACK", "0.2.0"),
    `const ABOUT_VERSION_FALLBACK = "0.2.0";\n`,
  );
});
