import {
  appendEditorTypographyControls,
  createRow,
  createSectionTitle,
  mountSettingsView as mountSettingsShell,
  type EditorTypographyControls,
  type SettingSearchItem,
  type SettingSearchMatch,
  type SettingsSectionDef,
  type SettingsViewController,
} from "@dionysen/settings-kit";
import { createSelect } from "@dionysen/ui";
import { closeWindow, listSystemFonts } from "@dionysen/shell";
import { renderChromeThemePanel } from "@dionysen/theme";
import { renderAccountSection } from "../git-sync/account-settings.ts";
import { onLocaleChange, t, type LocaleId } from "../i18n/index.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  type AppLocale,
  type AppSettings,
  EDITOR_WIDTH_CEILING_KEY,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  loadSettings,
  patchSettings,
  readEditorWidthCeiling,
} from "./store.ts";
import {
  formatShortcutDisplay,
  matchShortcut,
} from "../shortcuts/store.ts";
import { isShortcutRecordingActive } from "../shortcuts/guard.ts";

export type { SettingsViewController };

/** Settings nav: 通用 / 云同步 / 编辑器 / 主题 / 关于 */
const SECTIONS = ["general", "sync", "editor", "theme", "about"] as const;
type SectionId = (typeof SECTIONS)[number];

function isSectionId(value: string): value is SectionId {
  return (SECTIONS as readonly string[]).includes(value);
}

