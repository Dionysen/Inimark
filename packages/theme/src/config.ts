import type { AppearanceMode, ThemePair } from "./appearance.ts";

export type ThemeEditorProfile = "chrome" | "full";

export interface ThemeProductConfig {
  productId: string;
  storageKeys: {
    appearanceMode: string;
    preferredAppTheme: string;
    legacyAppTheme?: string;
  };
  syncEvents: {
    appearance: string;
    catalog: string;
    themeCss: string;
  };
  pack: {
    format: string;
    fileExtension: string;
    dialogTitle: string;
  };
  features: {
    systemAppearance: boolean;
  };
  /** Editor schema profile: chrome = chrome+body+scrollbar; full = all sections. */
  editorProfile: ThemeEditorProfile;
  defaults: {
    appearanceMode: AppearanceMode;
    preferredAppTheme: ThemePair;
  };
  /** i18n lookup; keys match Inimark `settings.theme.*` / `settings.appearance.*`. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

let config: ThemeProductConfig | null = null;

/** Configure product-specific storage, events, and i18n before initThemeManager(). */
export function configureTheme(next: ThemeProductConfig): void {
  config = next;
}

export function getThemeConfig(): ThemeProductConfig {
  if (!config) {
    throw new Error("configureTheme() must be called before using @dionysen/theme");
  }
  return config;
}

export function tryGetThemeConfig(): ThemeProductConfig | null {
  return config;
}

/** Translate via product config; falls back to the key when unconfigured (tests). */
export function themeT(key: string, params?: Record<string, string | number>): string {
  if (!config) return key;
  return config.t(key, params);
}
