import { isTauri } from "../platform/env.ts";

const SETTINGS_WINDOW_LABEL = "settings";

let browserPopup: Window | null = null;

export async function openSettingsWindow(): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("toggle_settings_window");
    return;
  }

  if (browserPopup && !browserPopup.closed) {
    browserPopup.close();
    browserPopup = null;
    return;
  }

  browserPopup = window.open(
    "/settings.html",
    SETTINGS_WINDOW_LABEL,
    "width=920,height=640,resizable=yes",
  );

  if (!browserPopup) {
    throw new Error("Popup blocked — allow popups for this site to open settings.");
  }
}
