import { isTauri, joinWorkspacePath } from "../platform/env.ts";
import {
  buildDiskRevision,
  classifyDiskProbe,
  type DiskProbeResult,
  type DiskRevision,
} from "./disk-revision.ts";

export type ActiveFileDiskEvent =
  | { kind: "modified"; text: string; revision: DiskRevision }
  | { kind: "deleted" }
  | { kind: "same-content"; revision: DiskRevision };

export interface ActiveFileSyncController {
  /** Start watching a workspace-relative file; replaces any previous bind. */
  bind(rootPath: string, relativePath: string, text: string): Promise<void>;
  unbind(): Promise<void>;
  /** Suppress watch/focus probes for a short window after our own write. */
  markOwnWrite(): void;
  /** Refresh baseline after a successful save (or silent reload). */
  recordBaseline(text: string): Promise<void>;
  /** Clear “keep my edits” dismissal for the current disk fingerprint. */
  clearDismissal(): void;
  /** Remember a disk fingerprint the user chose to ignore until it changes again. */
  dismissRevision(revision: DiskRevision): void;
  /** True when the last probe saw a modified/deleted disk state that still needs attention. */
  hasPendingConflict(): boolean;
  /** Re-stat the bound file (watch callback, window focus, pre-save). */
  probe(): Promise<DiskProbeResult>;
  /** Watch/focus path: probe and emit UX events when the disk diverged. */
  checkNow(): Promise<void>;
  destroy(): void;
}

const OWN_WRITE_GUARD_MS = 1200;
const WATCH_DEBOUNCE_MS = 350;

type UnwatchFn = () => void;

/**
 * Watches the currently open workspace file for external edits.
 * Scope is intentionally one file — not the whole vault tree.
 */
