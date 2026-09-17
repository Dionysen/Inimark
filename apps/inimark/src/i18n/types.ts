export type LocaleId = "en" | "zh-CN";

export type { Dictionary } from "@dionysen/i18n";

export const LOCALE_STORAGE_KEY = "inimark-locale";
export const LOCALE_CHANGE_EVENT = "inimark:locale-change";

export const SUPPORTED_LOCALES: Array<{ id: LocaleId; labelKey: string }> = [
  { id: "en", labelKey: "settings.language.en" },
  { id: "zh-CN", labelKey: "settings.language.zhCN" },
];
