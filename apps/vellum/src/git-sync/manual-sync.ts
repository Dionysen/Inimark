import type { PushResult } from "@dionysen/git-sync";

/** Settings asks the main window to flush edits, then push. */
export const CLOUD_SYNC_REQUEST = "vellum-cloud-sync-request";
export const CLOUD_SYNC_RESULT = "vellum-cloud-sync-result";

export interface CloudSyncRequest {
  id: string;
}

export interface CloudSyncResultPayload {
  id: string;
  ok: boolean;
  path?: string;
  remoteBackupCount?: number;
  error?: string;
  busy?: boolean;
}

export function isSyncBusy(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: unknown }).code === "sync_busy";
}

export function syncErrorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return String(err);
}

/**
 * Ask the editor window to save, then upload a `.pwb`.
 * The settings page stays interactive; only the button shows progress.
 */
export function requestManualCloudSync(): Promise<PushResult> {
  return new Promise((resolve, reject) => {
    void import("@tauri-apps/api/event").then(async ({ emit, listen }) => {
      const id = crypto.randomUUID();
      const unlisten = await listen<CloudSyncResultPayload>(CLOUD_SYNC_RESULT, (event) => {
        if (event.payload.id !== id) return;
        unlisten();
        if (event.payload.busy) {
          reject({ code: "sync_busy", message: "sync already running" });
          return;
        }
        if (!event.payload.ok) {
          reject(new Error(event.payload.error || "sync failed"));
          return;
        }
        resolve({
          path: event.payload.path ?? "",
          remoteBackupCount: event.payload.remoteBackupCount ?? 0,
          pruned: 0,
        });
      });
      await emit(CLOUD_SYNC_REQUEST, { id } satisfies CloudSyncRequest);
    }, reject);
  });
}
