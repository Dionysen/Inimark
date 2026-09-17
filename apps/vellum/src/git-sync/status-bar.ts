import { STATUS_EVENT, type SyncStatusPayload } from "@dionysen/git-sync";
import { isTauri } from "@dionysen/shell";
import { t } from "../i18n/index.ts";

/**
 * Bottom-left sync status chip for the main window.
 * Listens to Tauri `git-sync-status` events from push/restore commands.
 */
export function mountGitSyncStatusBar(host: HTMLElement): () => void {
  const el = document.createElement("div");
  el.className = "vellum-git-sync-status";
  el.dataset.state = "idle";
  el.textContent = t("syncStatus.idle");
  host.append(el);

  const apply = (payload: SyncStatusPayload) => {
    const state = payload.state || "idle";
    el.dataset.state = state;
    if (state === "syncing") {
      el.textContent = payload.message || t("syncStatus.syncing");
    } else if (state === "error") {
      el.textContent = t("syncStatus.error", {
        error: payload.error || payload.message || "unknown",
      });
      el.title = payload.error || payload.message || "";
    } else if (state === "ok") {
      el.textContent = payload.message || t("syncStatus.ok");
      el.title = "";
    } else {
      el.textContent = t("syncStatus.idle");
      el.title = "";
    }
  };

  let unlisten: (() => void) | undefined;
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlisten = await listen<SyncStatusPayload>(STATUS_EVENT, (event) => {
        apply(event.payload);
      });
    });
  }

  return () => {
    unlisten?.();
    el.remove();
  };
}
