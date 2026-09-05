import { en } from "./locales/en.ts";
import { zhCN } from "./locales/zh-CN.ts";
import {
  detectSystemLocale,
  interpolate,
  lookup,
  LOCALE_CHANGE_EVENT,
  LOCALE_STORAGE_KEY,
  type Dictionary,
  type LocaleId,
} from "./types.ts";

export type { LocaleId, Dictionary };
export {
  detectSystemLocale,
  LOCALE_CHANGE_EVENT,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from "./types.ts";

const CATALOGS: Record<LocaleId, Dictionary> = {
  en,
  "zh-CN": zhCN,
};

let currentLocale: LocaleId = "en";
let initialized = false;

function isLocaleId(value: string | null | undefined): value is LocaleId {
  return value === "en" || value === "zh-CN";
}

function readStoredLocale(): LocaleId | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocaleId(saved)) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredLocale(locale: LocaleId): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

function emitLocaleChange(): void {
  try {
    window.dispatchEvent(
      new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale: currentLocale } }),
    );
  } catch {
    /* ignore */
  }
}

/** Resolve preferred locale: explicit → storage → system → en. */
export function resolveLocale(preferred?: string | null): LocaleId {
  if (isLocaleId(preferred)) return preferred;
  return readStoredLocale() ?? detectSystemLocale();
}

/** Call once per window entry before mounting UI. */
export function initI18n(preferred?: string | null): LocaleId {
  currentLocale = resolveLocale(preferred);
  writeStoredLocale(currentLocale);
  initialized = true;
  return currentLocale;
}

export function getLocale(): LocaleId {
  if (!initialized) currentLocale = resolveLocale();
  return currentLocale;
}

export function setLocale(locale: LocaleId): void {
  if (locale === currentLocale && initialized) {
    writeStoredLocale(locale);
    return;
  }
  currentLocale = locale;
  initialized = true;
  writeStoredLocale(locale);
  emitLocaleChange();
}

/**
 * Translate a dotted key. Falls back to English, then the key itself.
 * Interpolation: `t("a.b", { name: "x" })` replaces `{{name}}`.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const locale = getLocale();
  const primary = lookup(CATALOGS[locale], key);
  const fallback = locale === "en" ? undefined : lookup(CATALOGS.en, key);
  const template = primary ?? fallback ?? key;
  return interpolate(template, params);
}

/** Subscribe to in-window locale changes. Returns unsubscribe. */
export function onLocaleChange(handler: (locale: LocaleId) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ locale: LocaleId }>).detail;
    handler(detail?.locale ?? getLocale());
  };
  window.addEventListener(LOCALE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, listener);
}
