import {
  createRow,
  createSectionTitle,
  mountSettingsView as mountSettingsShell,
  type SettingSearchItem,
  type SettingSearchMatch,
  type SettingsSectionDef,
  type SettingsViewController,
} from "@dionysen/settings-kit";
import { createSelect, createSlider } from "@dionysen/ui";
import { onLocaleChange, t, type LocaleId } from "../i18n/index.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import { closeWindow } from "@dionysen/shell";
import {
  type AppearanceMode,
  type AppLocale,
  type AppSettings,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  loadSettings,
  patchSettings,
} from "./store.ts";
import {
  formatShortcutDisplay,
  matchShortcut,
} from "../shortcuts/store.ts";
import { isShortcutRecordingActive } from "../shortcuts/guard.ts";

export type { SettingsViewController };

const SECTIONS = ["appearance", "editor", "about"] as const;
type SectionId = (typeof SECTIONS)[number];

function isSectionId(value: string): value is SectionId {
  return (SECTIONS as readonly string[]).includes(value);
}

function searchEntries(): SettingSearchItem[] {
  return [
    {
      id: "appearance-locale",
      section: "appearance",
      getTitle: () => t("settings.appearance.locale"),
      getDescription: () => t("settings.appearance.localeDesc"),
    },
    {
      id: "appearance-theme",
      section: "appearance",
      getTitle: () => t("settings.appearance.theme"),
      getDescription: () => t("settings.appearance.themeDesc"),
    },
    {
      id: "editor-font-size",
      section: "editor",
      getTitle: () => t("settings.editor.fontSize"),
      getDescription: () => t("settings.editor.fontSizeDesc"),
    },
  ];
}

function scoreMatch(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = text.toLowerCase();
  if (hay === q) return 100;
  if (hay.startsWith(q)) return 80;
  if (hay.includes(q)) return 50;
  return 0;
}

function searchSettings(query: string): SettingSearchMatch[] {
  const matches: SettingSearchMatch[] = [];
  for (const item of searchEntries()) {
    const title = item.getTitle?.() ?? "";
    const desc = item.getDescription?.() ?? "";
    const score = Math.max(scoreMatch(query, title), scoreMatch(query, desc));
    if (score > 0) matches.push({ item, score });
  }
  return matches.sort((a, b) => b.score - a.score);
}

function sectionHasMatch(sectionId: string, query: string): boolean {
  if (!query.trim()) return true;
  return searchSettings(query).some((m) => m.item.section === sectionId);
}

function appendHighlightedText(
  parent: HTMLElement,
  text: string,
  query: string,
): void {
  const q = query.trim();
  if (!q) {
    parent.append(document.createTextNode(text));
    return;
  }
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) {
    parent.append(document.createTextNode(text));
    return;
  }
  parent.append(document.createTextNode(text.slice(0, idx)));
  const mark = document.createElement("mark");
  mark.textContent = text.slice(idx, idx + q.length);
  parent.append(mark);
  parent.append(document.createTextNode(text.slice(idx + q.length)));
}

function renderAppearance(
  body: HTMLElement,
  settings: AppSettings,
  onPatch: (partial: Partial<AppSettings>) => void,
): void {
  body.append(createSectionTitle(t("settings.nav.appearance")));

  const locale = createSelect({
    value: settings.locale,
    options: [
      { value: "system", label: "System" },
      { value: "en", label: "English" },
      { value: "zh-CN", label: "简体中文" },
    ],
    onChange: (value) => onPatch({ locale: value as AppLocale }),
  });
  body.append(
    createRow(
      t("settings.appearance.locale"),
      t("settings.appearance.localeDesc"),
      locale.el,
      "appearance-locale",
    ),
  );

  const theme = createSelect({
    value: settings.appearance,
    options: [
      { value: "light", label: t("settings.appearance.themeLight") },
      { value: "dark", label: t("settings.appearance.themeDark") },
    ],
    onChange: (value) => onPatch({ appearance: value as AppearanceMode }),
  });
  body.append(
    createRow(
      t("settings.appearance.theme"),
      t("settings.appearance.themeDesc"),
      theme.el,
      "appearance-theme",
    ),
  );
}

function renderEditor(
  body: HTMLElement,
  settings: AppSettings,
  onPatch: (partial: Partial<AppSettings>) => void,
): void {
  body.append(createSectionTitle(t("settings.nav.editor")));
  const fontSize = createSlider({
    min: FONT_SIZE_MIN,
    max: FONT_SIZE_MAX,
    value: settings.fontSize,
    formatValue: (v) => `${v}px`,
    onChange: (value) => onPatch({ fontSize: value }),
  });
  body.append(
    createRow(
      t("settings.editor.fontSize"),
      t("settings.editor.fontSizeDesc"),
      fontSize.el,
      "editor-font-size",
    ),
  );
}

function renderAbout(body: HTMLElement): void {
  body.append(createSectionTitle(t("settings.about.title")));
  const p = document.createElement("p");
  p.className = "vellum-about-body";
  p.textContent = t("settings.about.body");
  const ver = document.createElement("p");
  ver.className = "vellum-about-version";
  ver.textContent = t("settings.about.version", { version: "0.1.0" });
  body.append(p, ver);
}

export function mountSettingsView(host: HTMLElement): SettingsViewController {
  let settings = loadSettings();

  const sections: SettingsSectionDef[] = SECTIONS.map((id) => ({
    id,
    title: () => t(`settings.nav.${id}`),
    subtitle: () => t(`settings.subtitle.${id}`),
    render(body) {
      body.replaceChildren();
      if (id === "appearance") {
        renderAppearance(body, settings, (partial) => {
          settings = patchSettings(partial);
        });
      } else if (id === "editor") {
        renderEditor(body, settings, (partial) => {
          settings = patchSettings(partial);
        });
      } else {
        renderAbout(body);
      }
    },
    searchEntries: id === "about" ? undefined : () =>
      searchEntries().filter((e) => e.section === id),
  }));

  return mountSettingsShell(host, {
    sections,
    defaultSectionId: "appearance",
    strings: {
      searchPlaceholder: () => t("settings.search"),
      noMatch: () => t("settings.noMatch"),
      focusSearchHint: () => t("settings.focusSearch"),
    },
    mountTitleBar: (titleHost) =>
      mountTitleBar(titleHost, {
        title: t("common.settings"),
        controlMode: "close-only",
        onClose: () => void closeWindow(),
      }),
    search: {
      search: searchSettings,
      sectionHasMatch,
      appendHighlightedText,
    },
    onBeforeRefresh: () => {
      settings = loadSettings();
    },
    onLocaleChange,
    matchShortcut,
    formatShortcutDisplay,
    isShortcutRecordingActive,
    resolveFallbackSection: (requested) =>
      isSectionId(requested) ? requested : "appearance",
    navWidthKey: "vellum-settings-nav-width",
  });
}

export type { LocaleId };
