/**
 * Text transforms for bumping one app's version.
 * Callers decide which files to read and write.
 */

const SEMVER = /^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/;

/** Accept `0.1.4` or `v0.1.4`. Returns null when the string is not a version. */
export function parseAppVersion(raw) {
  if (!raw) return null;
  const version = String(raw).replace(/^v/i, "");
  return SEMVER.test(version) ? version : null;
}

/** Replace the first `"version"` field. Package manifests keep that field at the top. */
export function setJsonVersion(text, version) {
  const re = /("version"\s*:\s*")([^"]+)(")/;
  if (!re.test(text)) return null;
  return text.replace(re, `$1${version}$3`);
}

/** Replace the `[package]` version, not dependency versions further down the file. */
export function setCargoPackageVersion(text, version) {
  const re = /(\[package\][\s\S]*?^version\s*=\s*")([^"]*)(")/m;
  if (!re.test(text)) return null;
  return text.replace(re, `$1${version}$3`);
}

/**
 * Replace one package's version in Cargo.lock.
 * Returns null when that package is missing and the file is not already at `version`.
 */
export function setCargoLockPackageVersion(text, packageName, version) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const current = new RegExp(`name = "${escaped}"\\r?\\nversion = "([^"]*)"`).exec(text);
  if (!current) return null;
  if (current[1] === version) return text;
  return text.replace(
    new RegExp(`(name = "${escaped}"\\r?\\nversion = ")[^"]*(")`),
    `$1${version}$2`,
  );
}

/** Replace `const NAME = "1.2.3"` used when the desktop version cannot be read. */
export function setConstVersion(text, constName, version) {
  const escaped = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped}\\s*=\\s*")([^"]+)(")`);
  if (!re.test(text)) return null;
  return text.replace(re, `$1${version}$3`);
}
