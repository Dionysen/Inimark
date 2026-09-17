import { createI18n, detectSystemLocale, type Dictionary } from "@dionysen/i18n";
import { en } from "./locales/en.ts";
import { zhCN } from "./locales/zh-CN.ts";
import {
  LOCALE_CHANGE_EVENT,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type LocaleId,
} from "./types.ts";

export type { LocaleId, Dictionary };
export {
  LOCALE_CHANGE_EVENT,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from "./types.ts";

function isLocaleId(value: string | null | undefined): value is LocaleId {
  return value === "en" || value === "zh-CN";
}

function detectInimarkSystemLocale(): LocaleId {
  return detectSystemLocale((lang) => {
    if (lang.toLowerCase().startsWith("zh")) return "zh-CN" as const;
    return "en" as const;
  }, "en");
}

const i18n = createI18n<LocaleId>({
  catalogs: {
    en,
    "zh-CN": zhCN,
  },
  fallbackLocale: "en",
  storageKey: LOCALE_STORAGE_KEY,
  changeEvent: LOCALE_CHANGE_EVENT,
  isLocaleId,
  detectSystem: detectInimarkSystemLocale,
  onLocaleApplied: (_locale, { t }) => {
    const label = t("editor.moreBreakLabel");
    document.documentElement.style.setProperty("--more-break-label", `"${label}"`);
  },
});

export const initI18n = i18n.initI18n;
export const resolveLocale = i18n.resolveLocale;
export const getLocale = i18n.getLocale;
export const setLocale = i18n.setLocale;
export const t = i18n.t;
export const onLocaleChange = i18n.onLocaleChange;

export { detectInimarkSystemLocale as detectSystemLocale };
