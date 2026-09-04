import { isTauri } from "../platform/env.ts";

const SETTINGS_WINDOW_LABEL = "settings";
const SETTINGS_URL = "settings.html";

let browserPopup: Window | null = null;

export async function openSettingsWindow(): Promise<void> {
  if (isTauri()) {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const existing = await WebviewWindow.getByLabel(SETTINGS_WINDOW_LABEL);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }

    const win = new WebviewWindow(SETTINGS_WINDOW_LABEL, {
      url: SETTINGS_URL,
      title: "Inimark Settings",
      width: 920,
      height: 640,
      resizable: true,
      center: true,
    });

    await new Promise<void>((resolve, reject) => {
      void win.once("tauri://created", () => resolve());
      void win.once("tauri://error", (event) => {
        reject(new Error(`Settings window failed: ${String(event.payload)}`));
      });
    });
    return;
  }

  if (browserPopup && !browserPopup.closed) {
    browserPopup.focus();
    return;
  }

  browserPopup = window.open(
    `/${SETTINGS_URL}`,
    SETTINGS_WINDOW_LABEL,
    "width=920,height=640,resizable=yes",
  );

  if (!browserPopup) {
    throw new Error("Popup blocked — allow popups for this site to open settings.");
  }
}
