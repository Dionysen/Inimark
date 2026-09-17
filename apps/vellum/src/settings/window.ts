import { openAuxWindow } from "@dionysen/settings-kit";
import { isTauri } from "@dionysen/shell";

export const SETTINGS_NAVIGATE_SECTION_KEY = "vellum:settings-navigate-section";

export async function openSettingsWindow(section?: string): Promise<void> {
  await openAuxWindow({
    label: "settings",
    url: "/settings.html",
    section,
    navigateStorageKey: SETTINGS_NAVIGATE_SECTION_KEY,
    isTauri,
    showCommand: "show_settings_window",
    toggleCommand: "toggle_settings_window",
  });
}