function searchEntries(): SettingSearchItem[] {
  return [
    {
      id: "general-locale",
      section: "general",
      getTitle: () => t("settings.general.locale"),
      getDescription: () => t("settings.general.localeDesc"),
    },
    {
      id: "sync-login",
      section: "sync",
      getTitle: () => t("settings.account.loginTitle"),
      getDescription: () => t("settings.account.loginHint"),
    },
    {
      id: "sync-now",
      section: "sync",
      getTitle: () => t("settings.account.syncNow"),
      getDescription: () => t("settings.account.syncHint"),
    },
    {
      id: "sync-restore",
      section: "sync",
      getTitle: () => t("settings.account.restoreBackup"),
      getDescription: () => t("settings.account.restoreTitle"),
    },
    {
      id: "appearance-theme",
      section: "theme",
      getTitle: () => t("settings.theme.appearanceMode"),
      getDescription: () => t("settings.theme.appearanceModeDesc"),
    },
    {
      id: "editor.editorFont",
      section: "editor",
      getTitle: () => t("settings.editor.editorFont"),
      getDescription: () => t("settings.editor.editorFontDesc"),
    },
    {
      id: "editor.fontSize",
      section: "editor",
      getTitle: () => t("settings.editor.fontSize"),
      getDescription: () => t("settings.editor.fontSizeDesc"),
    },
    {
      id: "editor.lineHeight",
      section: "editor",
      getTitle: () => t("settings.editor.lineHeight"),
      getDescription: () => t("settings.editor.lineHeightDesc"),
    },
    {
      id: "editor.paragraphSpacing",
      section: "editor",
      getTitle: () => t("settings.editor.paragraphSpacing"),
      getDescription: () => t("settings.editor.paragraphSpacingDesc"),
    },
    {
      id: "editor.editorWidth",
      section: "editor",
      getTitle: () => t("settings.editor.editorWidth"),
      getDescription: () => t("settings.editor.editorWidthDesc"),
    },
    {
      id: "editor.firstLineIndent",
      section: "editor",
      getTitle: () => t("settings.editor.firstLineIndent"),
      getDescription: () => t("settings.editor.firstLineIndentDesc"),
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

function renderGeneral(
  body: HTMLElement,
  settings: AppSettings,
  onPatch: (partial: Partial<AppSettings>) => void,
): void {
  body.append(createSectionTitle(t("settings.nav.general")));

  const locale = createSelect({
    value: settings.locale,
    options: [
      { value: "system", label: t("settings.general.localeSystem") },
      { value: "en", label: "English" },
      { value: "zh-CN", label: "简体中文" },
    ],
    onChange: (value) => onPatch({ locale: value as AppLocale }),
  });
  body.append(
    createRow(
      t("settings.general.locale"),
      t("settings.general.localeDesc"),
      locale.el,
      "general-locale",
    ),
  );
}

function renderTheme(body: HTMLElement): () => void {
  const themeHost = document.createElement("div");
  themeHost.className = "inimark-settings-theme-host vellum-theme-panel-host";
  themeHost.dataset.settingId = "appearance-theme";
  body.append(themeHost);
  return renderChromeThemePanel(themeHost);
}

function renderEditor(
  body: HTMLElement,
  settings: AppSettings,
  onPatch: (partial: Partial<AppSettings>) => void,
): EditorTypographyControls {
  body.append(createSectionTitle(t("settings.nav.editor")));

  return appendEditorTypographyControls({
    body,
    settings,
    editorWidthMax: readEditorWidthCeiling(),
    listSystemFonts,
    fontSizeMin: FONT_SIZE_MIN,
    fontSizeMax: FONT_SIZE_MAX,
    labels: {
      editorFont: t("settings.editor.editorFont"),
      editorFontDesc: t("settings.editor.editorFontDesc"),
      fontSize: t("settings.editor.fontSize"),
      fontSizeDesc: t("settings.editor.fontSizeDesc"),
      lineHeight: t("settings.editor.lineHeight"),
      lineHeightDesc: t("settings.editor.lineHeightDesc"),
      paragraphSpacing: t("settings.editor.paragraphSpacing"),
      paragraphSpacingDesc: t("settings.editor.paragraphSpacingDesc"),
      editorWidth: t("settings.editor.editorWidth"),
      editorWidthDesc: t("settings.editor.editorWidthDesc"),
      firstLineIndent: t("settings.editor.firstLineIndent"),
      firstLineIndentDesc: t("settings.editor.firstLineIndentDesc"),
      firstLineIndentValue: (n) =>
        t("settings.editor.firstLineIndentValue", { n }),
    },
    onPatch,
  });
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
  let teardownSync: (() => void) | null = null;
  let teardownTheme: (() => void) | null = null;
  let editorControls: EditorTypographyControls | null = null;

  const onCeilingStorage = (event: StorageEvent): void => {
    if (event.key !== EDITOR_WIDTH_CEILING_KEY || !event.newValue) return;
    const max = Number(event.newValue);
    if (Number.isFinite(max)) editorControls?.setEditorWidthMax(max);
  };
  window.addEventListener("storage", onCeilingStorage);

  const sections: SettingsSectionDef[] = SECTIONS.map((id) => ({
    id,
    title: () => t(`settings.nav.${id}`),
    subtitle: () => t(`settings.subtitle.${id}`),
    render(body) {
      body.replaceChildren();
      teardownSync?.();
      teardownSync = null;
      teardownTheme?.();
      teardownTheme = null;
      editorControls?.destroy();
      editorControls = null;
      if (id === "general") {
        renderGeneral(body, settings, (partial) => {
          settings = patchSettings(partial);
        });
      } else if (id === "sync") {
        teardownSync = renderAccountSection(body);
      } else if (id === "editor") {
        editorControls = renderEditor(body, settings, (partial) => {
          settings = patchSettings(partial);
        });
      } else if (id === "theme") {
        teardownTheme = renderTheme(body);
      } else {
        renderAbout(body);
      }
    },
    searchEntries: id === "about" ? undefined : () =>
      searchEntries().filter((e) => e.section === id),
  }));

  const controller = mountSettingsShell(host, {
    sections,
    defaultSectionId: "general",
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
    resolveFallbackSection: (requested) => {
      // Legacy deep-links from older builds
      if (requested === "account") return "sync";
      if (requested === "appearance") return "theme";
      return isSectionId(requested) ? requested : "general";
    },
    navWidthKey: "vellum-settings-nav-width",
  });

  const originalDestroy = controller.destroy.bind(controller);
  controller.destroy = () => {
    window.removeEventListener("storage", onCeilingStorage);
    teardownSync?.();
    teardownSync = null;
    teardownTheme?.();
    teardownTheme = null;
    editorControls?.destroy();
    editorControls = null;
    originalDestroy();
  };
  return controller;
}

export type { LocaleId };
