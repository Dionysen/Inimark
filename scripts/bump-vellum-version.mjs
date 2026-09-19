#!/usr/bin/env node
/**
 * Bump the Vellum app version. Does not touch Inimark.
 *
 * Usage:
 *   pnpm bump-vellum-version 0.1.1
 *   pnpm bump-vellum-version v0.1.1
 *
 * Updates:
 *   - apps/vellum/package.json
 *   - apps/vellum/src-tauri/tauri.conf.json
 *   - apps/vellum/src-tauri/Cargo.toml
 *   - Cargo.lock (the vellum-app package only)
 *   - apps/vellum/src/settings/view.ts (about-page fallback)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAppVersion,
  setCargoLockPackageVersion,
  setCargoPackageVersion,
  setConstVersion,
  setJsonVersion,
} from "./lib/bump-app-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const version = parseAppVersion(process.argv[2]);
if (!version) {
  console.error("Usage: pnpm bump-vellum-version <version>");
  console.error("Example: pnpm bump-vellum-version 0.1.1");
  process.exit(1);
}

function apply(relativePath, transform) {
  const path = join(root, relativePath);
  const prev = readFileSync(path, "utf8");
  const next = transform(prev);
  if (next == null) {
    console.error(`Failed to update version in ${relativePath}`);
    process.exit(1);
  }
  if (next !== prev) writeFileSync(path, next);
  console.log(`${next === prev ? "unchanged" : "updated"}  ${relativePath}`);
}

console.log(`Bumping Vellum → ${version}\n`);

apply("apps/vellum/package.json", (text) => setJsonVersion(text, version));
apply("apps/vellum/src-tauri/tauri.conf.json", (text) => setJsonVersion(text, version));
apply("apps/vellum/src-tauri/Cargo.toml", (text) => setCargoPackageVersion(text, version));
apply("Cargo.lock", (text) => setCargoLockPackageVersion(text, "vellum-app", version));
apply("apps/vellum/src/settings/view.ts", (text) =>
  setConstVersion(text, "ABOUT_VERSION_FALLBACK", version),
);

const tag = `vellum-v${version}`;
console.log(`
Done. Write ## ${version} and ### What's new in apps/vellum/docs/版本历史.md, then commit.

Tag and push:

  git tag ${tag}
  git push origin ${tag}
`);
