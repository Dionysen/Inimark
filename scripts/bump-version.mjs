#!/usr/bin/env node
/**
 * Bump Inimark app version across the monorepo.
 *
 * Usage:
 *   pnpm bump-version 0.1.4
 *   pnpm bump-version v0.1.4
 *
 * Updates:
 *   - package.json (root)
 *   - apps/desktop/package.json
 *   - packages/editor/package.json
 *   - apps/desktop/src-tauri/tauri.conf.json   ← used by GitHub Release / tauri-action
 *   - apps/desktop/src-tauri/Cargo.toml
 *   - apps/desktop/src/settings/view.ts (web fallbacks)
 *
 * Then commit and tag:
 *   git commit -am "chore: release v0.1.4"
 *   git tag v0.1.4
 *   git push origin main --tags
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const raw = process.argv[2];
if (!raw) {
  console.error("Usage: pnpm bump-version <version>");
  console.error("Example: pnpm bump-version 0.1.4");
  process.exit(1);
}

const version = raw.replace(/^v/i, "");
if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${raw}`);
  console.error("Expected semver like 0.1.4 or v0.1.4");
  process.exit(1);
}

function writeIfChanged(path, next) {
  let prev;
  try {
    prev = readFileSync(path, "utf8");
  } catch {
    prev = null;
  }
  if (prev === next) return false;
  writeFileSync(path, next);
  return true;
}

function updateJsonVersion(relativePath) {
  const path = join(root, relativePath);
  const json = JSON.parse(readFileSync(path, "utf8"));
  json.version = version;
  const next = `${JSON.stringify(json, null, 2)}\n`;
  const changed = writeIfChanged(path, next);
  console.log(`${changed ? "updated" : "unchanged"}  ${relativePath}`);
}

function updateCargoToml(relativePath) {
  const path = join(root, relativePath);
  const prev = readFileSync(path, "utf8");
  // Only the package version at the top of [package], not dependency versions.
  const re = /(\[package\][\s\S]*?^version\s*=\s*")([^"]*)(")/m;
  if (!re.test(prev)) {
    console.error(`Failed to find package version in ${relativePath}`);
    process.exit(1);
  }
  const next = prev.replace(re, `$1${version}$3`);
  const changed = writeIfChanged(path, next);
  console.log(`${changed ? "updated" : "unchanged"}  ${relativePath}`);
}

function updateViewFallbacks(relativePath) {
  const path = join(root, relativePath);
  const prev = readFileSync(path, "utf8");
  const next = prev.replace(
    /aboutVersion = "\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?"/g,
    `aboutVersion = "${version}"`,
  );
  if (next === prev && !prev.includes(`aboutVersion = "${version}"`)) {
    console.log(`skipped    ${relativePath} (no fallback literals found)`);
    return;
  }
  const changed = writeIfChanged(path, next);
  console.log(`${changed ? "updated" : "unchanged"}  ${relativePath}`);
}

function updateCargoLock(relativePath) {
  const path = join(root, relativePath);
  const prev = readFileSync(path, "utf8");
  const next = prev.replace(
    /(name = "inimark-desktop"\nversion = ")[^"]*(")/,
    `$1${version}$2`,
  );
  if (next === prev && !prev.includes(`name = "inimark-desktop"\nversion = "${version}"`)) {
    console.error(`Failed to update version in ${relativePath}`);
    process.exit(1);
  }
  const changed = writeIfChanged(path, next);
  console.log(`${changed ? "updated" : "unchanged"}  ${relativePath}`);
}

console.log(`Bumping version → ${version}\n`);

updateJsonVersion("package.json");
updateJsonVersion("apps/desktop/package.json");
updateJsonVersion("packages/editor/package.json");
updateJsonVersion("apps/desktop/src-tauri/tauri.conf.json");
updateCargoToml("apps/desktop/src-tauri/Cargo.toml");
updateCargoLock("apps/desktop/src-tauri/Cargo.lock");
updateViewFallbacks("apps/desktop/src/settings/view.ts");

console.log(`
Done. Next:
  git add -A
  git commit -m "chore: release v${version}"
  git tag v${version}
  git push origin HEAD --tags
`);