export function createActiveFileSync(options: {
  onDiskEvent: (event: ActiveFileDiskEvent) => void;
}): ActiveFileSyncController {
  let absPath: string | null = null;
  let baseline: DiskRevision | null = null;
  let dismissedFingerprint: string | null = null;
  let pendingConflict = false;
  let ignoreUntil = 0;
  let generation = 0;
  let unwatch: UnwatchFn | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function clearDebounce(): void {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function stopWatch(): Promise<void> {
    clearDebounce();
    const stop = unwatch;
    unwatch = null;
    if (stop) {
      try {
        stop();
      } catch {
        /* ignore */
      }
    }
  }

  async function readMeta(path: string): Promise<{ mtimeMs: number; size: number }> {
    const { stat } = await import("@tauri-apps/plugin-fs");
    const info = await stat(path);
    return {
      mtimeMs: info.mtime?.getTime() ?? Date.now(),
      size: typeof info.size === "number" ? info.size : 0,
    };
  }

  async function captureBaseline(path: string, text: string): Promise<DiskRevision> {
    try {
      const meta = await readMeta(path);
      return buildDiskRevision(text, meta);
    } catch {
      return buildDiskRevision(text, {
        mtimeMs: Date.now(),
        size: text.length,
      });
    }
  }

  async function startWatch(path: string, gen: number): Promise<void> {
    if (!isTauri()) return;
    try {
      const { watch } = await import("@tauri-apps/plugin-fs");
      const stop = await watch(
        path,
        () => {
          if (destroyed || gen !== generation) return;
          clearDebounce();
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void emitProbe(gen);
          }, WATCH_DEBOUNCE_MS);
        },
        { delayMs: WATCH_DEBOUNCE_MS },
      );
      if (destroyed || gen !== generation) {
        stop();
        return;
      }
      unwatch = stop;
    } catch (error) {
      console.warn("Failed to watch active file:", error);
    }
  }

  async function emitProbe(gen: number): Promise<void> {
    if (destroyed || gen !== generation) return;
    if (Date.now() < ignoreUntil) return;
    const result = await probeInternal(gen, true);
    if (destroyed || gen !== generation) return;
    handleProbeResult(result);
  }

  function handleProbeResult(result: DiskProbeResult): void {
    if (
      result.status === "unchanged" ||
      result.status === "unavailable" ||
      result.status === "dismissed"
    ) {
      return;
    }
    if (result.status === "same-content") {
      baseline = result.revision;
      pendingConflict = false;
      options.onDiskEvent({ kind: "same-content", revision: result.revision });
      return;
    }
    if (result.status === "deleted") {
      pendingConflict = true;
      options.onDiskEvent({ kind: "deleted" });
      return;
    }
    pendingConflict = true;
    options.onDiskEvent({
      kind: "modified",
      text: result.text,
      revision: result.revision,
    });
  }

  async function probeInternal(
    gen: number,
    respectDismissal: boolean,
  ): Promise<DiskProbeResult> {
    if (!absPath || !baseline) {
      return { status: "unavailable", message: "No active file bound." };
    }
    if (gen !== generation) {
      return { status: "unavailable", message: "Stale generation." };
    }
    try {
      const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");
      const fileExists = await exists(absPath);
      if (!fileExists) {
        return classifyDiskProbe({
          baseline,
          dismissedFingerprint,
          exists: false,
          respectDismissal,
        });
      }
      const meta = await readMeta(absPath);
      if (metaMatchesFast(baseline, meta)) {
        return { status: "unchanged" };
      }
      const text = await readTextFile(absPath);
      if (gen !== generation) {
        return { status: "unavailable", message: "Stale generation." };
      }
      return classifyDiskProbe({
        baseline,
        dismissedFingerprint,
        exists: true,
        meta,
        text,
        respectDismissal,
      });
    } catch (error) {
      return {
        status: "unavailable",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    async bind(nextRoot, nextRelative, text) {
      if (destroyed) return;
      await stopWatch();
      generation += 1;
      const gen = generation;
      absPath = joinWorkspacePath(nextRoot, nextRelative);
      dismissedFingerprint = null;
      pendingConflict = false;
      if (!isTauri()) {
        baseline = buildDiskRevision(text, {
          mtimeMs: Date.now(),
          size: text.length,
        });
        return;
      }
      baseline = await captureBaseline(absPath, text);
      if (destroyed || gen !== generation) return;
      await startWatch(absPath, gen);
    },

    async unbind() {
      generation += 1;
      await stopWatch();
      absPath = null;
      baseline = null;
      dismissedFingerprint = null;
      pendingConflict = false;
    },

    markOwnWrite() {
      ignoreUntil = Date.now() + OWN_WRITE_GUARD_MS;
      pendingConflict = false;
    },

    async recordBaseline(text) {
      if (!absPath || destroyed) return;
      ignoreUntil = Date.now() + OWN_WRITE_GUARD_MS;
      dismissedFingerprint = null;
      pendingConflict = false;
      baseline = await captureBaseline(absPath, text);
    },

    clearDismissal() {
      dismissedFingerprint = null;
    },

    dismissRevision(revision) {
      dismissedFingerprint = revision.fingerprint;
      pendingConflict = false;
    },

    hasPendingConflict() {
      return pendingConflict;
    },

    async probe() {
      if (destroyed) {
        return { status: "unavailable", message: "Destroyed." };
      }
      if (Date.now() < ignoreUntil) return { status: "unchanged" };
      // Save / explicit checks must not honor banner dismissal.
      const result = await probeInternal(generation, false);
      if (result.status === "same-content") {
        baseline = result.revision;
        pendingConflict = false;
      } else if (result.status === "modified" || result.status === "deleted") {
        pendingConflict = true;
      }
      return result;
    },

    async checkNow() {
      await emitProbe(generation);
    },

    destroy() {
      destroyed = true;
      generation += 1;
      void stopWatch();
    },
  };
}

function metaMatchesFast(
  revision: DiskRevision,
  meta: { mtimeMs: number; size: number },
): boolean {
  return revision.mtimeMs === meta.mtimeMs && revision.size === meta.size;
}
