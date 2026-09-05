export type LocaleId = "en" | "zh-CN";

export const LOCALE_STORAGE_KEY = "inimark-locale";
export const LOCALE_CHANGE_EVENT = "inimark:locale-change";

export const SUPPORTED_LOCALES: Array<{ id: LocaleId; labelKey: string }> = [
  { id: "en", labelKey: "settings.language.en" },
  { id: "zh-CN", labelKey: "settings.language.zhCN" },
];

export type Dictionary = { [key: string]: string | Dictionary };

export function detectSystemLocale(): LocaleId {
  try {
    const lang = navigator.language || "";
    if (lang.toLowerCase().startsWith("zh")) return "zh-CN";
  } catch {
    /* ignore */
  }
  return "en";
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

export function lookup(dict: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let cur: string | Dictionary | undefined = dict;
  for (const part of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}
