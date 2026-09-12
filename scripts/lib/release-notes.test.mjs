import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_RELEASE_BODY,
  extractReleaseNotes,
  findVersionSection,
  normalizeVersion,
  pickWhatsNew,
  resolveReleaseNotes,
  stripFrontmatter,
} from "./release-notes.mjs";

const SAMPLE = `---
title: Version History
lang: en
---

# Version History

## 1.0.4 — 2026-09-12

**Release page:** https://example.test/v1.0.4

### What's new

- Focus mode
- Publish polish

### Extra

- ignored for release body

## 1.0.3

Plain section without What's new.

- Site graph

## [1.0.0] - 2026-09-06

### What's new

- First public release
`;

test("normalizeVersion accepts v-prefix and rejects junk", () => {
  assert.equal(normalizeVersion("v1.0.4"), "1.0.4");
  assert.equal(normalizeVersion("1.0.4"), "1.0.4");
  assert.equal(normalizeVersion("  v2.0.0-beta.1 "), "2.0.0-beta.1");
  assert.equal(normalizeVersion("latest"), null);
  assert.equal(normalizeVersion(""), null);
});

test("stripFrontmatter removes YAML block", () => {
  const out = stripFrontmatter(SAMPLE);
  assert.ok(out.startsWith("# Version History"));
  assert.ok(!out.includes("translationKey"));
});

test("findVersionSection matches dated, bare, and bracket headings", () => {
  assert.match(findVersionSection(SAMPLE, "1.0.4") ?? "", /Focus mode/);
  assert.match(findVersionSection(SAMPLE, "1.0.3") ?? "", /Site graph/);
  assert.match(findVersionSection(SAMPLE, "1.0.0") ?? "", /First public release/);
  assert.equal(findVersionSection(SAMPLE, "9.9.9"), null);
});

test("pickWhatsNew prefers the subsection and stops before the next ###", () => {
  const section = findVersionSection(SAMPLE, "1.0.4");
  assert.ok(section);
  const picked = pickWhatsNew(section);
  assert.match(picked, /### What's new/);
  assert.match(picked, /Focus mode/);
  assert.doesNotMatch(picked, /ignored for release body/);
});

test("pickWhatsNew strips trailing thematic breaks between versions", () => {
  const md = `# History

## 1.0.1 — 2026-01-01

### What's new

- One fix

---

## 1.0.0

### What's new

- First
`;
  const body = extractReleaseNotes(md, "1.0.1");
  assert.ok(body);
  assert.doesNotMatch(body, /---\n\n---/);
  assert.match(body, /One fix\n\n---\n\nSee the assets/);
});

test("extractReleaseNotes formats body with download footer", () => {
  const body = extractReleaseNotes(SAMPLE, "v1.0.4");
  assert.ok(body);
  assert.match(body, /Focus mode/);
  assert.match(body, /See the assets below/);
  assert.match(body, /latest\.json/);
});

test("extractReleaseNotes falls back to full section when What's new is absent", () => {
  const body = extractReleaseNotes(SAMPLE, "1.0.3");
  assert.ok(body);
  assert.match(body, /Site graph/);
  assert.match(body, /See the assets below/);
});

test("extractReleaseNotes returns null for unknown versions", () => {
  assert.equal(extractReleaseNotes(SAMPLE, "v0.0.1"), null);
});

test("resolveReleaseNotes reads a file and honors fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "inimark-notes-"));
  const path = join(dir, "history.md");
  writeFileSync(path, SAMPLE, "utf8");

  const found = resolveReleaseNotes("v1.0.4", { historyPath: path });
  assert.ok(found?.includes("Focus mode"));

  const missing = resolveReleaseNotes("v9.9.9", { historyPath: path });
  assert.equal(missing, null);

  const withFallback = resolveReleaseNotes("v9.9.9", {
    historyPath: path,
    fallback: true,
  });
  assert.equal(withFallback, DEFAULT_RELEASE_BODY);

  const missingFile = resolveReleaseNotes("v1.0.4", {
    historyPath: join(dir, "nope.md"),
    fallback: true,
  });
  assert.equal(missingFile, DEFAULT_RELEASE_BODY);
});
