import { t } from "../i18n/index.ts";

/** Section / token title from i18n (`settings.theme.sections.*` or `settings.theme.token.*`). */
export function themeLabel(key: string, fallback?: string): string {
  const sectionKey = `settings.theme.sections.${key}`;
  const section = t(sectionKey);
  if (section !== sectionKey) return section;
  const tokenKey = `settings.theme.token.${key}`;
  const token = t(tokenKey);
  if (token !== tokenKey) return token;
  return fallback ?? key;
}

/** Longer explanation shown under the token title. */
export function themeTokenDesc(labelKey: string): string {
  const key = `settings.theme.token.${labelKey}Desc`;
  const value = t(key);
  return value === key ? "" : value;
}

export function builtinThemeLabel(id: string): string {
  const key = `settings.theme.builtin.${id}`;
  const value = t(key);
  return value === key ? id : value;
}
