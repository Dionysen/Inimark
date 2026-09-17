import { configureTheme, DEFAULT_APP_THEME_PAIR } from "@dionysen/theme";
import { t } from "../i18n/index.ts";

/** Bind Vellum product keys / i18n into @dionysen/theme before initThemeManager(). */
export function configureVellumTheme(): void {
  configureTheme({
    productId: "vellum",
    storageKeys: {
      appearanceMode: "vellum-appearance-mode",
      preferredAppTheme: "vellum-preferred-app-theme",
      legacyAppTheme: "vellum-theme",
    },
    syncEvents: {
      appearance: "vellum:appearance-state-changed",
      catalog: "vellum:theme-catalog-changed",
      themeCss: "vellum:theme-css-updated",
    },
    pack: {
      format: "inimark-theme-pack",
      fileExtension: "inimark-theme.json",
      dialogTitle: "Theme Pack",
    },
    features: { systemAppearance: true },
    editorProfile: "chrome",
    defaults: {
      appearanceMode: "system",
      preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
    },
    t: (key, params) => t(key, params),
  });
}

/**
 * One-time migration from legacy `vellum-settings.appearance` (light|dark)
 * into ThemeManager storage when no appearance mode key exists yet.
 */
export function migrateLegacyAppearanceFromSettings(): void {
  try {
    if (localStorage.getItem("vellum-appearance-mode")) return;
    const raw = localStorage.getItem("vellum-settings");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { appearance?: string };
    if (parsed.appearance === "light" || parsed.appearance === "dark") {
      localStorage.setItem("vellum-appearance-mode", parsed.appearance);
    }
  } catch {
    /* ignore */
  }
}
