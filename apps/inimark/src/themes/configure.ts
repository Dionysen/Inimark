import { configureTheme, DEFAULT_APP_THEME_PAIR } from "@dionysen/theme";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n/index.ts";

/** Invoke Inimark's native sampler and normalize a user cancellation. */
async function pickInimarkScreenColor(): Promise<string | null> {
  try {
    return await invoke<string>("pick_screen_color");
  } catch (error) {
    if (/cancel/i.test(String(error))) return null;
    throw error;
  }
}

/** Bind Inimark product keys / i18n into @dionysen/theme before initThemeManager(). */
export function configureInimarkTheme(): void {
  configureTheme({
    productId: "inimark",
    storageKeys: {
      appearanceMode: "inimark-appearance-mode",
      preferredAppTheme: "inimark-preferred-app-theme",
      legacyAppTheme: "inimark-theme",
    },
    syncEvents: {
      appearance: "appearance-state-changed",
      catalog: "theme-catalog-changed",
      themeCss: "theme-css-updated",
    },
    pack: {
      format: "inimark-theme-pack",
      fileExtension: "inimark-theme.json",
      dialogTitle: "Inimark Theme Pack",
    },
    features: { systemAppearance: true },
    screenColorPicker: pickInimarkScreenColor,
    editorProfile: "full",
    defaults: {
      appearanceMode: "system",
      preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
    },
    t: (key, params) => t(key, params),
  });
}
