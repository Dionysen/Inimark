#!/usr/bin/env node
/**
 * Print GitHub Release body for a version tag from docs Version History.
 *
 * Usage:
 *   node scripts/extract-release-notes.mjs v1.0.4
 *   node scripts/extract-release-notes.mjs 1.0.4 --fallback
 *
 * Without --fallback: prints nothing and exits 0 if the version is missing
 * (caller can apply its own default). With --fallback: always prints a body.
 *
 * Reads: docs/en/04-Appendix/Version History.md
 *        or the markdown file passed with --file
 */

import {
  DEFAULT_RELEASE_BODY,
  normalizeVersion,
  resolveReleaseNotes,
} from "./lib/release-notes.mjs";

const args = process.argv.slice(2);
let fallback = false;
/** @type {string | undefined} */
let historyPath;
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--fallback") {
    fallback = true;
    continue;
  }
  if (arg === "--file") {
    historyPath = args[i + 1];
    i += 1;
    continue;
  }
  positional.push(arg);
}
const raw = positional[0];

if (!raw) {
  console.error("Usage: node scripts/extract-release-notes.mjs <version> [--fallback]");
  console.error("Example: node scripts/extract-release-notes.mjs v1.0.4 --fallback");
  process.exit(1);
}

if (!normalizeVersion(raw)) {
  console.error(`Invalid version: ${raw}`);
  if (fallback) {
    process.stdout.write(DEFAULT_RELEASE_BODY);
    process.exit(0);
  }
  process.exit(1);
}

const body = resolveReleaseNotes(raw, {
  fallback,
  ...(historyPath ? { historyPath } : {}),
});
if (body) {
  process.stdout.write(body.endsWith("\n") ? body : `${body}\n`);
}
