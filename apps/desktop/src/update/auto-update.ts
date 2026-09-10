import { isTauri } from "../platform/env.ts";
import { loadSettings } from "../settings/store.ts";
import { mergeUpdateCheckOptions } from "./dev-update-test.ts";
import { requestUpdatePreflight } from "../update-bridge.ts";
import {
  checkForUpdate,
  classifyUpdateError,
  downloadUpdate,
  formatProgressPercent,
  installDownloadedUpdate,
  relaunchApp,
  type UpdateErrorKind,
} from "../updater.ts";

/** Background update polling interval (5 minutes). */
export const AUTO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type AutoUpdatePhase = "idle" | "available" | "downloading" | "installing";

export type AutoUpdateCheckOutcome = "skipped" | "upToDate" | "available" | "error";

export interface AutoUpdateState {
  phase: AutoUpdatePhase;
  version: string | null;
  progress: number;
}

export interface AutoUpdateCheckReport {
  outcome: AutoUpdateCheckOutcome;
  version?: string;
  skippedReason?: string;
  errorMessage?: string;
  errorKind?: UpdateErrorKind;
}

export interface AutoUpdateService {
  subscribe(listener: (state: AutoUpdateState) => void): () => void;
  getState(): AutoUpdateState;
  start(): void;
  stop(): void;
  /** User-initiated install from the titlebar capsule. */
  startInstall(): Promise<void>;
  /** Run one background check immediately and return a dev-friendly report. */
  checkNow(): Promise<AutoUpdateCheckReport>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function createAutoUpdateService(): AutoUpdateService {
  let state: AutoUpdateState = { phase: "idle", version: null, progress: 0 };
  const listeners = new Set<(state: AutoUpdateState) => void>();
  let checking = false;
  let installing = false;
  let intervalId: number | null = null;
  let started = false;

  function emit(): void {
    const snapshot = { ...state };
    for (const listener of listeners) listener(snapshot);
  }

  async function performCheck(reportErrors: boolean): Promise<AutoUpdateCheckReport | null> {
    if (!isTauri()) {
      return reportErrors ? { outcome: "skipped", skippedReason: "not-tauri" } : null;
    }
    if (checking) {
      return reportErrors ? { outcome: "skipped", skippedReason: "already-checking" } : null;
    }
    if (installing) {
      return reportErrors ? { outcome: "skipped", skippedReason: "installing" } : null;
    }
    if (state.phase === "downloading" || state.phase === "installing") {
      return reportErrors
        ? { outcome: "skipped", skippedReason: `phase-${state.phase}` }
        : null;
    }

    checking = true;
    try {
      const settings = loadSettings();
      const info = await checkForUpdate(
        mergeUpdateCheckOptions({
          useSystemProxy: settings.useSystemProxyForUpdates,
        }),
      );
      if (info) {
        if (state.phase !== "available" || state.version !== info.version) {
          state = { phase: "available", version: info.version, progress: 0 };
          emit();
        }
        return { outcome: "available", version: info.version };
      }

      if (state.phase === "available") {
        state = { phase: "idle", version: null, progress: 0 };
        emit();
      }
      return { outcome: "upToDate" };
    } catch (error) {
      if (reportErrors) {
        return {
          outcome: "error",
          errorMessage: errorMessage(error),
          errorKind: classifyUpdateError(error),
        };
      }
      return null;
    } finally {
      checking = false;
    }
  }

  async function checkSilently(): Promise<void> {
    await performCheck(false);
  }

  async function startInstall(): Promise<void> {
    if (!isTauri() || installing || state.phase !== "available" || !state.version) {
      return;
    }

    const ready = await requestUpdatePreflight();
    if (!ready) return;

    installing = true;
    const version = state.version;
    state = { phase: "downloading", version, progress: 0 };
    emit();

    try {
      const settings = loadSettings();
      const info = await checkForUpdate(
        mergeUpdateCheckOptions({
          useSystemProxy: settings.useSystemProxyForUpdates,
        }),
      );
      if (!info) {
        state = { phase: "idle", version: null, progress: 0 };
        emit();
        return;
      }

      await downloadUpdate((downloaded, contentLength) => {
        const pctText = formatProgressPercent(downloaded, contentLength);
        const progress =
          pctText && pctText !== "…" ? Number.parseInt(pctText, 10) : downloaded > 0 ? 1 : 0;
        state = {
          phase: "downloading",
          version: info.version,
          progress: Number.isNaN(progress) ? 0 : progress,
        };
        emit();
      });

      state = { phase: "installing", version: info.version, progress: 100 };
      emit();

      await installDownloadedUpdate();
      await relaunchApp();
    } catch {
      state = { phase: "available", version, progress: 0 };
      emit();
    } finally {
      installing = false;
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => listeners.delete(listener);
    },
    getState() {
      return { ...state };
    },
    start() {
      if (!isTauri() || started) return;
      started = true;
      void checkSilently();
      intervalId = window.setInterval(() => {
        void checkSilently();
      }, AUTO_UPDATE_INTERVAL_MS);
    },
    stop() {
      started = false;
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
    startInstall,
    async checkNow() {
      return (await performCheck(true)) ?? { outcome: "skipped", skippedReason: "unknown" };
    },
  };
}
