import { themeT } from "./config.ts";

/** Section / token title from i18n (`settings.theme.sections.*` or `settings.theme.token.*`). */
export function themeLabel(key: string, fallback?: string): string {
  const sectionKey = `settings.theme.sections.${key}`;
  const section = themeT(sectionKey);
  if (section !== sectionKey) return section;
  const tokenKey = `settings.theme.token.${key}`;
  const token = themeT(tokenKey);
  if (token !== tokenKey) return token;
  return fallback ?? key;
}

/** Longer explanation shown under the token title. */
export function themeTokenDesc(labelKey: string): string {
  const key = `settings.theme.token.${labelKey}Desc`;
  const value = themeT(key);
  return value === key ? "" : value;
}

export function builtinThemeLabel(id: string): string {
  const key = `settings.theme.builtin.${id}`;
  const value = themeT(key);
  return value === key ? id : value;
}
