import { openAuxWindow } from "@dionysen/settings-kit";
import { isTauri } from "../platform/env.ts";
import type { SettingsSection } from "./search-index.ts";

export const SETTINGS_NAVIGATE_SECTION_KEY = "inimark:settings-navigate-section";

export interface OpenSettingsWindowOptions {
  section?: SettingsSection;
}

export async function openSettingsWindow(
  options?: OpenSettingsWindowOptions,
): Promise<void> {
  await openAuxWindow({
    label: "settings",
    url: "/settings.html",
    section: options?.section,
    navigateStorageKey: SETTINGS_NAVIGATE_SECTION_KEY,
    isTauri,
    showCommand: "show_settings_window",
    toggleCommand: "toggle_settings_window",
  });
}
