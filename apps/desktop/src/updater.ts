import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body: string;
  date: string;
}

let cachedUpdate: Update | null = null;

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
  if (!cachedUpdate) {
    throw new Error("No update available. Check for updates first.");
  }

  let downloaded = 0;
  let contentLength: number | null = null;

  await cachedUpdate.downloadAndInstall((event) => {
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
