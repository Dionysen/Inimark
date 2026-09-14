/** Snapshot of an on-disk file used to detect external edits. */
export type DiskRevision = {
  mtimeMs: number;
  size: number;
  fingerprint: string;
};

/**
 * Stable fingerprint for markdown body comparison (FNV-1a 32-bit).
 * Used to ignore mtime-only bumps when content is unchanged.
 */
export function fingerprintContent(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildDiskRevision(
  text: string,
  meta: { mtimeMs: number; size: number },
): DiskRevision {
  return {
    mtimeMs: meta.mtimeMs,
    size: meta.size,
    fingerprint: fingerprintContent(text),
  };
}

export function metaMatchesRevision(
  revision: DiskRevision,
  meta: { mtimeMs: number; size: number },
): boolean {
  return revision.mtimeMs === meta.mtimeMs && revision.size === meta.size;
}

export type DiskProbeResult =
  | { status: "unchanged" }
  | { status: "same-content"; revision: DiskRevision }
  /** External content matches a revision the user chose to keep ignoring (watch only). */
  | { status: "dismissed" }
  | { status: "modified"; text: string; revision: DiskRevision }
  | { status: "deleted" }
  | { status: "unavailable"; message: string };

/**
 * Classify a disk probe against the last known revision / dismissed fingerprint.
 * Pure helper so unit tests can cover decision branches without the FS layer.
 *
 * @param respectDismissal When true (watch/focus), a matching dismissed fingerprint
 *   suppresses the banner without treating the file as same-content. Save probes
 *   pass false so overwrite conflicts still surface.
 */
export function classifyDiskProbe(input: {
  baseline: DiskRevision | null;
  dismissedFingerprint: string | null;
  exists: boolean;
  meta?: { mtimeMs: number; size: number };
  text?: string;
  errorMessage?: string;
  respectDismissal?: boolean;
}): DiskProbeResult {
  if (input.errorMessage) {
    return { status: "unavailable", message: input.errorMessage };
  }
  if (!input.exists) return { status: "deleted" };
  if (!input.baseline || input.meta == null || input.text == null) {
    return { status: "unavailable", message: "Missing baseline or disk snapshot." };
  }

  if (metaMatchesRevision(input.baseline, input.meta)) {
    return { status: "unchanged" };
  }

  const revision = buildDiskRevision(input.text, input.meta);
  if (revision.fingerprint === input.baseline.fingerprint) {
    return { status: "same-content", revision };
  }
  if (
    input.respectDismissal &&
    input.dismissedFingerprint != null &&
    revision.fingerprint === input.dismissedFingerprint
  ) {
    return { status: "dismissed" };
  }
  return { status: "modified", text: input.text, revision };
}
