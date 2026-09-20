export type SyncPhase = "pending" | "syncing" | "synced";

export interface SyncIndicator {
  phase: SyncPhase;
  /** An edit landed while a push was in flight, so success is not "fully synced". */
  editedDuringSync: boolean;
  /** Local edits not covered by the last successful push. */
  dirty: boolean;
  error: string;
}

export type SyncIndicatorEvent =
  | { type: "edit" }
  | { type: "boot-synced" }
  | { type: "remote"; state: string; error?: string };

export function createSyncIndicator(): SyncIndicator {
  return { phase: "pending", editedDuringSync: false, dirty: false, error: "" };
}

/** Pending (cloud + dot), syncing (spinner), or synced (cloud). Edits during a push stay pending. */
export function reduceSyncIndicator(
  state: SyncIndicator,
  event: SyncIndicatorEvent,
): SyncIndicator {
  switch (event.type) {
    case "edit":
      if (state.phase === "syncing") {
        return { ...state, editedDuringSync: true, dirty: true };
      }
      return { phase: "pending", editedDuringSync: false, dirty: true, error: "" };
    case "boot-synced":
      if (state.phase === "pending" && !state.dirty && !state.error) {
        return { ...state, phase: "synced" };
      }
      return state;
    case "remote":
      if (event.state === "syncing") {
        return { ...state, phase: "syncing", error: "" };
      }
      if (event.state === "ok") {
        if (state.editedDuringSync) {
          return { phase: "pending", editedDuringSync: false, dirty: true, error: "" };
        }
        return { phase: "synced", editedDuringSync: false, dirty: false, error: "" };
      }
      if (event.state === "error") {
        return {
          phase: "pending",
          editedDuringSync: false,
          dirty: true,
          error: event.error ?? "",
        };
      }
      return state;
  }
}

const CLOUD_PATH =
  "M17.5 19a4.5 4.5 0 0 0 .4-9 6 6 0 0 0-11.5-1.5A4 4 0 0 0 6.5 19Z";

export function syncIconMarkup(phase: SyncPhase): string {
  if (phase === "syncing") {
    return `<svg class="inimark-icon vellum-sync-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-dasharray="28 22"/></svg>`;
  }
  const dot =
    phase === "pending"
      ? `<circle class="vellum-sync-dot" cx="17" cy="8.2" r="2.15" fill="currentColor"/>`
      : "";
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="${CLOUD_PATH}"/>${dot}</svg>`;
}

export function renderSyncButton(
  button: HTMLButtonElement,
  state: SyncIndicator,
  labels: Record<SyncPhase, string>,
): void {
  button.type = "button";
  button.className = "vellum-git-sync-status";
  button.dataset.state = state.phase;
  button.setAttribute("aria-busy", state.phase === "syncing" ? "true" : "false");
  button.title = state.error;
  button.setAttribute("aria-label", labels[state.phase]);
  // Keep the label container mounted so status updates do not restart hover animation.
  let icon = button.querySelector<HTMLSpanElement>(".vellum-git-sync-status-icon");
  let label = button.querySelector<HTMLSpanElement>(".vellum-git-sync-status-label-text");
  if (!icon || !label) {
    icon = document.createElement("span");
    icon.className = "vellum-git-sync-status-icon";
    const reveal = document.createElement("span");
    reveal.className = "vellum-git-sync-status-label";
    reveal.setAttribute("aria-hidden", "true");
    label = document.createElement("span");
    label.className = "vellum-git-sync-status-label-text";
    reveal.append(label);
    button.replaceChildren(icon, reveal);
  }
  icon.innerHTML = syncIconMarkup(state.phase);
  label.textContent = labels[state.phase];
}
