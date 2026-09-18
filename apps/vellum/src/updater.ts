import { Update, type DownloadOptions } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { detectPlatform, isTauri } from "@dionysen/shell";

export {
  classifyUpdateError,
  formatProgressPercent,
  type UpdateErrorKind,
} from "./updater-status.ts";

export interface UpdateInfo {
  version: string;
  body: string;
  date: string;
}

export interface UpdateCheckOptions {
  /** When false, the check ignores system and explicit proxies. */
  useSystemProxy?: boolean;
}

export class UpdateDownloadCancelled extends Error {
  constructor() {
    super("Update download cancelled.");
    this.name = "UpdateDownloadCancelled";
  }
}

/** macOS `tauri dev` replaces the local .app on install and breaks the next run. */
export class DevUpdateInstallBlocked extends Error {
  constructor() {
    super("Update install is blocked in macOS dev builds.");
    this.name = "DevUpdateInstallBlocked";
  }
}

function isMacDevInstallBlocked(): boolean {
  return Boolean(import.meta.env.DEV) && detectPlatform() === "macos";
}

interface UpdateMetadata {
  rid: number;
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
}

let cachedUpdate: Update | null = null;
let cancelDownload: (() => void) | null = null;

/** Prevent update checks and downloads from hanging behind a dead proxy. */
export const UPDATE_REQUEST_TIMEOUT_MS = 30_000;

function buildDownloadOptions(): DownloadOptions {
  return { timeout: UPDATE_REQUEST_TIMEOUT_MS };
}

/**
 * Returns update info when a newer release exists on the Vellum channel.
 * `null` means the installed version is current.
 */
export async function checkForUpdate(
  options: UpdateCheckOptions = {},
): Promise<UpdateInfo | null> {
  const useSystemProxy = options.useSystemProxy ?? true;
  try {
    if (!isTauri()) {
      return null;
    }

    const { invoke } = await import("@tauri-apps/api/core");
    const metadata = await invoke<UpdateMetadata | null>("check_app_update", {
      useSystemProxy,
      timeoutMs: UPDATE_REQUEST_TIMEOUT_MS,
    });
    if (!metadata) {
      cachedUpdate = null;
      return null;
    }

    cachedUpdate = new Update(metadata);
    return {
      version: cachedUpdate.version,
      body: cachedUpdate.body ?? "",
      date: cachedUpdate.date ?? "",
    };
  } catch (error) {
    cachedUpdate = null;
    throw error;
  }
}

/** Abort an in-progress update download started by {@link downloadUpdate}. */
export function cancelUpdateDownload(): void {
  cancelDownload?.();
}

export function isUpdateDownloadCancelled(error: unknown): boolean {
  return error instanceof UpdateDownloadCancelled;
}

export function isDevUpdateInstallBlocked(error: unknown): boolean {
  return error instanceof DevUpdateInstallBlocked;
}

export async function downloadUpdate(
  onProgress?: (downloaded: number, contentLength: number | null) => void,
): Promise<void> {
  if (!cachedUpdate) {
    throw new Error("No update available. Check for updates first.");
  }

  const update = cachedUpdate;
  let downloaded = 0;
  let contentLength: number | null = null;
  let aborted = false;

  cancelDownload = () => {
    aborted = true;
    void update.close().catch(() => {});
    cachedUpdate = null;
  };

  try {
    await update.download((event) => {
      if (aborted) return;
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? null;
          onProgress?.(0, contentLength);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress?.(downloaded, contentLength);
          break;
        case "Finished":
          onProgress?.(downloaded, contentLength);
          break;
      }
    }, buildDownloadOptions());

    if (aborted) {
      throw new UpdateDownloadCancelled();
    }
  } finally {
    cancelDownload = null;
  }
}

export async function installDownloadedUpdate(): Promise<void> {
  if (isMacDevInstallBlocked()) {
    throw new DevUpdateInstallBlocked();
  }

  if (!cachedUpdate) {
    throw new Error("No downloaded update available.");
  }

  await cachedUpdate.install();
  cachedUpdate = null;
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
