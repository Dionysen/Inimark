export type Dictionary = { [key: string]: string | Dictionary };

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

/** Detect zh vs en from navigator.language. */
export function detectSystemLocale<TLocale extends string>(
  resolve: (lang: string) => TLocale,
  fallback: TLocale,
): TLocale {
  try {
    const lang = navigator.language || "";
    return resolve(lang);
  } catch {
    return fallback;
  }
}
