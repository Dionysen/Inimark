import { isTauri } from "../platform/env.ts";
import type { SettingsSection } from "./search-index.ts";

const SETTINGS_WINDOW_LABEL = "settings";
export const SETTINGS_NAVIGATE_SECTION_KEY = "inimark:settings-navigate-section";

export interface OpenSettingsWindowOptions {
  section?: SettingsSection;
}

let browserPopup: Window | null = null;

function queueSettingsSection(section: SettingsSection): void {
  localStorage.setItem(SETTINGS_NAVIGATE_SECTION_KEY, section);
}

export async function openSettingsWindow(
  options?: OpenSettingsWindowOptions,
): Promise<void> {
  if (options?.section) {
    queueSettingsSection(options.section);
  }

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    if (options?.section) {
      await invoke("show_settings_window");
    } else {
      await invoke("toggle_settings_window");
    }
    return;
  }

  if (browserPopup && !browserPopup.closed) {
    if (options?.section) {
      browserPopup.focus();
      return;
    }
    browserPopup.close();
    browserPopup = null;
    return;
  }

  const url = options?.section
    ? `/settings.html#${options.section}`
    : "/settings.html";
  browserPopup = window.open(
    url,
    SETTINGS_WINDOW_LABEL,
    "width=920,height=640,resizable=yes",
  );

  if (!browserPopup) {
    throw new Error("Popup blocked — allow popups for this site to open settings.");
  }
}
