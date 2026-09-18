import { STATUS_EVENT, type SyncStatusPayload } from "@dionysen/git-sync";
import { isTauri } from "@dionysen/shell";
import { t } from "../i18n/index.ts";
import {
  createSyncIndicator,
  reduceSyncIndicator,
  renderSyncButton,
  type SyncIndicatorEvent,
} from "./sync-indicator.ts";

export interface SyncStatusBar {
  /** The open chapter changed and is not in the last successful push. */
  markEdited(): void;
  /** A previous cloud sync exists and nothing has been edited yet. */
  noteSynced(): void;
  destroy(): void;
}

/**
 * Bottom-left button that forces a cloud push.
 * The label is 待同步, 正在同步, or 同步完成. The editor stays usable.
 */
export function mountGitSyncStatusBar(
  host: HTMLElement,
  options: { onSync(): void },
): SyncStatusBar {
  const button = document.createElement("button");
  let state = createSyncIndicator();

  const paint = () => {
    renderSyncButton(button, state, {
      pending: t("syncStatus.pending"),
      syncing: t("syncStatus.syncing"),
      synced: t("syncStatus.synced"),
    });
  };
  const apply = (event: SyncIndicatorEvent) => {
    state = reduceSyncIndicator(state, event);
    paint();
  };

  paint();
  button.addEventListener("click", () => options.onSync());
  host.append(button);

  let unlisten: (() => void) | undefined;
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlisten = await listen<SyncStatusPayload>(STATUS_EVENT, (event) => {
        apply({
          type: "remote",
          state: event.payload.state || "idle",
          error: event.payload.error || event.payload.message || "",
        });
      });
    });
  }

  return {
    markEdited: () => apply({ type: "edit" }),
    noteSynced: () => apply({ type: "boot-synced" }),
    destroy: () => {
      unlisten?.();
      button.remove();
    },
  };
}
