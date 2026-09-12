/**
 * Extract GitHub Release notes from the English Version History doc.
 *
 * Heading forms accepted (date suffix optional):
 *   ## 1.0.4
 *   ## v1.0.4 — 2026-09-12
 *   ## [1.0.4] - 2026-09-12
 *
 * Prefers the `### What's new` block inside that section.
 * If that subsection is missing, uses the whole version section body.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

/** Default English Version History path (CI source of truth). */
export const DEFAULT_VERSION_HISTORY_PATH = join(
  REPO_ROOT,
  "docs",
  "en",
  "04-Appendix",
  "Version History.md",
);

/** Same download blurb as the historical release.yml template. */
export const DEFAULT_RELEASE_BODY = `See the assets below to download and install this version.

| Platform | Asset |
| --- | --- |
| macOS (Apple Silicon) | \`.dmg\` / \`.app.tar.gz\` |
| macOS (Intel) | \`.dmg\` / \`.app.tar.gz\` |
| Windows | \`.msi\` / \`.exe\` (NSIS) |
| Linux | \`.AppImage\` / \`.deb\` |

In-app updates use \`latest.json\` from this release.`;

/**
 * Normalize tag / version input to bare semver (no leading `v`).
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeVersion(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const withoutV = trimmed.replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(withoutV)) return null;
  return withoutV;
}

/**
 * Strip YAML frontmatter if present.
 * @param {string} markdown
 * @returns {string}
 */
export function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 4).replace(/^\r?\n+/, "");
}

/**
 * Find the markdown body for one version section.
 * @param {string} markdown
 * @param {string} version bare semver
 * @returns {string | null}
 */
export function findVersionSection(markdown, version) {
  const body = stripFrontmatter(markdown);
  const escaped = version.replace(/\./g, "\\.");
  // ## 1.0.4 | ## v1.0.4 | ## [1.0.4]  + optional " — date" / " - date"
  const headingRe = new RegExp(
    `^##\\s+(?:\\[)?v?${escaped}(?:\\])?(?:\\s*[—–-]\\s*.*)?\\s*$`,
    "im",
  );
  const match = headingRe.exec(body);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextHeading = /^##\s+/m.exec(rest);
  const section = (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
  return section.length > 0 ? section : null;
}

/**
 * Prefer ### What's new; otherwise return the full section.
 * @param {string} section
 * @returns {string}
 */
export function pickWhatsNew(section) {
  const headingRe = /^###\s+What'?s new\s*$/im;
  const match = headingRe.exec(section);
  if (!match || match.index === undefined) {
    return trimTrailingRules(section);
  }

  const start = match.index;
  const afterHeading = section.slice(start);
  const rest = afterHeading.slice(match[0].length);
  const nextSub = /^###\s+/m.exec(rest);
  const block = nextSub
    ? afterHeading.slice(0, match[0].length + nextSub.index)
    : afterHeading;
  return trimTrailingRules(block);
}

/** Drop trailing markdown thematic breaks (`---`) left between version sections. */
function trimTrailingRules(text) {
  return text.replace(/(?:\r?\n)+---\s*$/u, "").trim();
}

/**
 * Build the final GitHub Release body from a What's new block.
 * @param {string} whatsNew
 * @returns {string}
 */
export function formatReleaseBody(whatsNew) {
  const notes = whatsNew.trim();
  if (!notes) return DEFAULT_RELEASE_BODY;
  return `${notes}\n\n---\n\n${DEFAULT_RELEASE_BODY}`;
}

/**
 * Extract release notes for a version from Version History markdown.
 * @param {string} markdown
 * @param {string} versionOrTag
 * @returns {string | null} formatted body, or null if version not documented
 */
export function extractReleaseNotes(markdown, versionOrTag) {
  const version = normalizeVersion(versionOrTag);
  if (!version) return null;
  const section = findVersionSection(markdown, version);
  if (!section) return null;
  const whatsNew = pickWhatsNew(section);
  if (!whatsNew) return null;
  return formatReleaseBody(whatsNew);
}

/**
 * Read Version History from disk and extract notes.
 * @param {string} versionOrTag
 * @param {{ historyPath?: string, fallback?: boolean }} [options]
 * @returns {string | null} body string; with fallback:true never null
 */
export function resolveReleaseNotes(versionOrTag, options = {}) {
  const historyPath = options.historyPath ?? DEFAULT_VERSION_HISTORY_PATH;
  const fallback = options.fallback === true;
  let markdown;
  try {
    markdown = readFileSync(historyPath, "utf8");
  } catch {
    return fallback ? DEFAULT_RELEASE_BODY : null;
  }
  const extracted = extractReleaseNotes(markdown, versionOrTag);
  if (extracted) return extracted;
  return fallback ? DEFAULT_RELEASE_BODY : null;
}
