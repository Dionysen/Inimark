import { createJsonSettingsStore } from "@dionysen/settings-kit";
import { setLocale, detectSystemLocale, type LocaleId } from "../i18n/index.ts";

export type AppLocale = LocaleId | "system";

export interface AppSettings {
  locale: AppLocale;
  fontSize: number;
}

export const SETTINGS_STORAGE_KEY = "vellum-settings";
export const SETTINGS_SYNC_EVENT = "vellum:settings-sync";

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 28;
export const FONT_SIZE_DEFAULT = 16;

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "system",
  fontSize: FONT_SIZE_DEFAULT,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(raw: unknown): AppSettings {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const locale =
    src.locale === "en" || src.locale === "zh-CN" || src.locale === "system"
      ? src.locale
      : DEFAULT_SETTINGS.locale;
  const fontSize = clamp(
    typeof src.fontSize === "number" ? src.fontSize : DEFAULT_SETTINGS.fontSize,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
  );
  return { locale, fontSize };
}

const store = createJsonSettingsStore<AppSettings>({
  key: SETTINGS_STORAGE_KEY,
  syncEvent: SETTINGS_SYNC_EVENT,
  defaults: DEFAULT_SETTINGS,
  normalize: normalizeSettings,
});

export const loadSettings = store.load;
export const saveSettings = store.save;
export const parseSettingsSyncPayload = store.parseSyncPayload;
export const isExternalSettingsSync = store.isExternalSync;
export const subscribeSettings = store.subscribe;

/** Apply chrome side effects for the current settings object (locale + font size). */
export function applySettings(settings: AppSettings): void {
  document.documentElement.style.setProperty(
    "--shell-editor-font-size",
    `${settings.fontSize}px`,
  );
  setLocale(settings.locale === "system" ? detectSystemLocale() : settings.locale);
}

export function patchSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...partial };
  const normalized = normalizeSettings(next);
  saveSettings(normalized);
  applySettings(normalized);
  return normalized;
}
