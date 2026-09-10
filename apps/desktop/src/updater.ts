import { Update, type DownloadOptions } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "./platform/env.ts";
import { isMacDevInstallBlocked } from "./update/dev-update-test.ts";

export interface UpdateInfo {
  version: string;
  body: string;
  date: string;
}

export interface UpdateCheckOptions {
  /** When false, bypass system and explicit proxies for the updater only. */
  useSystemProxy?: boolean;
  /** Dev-only: pretend the app is this version when comparing against the remote release. */
  devCurrentVersionOverride?: string;
}

export type UpdateErrorKind = "network" | "other";

export class UpdateDownloadCancelled extends Error {
  constructor() {
    super("Update download cancelled.");
    this.name = "UpdateDownloadCancelled";
  }
}

export class DevUpdateInstallBlocked extends Error {
  constructor() {
    super("Update install is blocked in macOS dev builds.");
    this.name = "DevUpdateInstallBlocked";
  }
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

/** Prevent update checks/downloads from hanging indefinitely behind a proxy. */
export const UPDATE_REQUEST_TIMEOUT_MS = 30_000;

function buildDownloadOptions(): DownloadOptions {
  return { timeout: UPDATE_REQUEST_TIMEOUT_MS };
}

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
      devCurrentVersionOverride: options.devCurrentVersionOverride ?? null,
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
