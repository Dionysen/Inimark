import { configureTheme, DEFAULT_APP_THEME_PAIR } from "@dionysen/theme";
import { t } from "../i18n/index.ts";

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
    editorProfile: "full",
    defaults: {
      appearanceMode: "system",
      preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
    },
    t: (key, params) => t(key, params),
  });
}
