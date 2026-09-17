import {
  interpolate,
  lookup,
  type Dictionary,
} from "./types.ts";

export interface CreateI18nOptions<TLocale extends string> {
  catalogs: Record<TLocale, Dictionary>;
  /** Fallback locale used when a key is missing (typically `"en"`). */
  fallbackLocale: TLocale;
  storageKey: string;
  changeEvent: string;
  isLocaleId: (value: string | null | undefined) => value is TLocale;
  detectSystem: () => TLocale;
  /** Optional side effect after locale applies (e.g. CSS vars). */
  onLocaleApplied?: (locale: TLocale, api: { t: TranslateFn }) => void;
}

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export interface I18nApi<TLocale extends string> {
  initI18n: (preferred?: string | null) => TLocale;
  resolveLocale: (preferred?: string | null) => TLocale;
  getLocale: () => TLocale;
  setLocale: (locale: TLocale) => void;
  t: TranslateFn;
  onLocaleChange: (handler: (locale: TLocale) => void) => () => void;
}

/**
 * Create a per-app i18n singleton. Catalogs and storage keys stay in the app;
 * this package only owns lookup / interpolate / persistence plumbing.
 */
export function createI18n<TLocale extends string>(
  options: CreateI18nOptions<TLocale>,
): I18nApi<TLocale> {
  const {
    catalogs,
    fallbackLocale,
    storageKey,
    changeEvent,
    isLocaleId,
    detectSystem,
    onLocaleApplied,
  } = options;

  let currentLocale: TLocale = fallbackLocale;
  let initialized = false;

  function readStoredLocale(): TLocale | null {
    try {
      const saved = localStorage.getItem(storageKey);
      if (isLocaleId(saved)) return saved;
    } catch {
      /* ignore */
    }
    return null;
  }

  function writeStoredLocale(locale: TLocale): void {
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      /* ignore */
    }
  }

  function emitLocaleChange(): void {
    try {
      window.dispatchEvent(
        new CustomEvent(changeEvent, { detail: { locale: currentLocale } }),
      );
    } catch {
      /* ignore */
    }
  }

  const api: I18nApi<TLocale> = {
    resolveLocale(preferred?: string | null): TLocale {
      if (isLocaleId(preferred)) return preferred;
      return readStoredLocale() ?? detectSystem();
    },

    initI18n(preferred?: string | null): TLocale {
      currentLocale = api.resolveLocale(preferred);
      writeStoredLocale(currentLocale);
      initialized = true;
      onLocaleApplied?.(currentLocale, { t: api.t });
      return currentLocale;
    },

    getLocale(): TLocale {
      if (!initialized) currentLocale = api.resolveLocale();
      return currentLocale;
    },

    setLocale(locale: TLocale): void {
      if (locale === currentLocale && initialized) {
        writeStoredLocale(locale);
        return;
      }
      currentLocale = locale;
      initialized = true;
      writeStoredLocale(locale);
      onLocaleApplied?.(locale, { t: api.t });
      emitLocaleChange();
    },

    t(key: string, params?: Record<string, string | number>): string {
      const locale = api.getLocale();
      const primary = lookup(catalogs[locale], key);
      const fallback =
        locale === fallbackLocale
          ? undefined
          : lookup(catalogs[fallbackLocale], key);
      const template = primary ?? fallback ?? key;
      return interpolate(template, params);
    },

    onLocaleChange(handler: (locale: TLocale) => void): () => void {
      const listener = (event: Event) => {
        const detail = (event as CustomEvent<{ locale: TLocale }>).detail;
        handler(detail?.locale ?? api.getLocale());
      };
      window.addEventListener(changeEvent, listener);
      return () => window.removeEventListener(changeEvent, listener);
    },
  };

  return api;
}
