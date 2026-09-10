import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body: string;
  date: string;
}

export type UpdateErrorKind = "network" | "other";

export class UpdateDownloadCancelled extends Error {
  constructor() {
    super("Update download cancelled.");
    this.name = "UpdateDownloadCancelled";
  }
}

let cachedUpdate: Update | null = null;
let cancelDownload: (() => void) | null = null;

const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "network error",
  "network request failed",
  "err_network",
  "econnrefused",
  "enotfound",
  "etimedout",
  "econnreset",
  "enetunreach",
  "connection refused",
  "connection reset",
  "connection failed",
  "connection aborted",
  "connection timed out",
  "timed out",
  "timeout",
  "unable to connect",
  "could not connect",
  "no such host",
  "name not resolved",
  "dns",
  "resolve host",
  "offline",
  "no internet",
  "unreachable",
  "socket",
  "fetch failed",
  "network changed",
  "ns_error",
  "http status 408",
  "http status 502",
  "http status 503",
  "http status 504",
  "http status 522",
  "http status 524",
];

function errorMessage(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? "";
  } catch {
    return String(error);
  }
}

const TRANSIENT_HTTP_STATUS = /\b(408|502|503|504|522|524)\b/;

/** Classify updater failures so the UI can show actionable messages. */
export function classifyUpdateError(error: unknown): UpdateErrorKind {
  const text = errorMessage(error).trim().toLowerCase();
  if (!text) return "other";
  if (TRANSIENT_HTTP_STATUS.test(text)) return "network";
  if (NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern))) {
    return "network";
  }
  return "other";
}

/** Returns update info when a newer release exists; otherwise null. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const update = await check();
    if (!update) {
      cachedUpdate = null;
      return null;
    }
    cachedUpdate = update;
    return {
      version: update.version,
      body: update.body ?? "",
      date: update.date ?? "",
    };
  } catch (error) {
    cachedUpdate = null;
    throw error;
  }
}

export async function downloadAndInstall(
  onProgress?: (downloaded: number, contentLength: number | null) => void,
): Promise<void> {
  await downloadUpdate(onProgress);
  await installDownloadedUpdate();
}

/** Abort an in-progress update download started by {@link downloadUpdate}. */
export function cancelUpdateDownload(): void {
  cancelDownload?.();
}

export function isUpdateDownloadCancelled(error: unknown): boolean {
  return error instanceof UpdateDownloadCancelled;
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
    });

    if (aborted) {
      throw new UpdateDownloadCancelled();
    }
  } finally {
    cancelDownload = null;
  }
}

export async function installDownloadedUpdate(): Promise<void> {
  if (!cachedUpdate) {
    throw new Error("No downloaded update available.");
  }

  await cachedUpdate.install();
  cachedUpdate = null;
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}

export function formatProgressPercent(
  downloaded: number,
  contentLength: number | null,
): string {
  if (!contentLength || contentLength <= 0) {
    return downloaded > 0 ? "…" : "";
  }
  const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
  return `${pct}%`;
}
