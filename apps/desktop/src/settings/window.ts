import { isTauri } from "../platform/env.ts";

const SETTINGS_WINDOW_LABEL = "settings";

let browserPopup: Window | null = null;

export async function openSettingsWindow(): Promise<void> {
  if (isTauri()) {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const settings = await WebviewWindow.getByLabel(SETTINGS_WINDOW_LABEL);
    if (!settings) {
      throw new Error("Settings window is not configured");
    }
    await settings.show();
    await settings.setFocus();
    return;
  }

  if (browserPopup && !browserPopup.closed) {
    browserPopup.focus();
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
