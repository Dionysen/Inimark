import { isTauri } from "../platform/env.ts";
import { loadSettings } from "../settings/store.ts";
import { requestUpdatePreflight } from "../update-bridge.ts";
import {
  checkForUpdate,
  downloadUpdate,
  formatProgressPercent,
  installDownloadedUpdate,
  relaunchApp,
} from "../updater.ts";

/** Background update polling interval (5 minutes). */
export const AUTO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type AutoUpdatePhase = "idle" | "available" | "downloading" | "installing";

export interface AutoUpdateState {
  phase: AutoUpdatePhase;
  version: string | null;
  progress: number;
}

export interface AutoUpdateService {
  subscribe(listener: (state: AutoUpdateState) => void): () => void;
  getState(): AutoUpdateState;
  start(): void;
  stop(): void;
  /** User-initiated install from the titlebar capsule. */
  startInstall(): Promise<void>;
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

  async function checkSilently(): Promise<void> {
    if (!isTauri() || checking || installing) return;
    if (state.phase === "downloading" || state.phase === "installing") return;

    checking = true;
    try {
      const settings = loadSettings();
      const info = await checkForUpdate({
        useSystemProxy: settings.useSystemProxyForUpdates,
      });
      if (info) {
        if (state.phase !== "available" || state.version !== info.version) {
          state = { phase: "available", version: info.version, progress: 0 };
          emit();
        }
        return;
      }

      if (state.phase === "available") {
        state = { phase: "idle", version: null, progress: 0 };
        emit();
      }
    } catch {
      /* Background checks fail silently. */
    } finally {
      checking = false;
    }
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
      const info = await checkForUpdate({
        useSystemProxy: settings.useSystemProxyForUpdates,
      });
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
  };
}
