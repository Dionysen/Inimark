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
import { createSelect, createToggle, createButton } from "@dionysen/ui";
import { closeWindow, isTauri, listSystemFonts } from "@dionysen/shell";
import { renderChromeThemePanel } from "@dionysen/theme";
import { renderAccountSection } from "../git-sync/account-settings.ts";
import { onLocaleChange, t, type LocaleId } from "../i18n/index.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  emailIcon,
  githubIcon,
  issuesIcon,
  settingsAboutIcon,
  settingsEditorIcon,
  settingsGeneralIcon,
  settingsShortcutsIcon,
  settingsSyncIcon,
  settingsThemeIcon,
} from "../ui/product-icons.ts";
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
import {
  renderShortcutsPanel,
  shortcutSearchEntries,
} from "./shortcuts-panel.ts";
import { mountAboutUpdateControl } from "./about-update-control.ts";
import aboutIconUrl from "../../app-icon.svg";

export type { SettingsViewController };

/** Settings nav: 通用 / 云同步 / 编辑器 / 快捷键 / 主题 / 关于 */
const SECTIONS = ["general", "sync", "editor", "shortcuts", "theme", "about"] as const;
type SectionId = (typeof SECTIONS)[number];

const SECTION_ICONS: Record<SectionId, () => string> = {
  general: settingsGeneralIcon,
  sync: settingsSyncIcon,
  editor: settingsEditorIcon,
  shortcuts: settingsShortcutsIcon,
  theme: settingsThemeIcon,
  about: settingsAboutIcon,
};
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
    ...shortcutSearchEntries().map((entry) => ({
      ...entry,
      section: "shortcuts",
    })),
    {
      id: "about.version",
      section: "about",
      getTitle: () => t("settings.about.versionInfo"),
    },
    {
      id: "about.useSystemProxy",
      section: "about",
      getTitle: () => t("settings.about.useSystemProxy"),
      getDescription: () => t("settings.about.useSystemProxyDesc"),
    },
    {
      id: "about.updates",
      section: "about",
      getTitle: () => t("settings.about.softwareUpdate"),
      getDescription: () => t("settings.about.checkUpdates"),
    },
    {
      id: "about.license",
      section: "about",
      getTitle: () => t("settings.about.openSourceLicense"),
      getDescription: () => t("settings.about.licenseName"),
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

const ABOUT_REPO_URL = "https://github.com/Dionysen/Inimark";
const ABOUT_ISSUES_URL = `${ABOUT_REPO_URL}/issues`;
const ABOUT_LICENSE_URL = "https://opensource.org/licenses/MIT";
const ABOUT_EMAIL = "solongnight@outlook.com";
const ABOUT_VERSION_FALLBACK = "0.1.1";

function openExternalUrl(url: string): void {
  void (async () => {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("gs_open_url", { url });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  })();
}

function renderAbout(
  body: HTMLElement,
  settings: AppSettings,
  update: (partial: Partial<AppSettings>) => void,
): void {
  const about = document.createElement("div");
  about.className = "inimark-about";

  const hero = document.createElement("div");
  hero.className = "inimark-about-hero";

  const icon = document.createElement("img");
  icon.className = "inimark-about-icon";
  icon.src = aboutIconUrl;
  icon.alt = "Vellum";
  icon.width = 88;
  icon.height = 88;
  icon.draggable = false;

  const name = document.createElement("h2");
  name.className = "inimark-about-name";
  name.textContent = "Vellum";

  const desc = document.createElement("p");
  desc.className = "inimark-about-desc";
  desc.textContent = t("settings.about.desc");

  hero.append(icon, name, desc);

  const versionValue = document.createElement("div");
  versionValue.className = "inimark-about-value";
  versionValue.textContent = ABOUT_VERSION_FALLBACK;
  void (async () => {
    if (!isTauri()) return;
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      const version = await getVersion();
      if (version && versionValue.isConnected) versionValue.textContent = version;
    } catch {
      /* keep the packaged fallback */
    }
  })();

  const proxyToggle = createToggle({
    checked: settings.useSystemProxyForUpdates,
    title: t("settings.about.useSystemProxy"),
    onChange(checked) {
      update({ useSystemProxyForUpdates: checked });
    },
  });

  const licenseLink = document.createElement("a");
  licenseLink.className = "inimark-about-link";
  licenseLink.href = ABOUT_LICENSE_URL;
  licenseLink.textContent = t("settings.about.licenseName");
  licenseLink.addEventListener("click", (event) => {
    event.preventDefault();
    openExternalUrl(ABOUT_LICENSE_URL);
  });

  const list = document.createElement("div");
  list.className = "inimark-about-list";
  list.append(
    createRow(t("settings.about.versionInfo"), "", versionValue, "about.version"),
    createRow(
      t("settings.about.useSystemProxy"),
      t("settings.about.useSystemProxyDesc"),
      proxyToggle.el,
      "about.useSystemProxy",
    ),
    createRow(
      t("settings.about.softwareUpdate"),
      "",
      mountAboutUpdateControl().el,
      "about.updates",
    ),
    createRow(
      t("settings.about.openSourceLicense"),
      "",
      licenseLink,
      "about.license",
    ),
  );

  const links = document.createElement("div");
  links.className = "inimark-about-links";
  const github = createButton({
    label: t("settings.about.github"),
    icon: githubIcon(),
    variant: "default",
    onClick: () => {
      openExternalUrl(ABOUT_REPO_URL);
    },
  });
  const issues = createButton({
    label: t("settings.about.issues"),
    icon: issuesIcon(),
    variant: "default",
    onClick: () => {
      openExternalUrl(ABOUT_ISSUES_URL);
    },
  });
  const email = createButton({
    label: t("settings.about.email"),
    icon: emailIcon(),
    variant: "default",
    onClick: () => {
      openExternalUrl(`mailto:${ABOUT_EMAIL}`);
    },
  });
  links.append(github, issues, email);

  about.append(hero, list, links);
  body.append(about);
}

export function mountSettingsView(host: HTMLElement): SettingsViewController {
  let settings = loadSettings();
  let teardownSync: (() => void) | null = null;
  let teardownTheme: (() => void) | null = null;
  let teardownShortcuts: (() => void) | null = null;
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
    icon: SECTION_ICONS[id],
    render(body) {
      body.replaceChildren();
      teardownSync?.();
      teardownSync = null;
      teardownTheme?.();
      teardownTheme = null;
      teardownShortcuts?.();
      teardownShortcuts = null;
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
      } else if (id === "shortcuts") {
        teardownShortcuts = renderShortcutsPanel(body);
      } else if (id === "theme") {
        teardownTheme = renderTheme(body);
      } else {
        renderAbout(body, settings, (partial) => {
          settings = patchSettings(partial);
        });
      }
    },
    searchEntries: () => searchEntries().filter((e) => e.section === id),
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
        title: "",
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
    teardownShortcuts?.();
    teardownShortcuts = null;
    editorControls?.destroy();
    editorControls = null;
    originalDestroy();
  };
  return controller;
}

export type { LocaleId };
