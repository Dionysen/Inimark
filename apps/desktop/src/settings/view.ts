import { onLocaleChange, t } from "../i18n/index.ts";
import { showLibraryAddedToast } from "../libraries/added-toast.ts";
import { mountLibraryDropTarget } from "../libraries/drop-target.ts";
import { promptRenameLibrary } from "../libraries/rename-dialog.ts";
import {
  getLibraryById,
  listLibraries,
  removeLibrary,
  renameLibrary,
} from "../libraries/store.ts";
import { isTauri } from "../platform/env.ts";
import { openExternalUrl } from "../platform/open-url.ts";
import { mountAboutUpdateControl } from "./about-update-control.ts";
import { mountDevUpdatePanel } from "./dev-update-panel.ts";
import { mountDevDocsPublishPanel } from "./dev-docs-publish-panel.ts";
import { promptConfirm } from "../ui/confirm-dialog.ts";
import { pickWorkspace, removeLibraryAccess } from "../platform/workspace.ts";
import aboutIconUrl from "../../app-icon.png";
import {
  attachColumnResize,
  loadPersistedWidth,
  persistWidth,
} from "../ui/column-resize.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  createButton,
  createFontPicker,
  createIconButton,
  createNavItem,
  createNavList,
  createSearchField,
  createSelect,
  createSlider,
  createToggle,
  createTextField,
  libraryIcon,
  menuIcons,
  setNavItemLabel,
  settingsAboutIcon,
  settingsDevIcon,
  githubIcon,
  issuesIcon,
  emailIcon,
  settingsAppearanceIcon,
  settingsEditorIcon,
  settingsImageIcon,
  settingsPublishIcon,
  settingsGraphIcon,
  settingsShortcutsIcon,
  settingsThemeIcon,
} from "../ui/widgets/index.ts";
import {
  type AppLocale,
  type AppSettings,
  type AutoSaveDelayUnit,
  type FontPresetId,
  autoSaveDelayToParts,
  formatAutoSaveDelayValue,
  parseAutoSaveDelayInput,
  type ImageFilenameFormat,
  type ImageStorageMode,
  type LinkUpdateMode,
  type MenuDensity,
  EDITOR_WIDTH_MAX,
  EDITOR_WIDTH_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  loadSettings,
  menuDensityLabel,
  patchGraphSettings,
  saveSettings,
} from "./store.ts";
import { mountPublishPanel } from "../publish/panel.ts";
import { mountGraphControls } from "./graph-controls.ts";
import { renderShortcutsPanel } from "./shortcuts-panel.ts";
import { renderThemePanel } from "./theme-panel.ts";
import { createSidebarTabsControl } from "./sidebar-tabs-control.ts";
import {
  normalizeSidebarTabLayout,
} from "../sidebar/tab-layout.ts";
import {
  type SettingsSection,
  type SettingSearchItem,
  appendHighlightedSearchText,
  isDevSettingsVisible,
  searchSettings,
  sectionHasSearchMatch,
} from "./search-index.ts";
import { isShortcutRecordingActive } from "../shortcuts/guard.ts";
import { formatShortcutDisplay, matchShortcut } from "../shortcuts/store.ts";

const FOCUS_SEARCH_KEYS = ["Ctrl", "F"];

export interface SettingsViewController {
  onChange(handler: (settings: AppSettings) => void): void;
  navigateToSection(section: SettingsSection): void;
  refresh(): void;
  destroy(): void;
}

export interface SettingsViewOptions {
  onChange?: (settings: AppSettings) => void;
}

const SECTION_ICONS: Record<SettingsSection, () => string> = {
  editor: settingsEditorIcon,
  appearance: settingsAppearanceIcon,
  theme: settingsThemeIcon,
  shortcuts: settingsShortcutsIcon,
  libraries: libraryIcon,
  publish: settingsPublishIcon,
  image: settingsImageIcon,
  graph: settingsGraphIcon,
  about: settingsAboutIcon,
  dev: settingsDevIcon,
};

const BASE_SECTION_IDS: SettingsSection[] = [
  "editor",
  "appearance",
  "theme",
  "shortcuts",
  "libraries",
  "publish",
  "image",
  "graph",
  "about",
];

function visibleSectionIds(showDev: boolean): SettingsSection[] {
  if (import.meta.env.DEV && showDev) return [...BASE_SECTION_IDS, "dev"];
  return BASE_SECTION_IDS;
}

function sectionMeta(id: SettingsSection): {
  title: string;
  subtitle: string;
} {
  return {
    title: t(`settings.nav.${id}`),
    subtitle: t(`settings.subtitle.${id}`),
  };
}

const SETTINGS_NAV_WIDTH_KEY = "inimark-settings-nav-width";
const SETTINGS_NAV_WIDTH_DEFAULT = 220;
const SETTINGS_NAV_WIDTH_MIN = 160;
const SETTINGS_NAV_WIDTH_MAX = 420;

const ABOUT_REPO_URL = "https://github.com/Dionysen/Inimark";
const ABOUT_ISSUES_URL = `${ABOUT_REPO_URL}/issues`;
const ABOUT_EMAIL = "solongnight@outlook.com";
const ABOUT_LICENSE_URL = "https://opensource.org/licenses/MIT";

const EDITOR_FONT_PRESETS: FontPresetId[] = ["serif", "rounded", "mono"];
const CODE_FONT_PRESETS: FontPresetId[] = ["code", "mono"];
const UI_FONT_PRESETS: FontPresetId[] = ["rounded", "serif"];

function createSectionTitle(title: string): HTMLElement {
  const el = document.createElement("h3");
  el.className = "inimark-settings-section-title";
  el.textContent = title;
  return el;
}

function createRow(
  title: string,
  description: string,
  control: HTMLElement,
  settingId?: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "inimark-settings-row";
  if (settingId) row.dataset.settingId = settingId;
  const meta = document.createElement("div");
  meta.className = "inimark-settings-row-meta";
  const h = document.createElement("div");
  h.className = "inimark-settings-row-title";
  h.textContent = title;
  meta.append(h);
  if (description) {
    const p = document.createElement("p");
    p.className = "inimark-settings-row-desc";
    p.textContent = description;
    meta.append(p);
  }
  const ctrl = document.createElement("div");
  ctrl.className = "inimark-settings-row-control";
  ctrl.append(control);
  row.append(meta, ctrl);
  return row;
}

export function mountSettingsView(
  host: HTMLElement,
  options?: SettingsViewOptions,
): SettingsViewController {
  let settings = loadSettings();
  let activeSection: SettingsSection = "editor";
  let searchQuery = "";
  let pendingHighlightId: string | null = null;
  let onChangeHandler: (settings: AppSettings) => void =
    options?.onChange ?? (() => {});
  let navWidth = loadPersistedWidth(
    SETTINGS_NAV_WIDTH_KEY,
    SETTINGS_NAV_WIDTH_DEFAULT,
    SETTINGS_NAV_WIDTH_MIN,
    SETTINGS_NAV_WIDTH_MAX,
  );
  let aboutVersion = "…";

  host.className = "inimark-settings-shell";
  host.replaceChildren();

  const layout = document.createElement("div");
  layout.className = "inimark-settings-layout";

  const nav = document.createElement("nav");
  nav.className = "inimark-settings-nav";

  const navTopbar = document.createElement("div");
  navTopbar.className = "inimark-settings-nav-topbar";
  navTopbar.setAttribute("data-tauri-drag-region", "");

  const navBody = document.createElement("div");
  navBody.className = "inimark-settings-nav-body inimark-scrollbar";

  const search = createSearchField({
    placeholder: t("settings.searchPlaceholder"),
    onInput(value) {
      searchQuery = value;
      renderNav();
      renderContent();
    },
  });

  search.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = searchSettings(searchQuery)[0];
    if (!first) return;
    event.preventDefault();
    navigateToSetting(first.item);
  });

  const navList = createNavList();

  const navButtons = new Map<SettingsSection, HTMLButtonElement>();

  function rebuildNavButtons(): void {
    navButtons.clear();
    navList.replaceChildren();
    for (const id of visibleSectionIds(settings.showDevSection)) {
      const btn = createNavItem({
        id,
        label: sectionMeta(id).title,
        icon: SECTION_ICONS[id](),
        onClick() {
          activeSection = id;
          renderNav();
          renderContent();
        },
      });
      navButtons.set(id, btn);
      navList.append(btn);
    }
  }

  rebuildNavButtons();

  navBody.append(search.el, navList);

  const navFooter = document.createElement("div");
  navFooter.className = "inimark-settings-nav-footer";

  const searchHint = document.createElement("p");
  searchHint.className = "inimark-settings-nav-hint";

  const searchHintKbd = document.createElement("kbd");
  const searchHintLabel = document.createElement("span");
  searchHintLabel.className = "inimark-settings-nav-hint-label";

  function renderSearchHint(): void {
    searchHintKbd.textContent = formatShortcutDisplay(FOCUS_SEARCH_KEYS).replace(
      /\+/g,
      "-",
    );
    searchHintLabel.textContent = t("settings.focusSearchHint");
  }

  renderSearchHint();
  searchHint.append(searchHintKbd, searchHintLabel);
  navFooter.append(searchHint);
  nav.append(navTopbar, navBody, navFooter);

  function onFocusSearchKeyDown(event: KeyboardEvent): void {
    if (!matchShortcut(event, FOCUS_SEARCH_KEYS)) return;
    if (isShortcutRecordingActive()) return;
    event.preventDefault();
    event.stopPropagation();
    search.focus();
    search.input.select();
  }

  window.addEventListener("keydown", onFocusSearchKeyDown, true);

  const mainWrap = document.createElement("div");
  mainWrap.className = "inimark-settings-main-wrap";

  const mainTopbar = document.createElement("header");
  const titlebar = mountTitleBar(mainTopbar, {
    title: "",
    controlMode: "close-only",
  });

  const main = document.createElement("div");
  main.className = "inimark-settings-main inimark-scrollbar";

  const content = document.createElement("div");
  content.className = "inimark-settings-content";

  main.append(content);
  mainWrap.append(mainTopbar, main);
  layout.append(nav, mainWrap);
  host.append(layout);

  function applyNavWidth(): void {
    layout.style.setProperty("--inimark-settings-nav-width", `${navWidth}px`);
  }

  applyNavWidth();

  const resize = attachColumnResize(nav, {
    side: "left",
    minWidth: SETTINGS_NAV_WIDTH_MIN,
    maxWidth: SETTINGS_NAV_WIDTH_MAX,
    getWidth: () => navWidth,
    onWidthChange(width) {
      navWidth = width;
      applyNavWidth();
      persistWidth(SETTINGS_NAV_WIDTH_KEY, width);
    },
  });

  function renderNav(): void {
    let visible = 0;
    for (const [id, btn] of navButtons) {
      const match = sectionHasSearchMatch(id, searchQuery);
      btn.hidden = !match;
      btn.classList.toggle(
        "is-active",
        searchQuery.trim().length === 0 && id === activeSection,
      );
      setNavItemLabel(btn, sectionMeta(id).title);
      if (match) visible += 1;
    }
    const querying = searchQuery.trim().length > 0;
    navList.hidden = querying && visible === 0;
  }

  function settingLabel(item: SettingSearchItem): string {
    return item.getTitle?.() ?? (item.titleKey ? t(item.titleKey) : "");
  }

  function settingDescription(item: SettingSearchItem): string {
    return item.getDescription?.() ?? (item.descKey ? t(item.descKey) : "");
  }

  function highlightSettingRow(id: string): void {
    requestAnimationFrame(() => {
      if (id === "theme.codeTheme") {
        content.querySelector<HTMLButtonElement>('[data-theme-kind-tab="code"]')?.click();
      }

      let row = content.querySelector<HTMLElement>(`[data-setting-id="${id}"]`);
      if (!row && id === "theme.codeTheme") {
        row = content.querySelector<HTMLElement>(".theme-kind-tabs");
      }
      if (!row) return;

      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.add("is-search-highlight");
      window.setTimeout(() => row.classList.remove("is-search-highlight"), 2200);
    });
  }

  function navigateToSection(section: SettingsSection): void {
    searchQuery = "";
    search.setValue("");
    activeSection = section === "dev" && !isDevSettingsVisible() ? "about" : section;
    pendingHighlightId = null;
    renderNav();
    renderContent();
  }

  function navigateToSetting(item: SettingSearchItem): void {
    searchQuery = "";
    search.setValue("");
    activeSection =
      item.section === "dev" && !isDevSettingsVisible() ? "about" : item.section;
    pendingHighlightId = item.id;
    renderNav();
    renderContent();
  }

  function renderSearchResults(body: HTMLElement): void {
    const matches = searchSettings(searchQuery);
    const results = document.createElement("div");
    results.className = "inimark-settings-search-results";

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-settings-search-empty";
      empty.textContent = t("settings.noMatch");
      results.append(empty);
      body.append(results);
      return;
    }

    for (const { item } of matches) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-settings-search-result";

      const title = document.createElement("div");
      title.className = "inimark-settings-search-result-title";
      appendHighlightedSearchText(title, settingLabel(item), searchQuery);

      const desc = document.createElement("div");
      desc.className = "inimark-settings-search-result-desc";
      const description = settingDescription(item);
      if (description) {
        appendHighlightedSearchText(desc, description, searchQuery);
      }

      const section = document.createElement("div");
      section.className = "inimark-settings-search-result-section";
      appendHighlightedSearchText(section, sectionMeta(item.section).title, searchQuery);

      btn.append(title);
      if (description) btn.append(desc);
      btn.append(section);
      btn.addEventListener("click", () => navigateToSetting(item));
      results.append(btn);
    }

    body.append(results);
  }

  function update(partial: Partial<AppSettings>): void {
    const prevShowDev = settings.showDevSection;
    settings = { ...settings, ...partial };
    saveSettings(settings);
    onChangeHandler(settings);
    if (partial.showDevSection === false && activeSection === "dev") {
      activeSection = "about";
    }
    if (
      partial.showDevSection !== undefined &&
      partial.showDevSection !== prevShowDev
    ) {
      rebuildNavButtons();
    }
    renderNav();
    renderContent();
  }

  /** Persist + apply without remounting controls (needed for live slider drag). */
  function updateLive(partial: Partial<AppSettings>): void {
    settings = { ...settings, ...partial };
    saveSettings(settings);
    onChangeHandler(settings);
  }

  function patchFormat(partial: Partial<AppSettings["markdownFormat"]>): void {
    update({
      markdownFormat: { ...settings.markdownFormat, ...partial },
    });
  }

  function patchImage(partial: Partial<AppSettings["image"]>): void {
    update({
      image: { ...settings.image, ...partial },
    });
  }

  let shortcutsCleanup: (() => void) | null = null;
  let themeCleanup: (() => void) | null = null;
  let graphControlsCleanup: (() => void) | null = null;
  let publishCleanup: (() => void) | null = null;
  let devUpdateCleanup: (() => void) | null = null;
  let devDocsCleanup: (() => void) | null = null;
  let libraryDropCleanup: (() => void) | null = null;

  function renderEditor(body: HTMLElement): void {
    body.append(createSectionTitle(t("settings.group.typography")));

    const editorFont = createFontPicker({
      mode: "editor",
      value: settings.editorFont,
      presets: EDITOR_FONT_PRESETS,
      minWidth: 180,
      onChange(value) {
        update({ editorFont: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.editorFont"),
        t("settings.editor.editorFontDesc"),
        editorFont.el,
        "editor.editorFont",
      ),
    );

    const codeFont = createFontPicker({
      mode: "code",
      value: settings.codeFont,
      presets: CODE_FONT_PRESETS,
      minWidth: 180,
      onChange(value) {
        update({ codeFont: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeFont"),
        t("settings.editor.codeFontDesc"),
        codeFont.el,
        "editor.codeFont",
      ),
    );

    const fontSize = createSlider({
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      value: settings.fontSize,
      formatValue: (value) => `${value}px`,
      onInput(value) {
        updateLive({ fontSize: value });
      },
      onChange(value) {
        updateLive({ fontSize: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.fontSize"),
        t("settings.editor.fontSizeDesc"),
        fontSize.el,
        "editor.fontSize",
      ),
    );

    const codeFontSize = createSlider({
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      value: settings.codeFontSize,
      formatValue: (value) => `${value}px`,
      onInput(value) {
        updateLive({ codeFontSize: value });
      },
      onChange(value) {
        updateLive({ codeFontSize: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeFontSize"),
        t("settings.editor.codeFontSizeDesc"),
        codeFontSize.el,
        "editor.codeFontSize",
      ),
    );

    const lineHeight = createSlider({
      min: 12,
      max: 28,
      step: 1,
      value: Math.round(settings.lineHeight * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onInput(value) {
        updateLive({ lineHeight: value / 10 });
      },
      onChange(value) {
        updateLive({ lineHeight: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.lineHeight"),
        t("settings.editor.lineHeightDesc"),
        lineHeight.el,
        "editor.lineHeight",
      ),
    );

    const paragraphSpacing = createSlider({
      min: 0,
      max: 20,
      step: 1,
      value: Math.round(settings.paragraphSpacing * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onInput(value) {
        updateLive({ paragraphSpacing: value / 10 });
      },
      onChange(value) {
        updateLive({ paragraphSpacing: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.paragraphSpacing"),
        t("settings.editor.paragraphSpacingDesc"),
        paragraphSpacing.el,
        "editor.paragraphSpacing",
      ),
    );

    const codeLineHeight = createSlider({
      min: 11,
      max: 24,
      step: 1,
      value: Math.round(settings.codeLineHeight * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onInput(value) {
        updateLive({ codeLineHeight: value / 10 });
      },
      onChange(value) {
        updateLive({ codeLineHeight: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeLineHeight"),
        t("settings.editor.codeLineHeightDesc"),
        codeLineHeight.el,
        "editor.codeLineHeight",
      ),
    );

    const editorWidth = createSlider({
      min: EDITOR_WIDTH_MIN,
      max: EDITOR_WIDTH_MAX,
      step: 1,
      value: settings.editorWidth,
      formatValue: (value) => `${value}px`,
      onInput(value) {
        updateLive({ editorWidth: value });
      },
      onChange(value) {
        updateLive({ editorWidth: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.editorWidth"),
        t("settings.editor.editorWidthDesc"),
        editorWidth.el,
        "editor.editorWidth",
      ),
    );

    body.append(createSectionTitle(t("settings.group.experience")));

    const typewriter = createToggle({
      checked: settings.typewriterMode,
      title: t("settings.editor.typewriter"),
      onChange(checked) {
        update({ typewriterMode: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.typewriter"),
        t("settings.editor.typewriterDesc"),
        typewriter.el,
        "editor.typewriter",
      ),
    );

    const focusMode = createToggle({
      checked: settings.focusMode,
      title: t("settings.editor.focus"),
      onChange(checked) {
        update({ focusMode: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.focus"),
        t("settings.editor.focusDesc"),
        focusMode.el,
        "editor.focus",
      ),
    );

    const autoHideStatusbar = createToggle({
      checked: settings.autoHideStatusbar,
      title: t("settings.editor.autoHideStatusbar"),
      onChange(checked) {
        update({ autoHideStatusbar: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.autoHideStatusbar"),
        t("settings.editor.autoHideStatusbarDesc"),
        autoHideStatusbar.el,
        "editor.autoHideStatusbar",
      ),
    );

    const autoHideTitlebar = createToggle({
      checked: settings.autoHideTitlebar,
      title: t("settings.editor.autoHideTitlebar"),
      onChange(checked) {
        update({ autoHideTitlebar: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.autoHideTitlebar"),
        t("settings.editor.autoHideTitlebarDesc"),
        autoHideTitlebar.el,
        "editor.autoHideTitlebar",
      ),
    );

    body.append(createSectionTitle(t("settings.group.save")));

    const autoSave = createToggle({
      checked: settings.autoSave,
      title: t("settings.editor.autoSave"),
      onChange(checked) {
        update({ autoSave: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.autoSave"),
        t("settings.editor.autoSaveDesc"),
        autoSave.el,
        "editor.autoSave",
      ),
    );

    const delayParts = autoSaveDelayToParts(settings.autoSaveDelayMs);
    let delayUnit = delayParts.unit;

    const delayInput = document.createElement("input");
    delayInput.type = "number";
    delayInput.className = "inimark-field__input";
    delayInput.min = "0.1";
    delayInput.step = "any";
    delayInput.inputMode = "decimal";
    delayInput.value = formatAutoSaveDelayValue(delayParts.value);
    delayInput.disabled = !settings.autoSave;
    delayInput.setAttribute("aria-label", t("settings.editor.autoSaveDelay"));

    function commitAutoSaveDelay(rawValue = delayInput.value): void {
      const ms = parseAutoSaveDelayInput(rawValue, delayUnit);
      if (ms == null) {
        const parts = autoSaveDelayToParts(settings.autoSaveDelayMs);
        delayInput.value = formatAutoSaveDelayValue(parts.value);
        return;
      }
      if (ms !== settings.autoSaveDelayMs) {
        update({ autoSaveDelayMs: ms });
      }
    }

    delayInput.addEventListener("change", () => commitAutoSaveDelay());
    delayInput.addEventListener("blur", () => commitAutoSaveDelay());

    const delayUnitSelect = createSelect({
      value: delayParts.unit,
      disabled: !settings.autoSave,
      matchTriggerWidth: true,
      options: [
        { value: "s", label: t("settings.editor.autoSaveDelayUnitSeconds") },
        { value: "min", label: t("settings.editor.autoSaveDelayUnitMinutes") },
        { value: "h", label: t("settings.editor.autoSaveDelayUnitHours") },
      ],
      onChange(value) {
        delayUnit = value as AutoSaveDelayUnit;
        commitAutoSaveDelay();
      },
    });

    const delayGroup = document.createElement("div");
    delayGroup.className =
      "inimark-settings-inline-controls inimark-settings-auto-save-delay";
    const delayField = document.createElement("label");
    delayField.className = "inimark-control inimark-field";
    delayField.append(delayInput);
    delayGroup.append(delayField, delayUnitSelect.el);
    body.append(
      createRow(
        t("settings.editor.autoSaveDelay"),
        t("settings.editor.autoSaveDelayDesc"),
        delayGroup,
        "editor.autoSaveDelay",
      ),
    );

    const linkUpdate = createSelect({
      value: settings.linkUpdateOnMove,
      options: [
        { value: "ask", label: t("settings.editor.linkUpdateAsk") },
        { value: "always", label: t("settings.editor.linkUpdateAlways") },
        { value: "never", label: t("settings.editor.linkUpdateNever") },
      ],
      minWidth: 180,
      onChange(value) {
        update({ linkUpdateOnMove: value as LinkUpdateMode });
      },
    });
    body.append(
      createRow(
        t("settings.editor.linkUpdateOnMove"),
        t("settings.editor.linkUpdateOnMoveDesc"),
        linkUpdate.el,
        "editor.linkUpdateOnMove",
      ),
    );

    const formatOnSave = createToggle({
      checked: settings.markdownFormat.formatOnSave,
      title: t("settings.editor.formatOnSave"),
      onChange(checked) {
        patchFormat({ formatOnSave: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.formatOnSave"),
        t("settings.editor.formatOnSaveDesc"),
        formatOnSave.el,
        "editor.formatOnSave",
      ),
    );

    body.append(createSectionTitle(t("settings.group.markdownFormat")));

    const cjk = createToggle({
      checked: settings.markdownFormat.cjkSpacing,
      onChange(checked) {
        patchFormat({ cjkSpacing: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.cjkSpacing"),
        t("settings.editor.cjkSpacingDesc"),
        cjk.el,
        "editor.cjkSpacing",
      ),
    );

    const trim = createToggle({
      checked: settings.markdownFormat.trimTrailingWhitespace,
      onChange(checked) {
        patchFormat({ trimTrailingWhitespace: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.trimTrailing"),
        t("settings.editor.trimTrailingDesc"),
        trim.el,
        "editor.trimTrailing",
      ),
    );

    const newline = createToggle({
      checked: settings.markdownFormat.ensureFinalNewline,
      onChange(checked) {
        patchFormat({ ensureFinalNewline: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.finalNewline"),
        t("settings.editor.finalNewlineDesc"),
        newline.el,
        "editor.finalNewline",
      ),
    );

    const blanks = createToggle({
      checked: settings.markdownFormat.normalizeBlankLines,
      onChange(checked) {
        patchFormat({ normalizeBlankLines: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.collapseBlank"),
        t("settings.editor.collapseBlankDesc"),
        blanks.el,
        "editor.collapseBlank",
      ),
    );
  }

  function renderAppearanceChrome(body: HTMLElement): void {
    body.append(createSectionTitle(t("settings.group.interface")));

    const localeSelect = createSelect({
      value: settings.locale,
      options: [
        { value: "system", label: t("settings.language.system") },
        { value: "en", label: t("settings.language.en") },
        { value: "zh-CN", label: t("settings.language.zhCN") },
      ],
      minWidth: 150,
      onChange(value) {
        update({ locale: value as AppLocale });
      },
    });
    body.append(
      createRow(
        t("settings.language.title"),
        t("settings.language.desc"),
        localeSelect.el,
        "appearance.locale",
      ),
    );

    const uiFont = createFontPicker({
      mode: "ui",
      value: settings.uiFont,
      presets: UI_FONT_PRESETS,
      minWidth: 180,
      onChange(value) {
        update({ uiFont: value });
      },
    });
    body.append(
      createRow(
        t("settings.appearance.uiFont"),
        t("settings.appearance.uiFontDesc"),
        uiFont.el,
        "appearance.uiFont",
      ),
    );

    const density = createSelect({
      value: settings.menuDensity,
      options: (["compact", "normal", "comfortable"] as MenuDensity[]).map((value) => ({
        value,
        label: menuDensityLabel(value),
      })),
      minWidth: 150,
      onChange(value) {
        update({ menuDensity: value as MenuDensity });
      },
    });
    body.append(
      createRow(
        t("settings.appearance.menuDensity"),
        t("settings.appearance.menuDensityDesc"),
        density.el,
        "appearance.menuDensity",
      ),
    );

    const autoHide = createToggle({
      checked: settings.autoHideLibraryBar,
      onChange(checked) {
        update({ autoHideLibraryBar: checked });
      },
    });
    body.append(
      createRow(
        t("settings.appearance.autoHideLibraryBar"),
        t("settings.appearance.autoHideLibraryBarDesc"),
        autoHide.el,
        "appearance.autoHideLibraryBar",
      ),
    );

    const fileTreeIcons = createToggle({
      checked: settings.showFileTreeIcons,
      onChange(checked) {
        update({ showFileTreeIcons: checked });
      },
    });
    body.append(
      createRow(
        t("settings.appearance.showFileTreeIcons"),
        t("settings.appearance.showFileTreeIconsDesc"),
        fileTreeIcons.el,
        "appearance.showFileTreeIcons",
      ),
    );

    const tabLayout = normalizeSidebarTabLayout(
      settings.leftSidebarTabs,
      settings.rightSidebarTabs,
    );
    const tabsControl = createSidebarTabsControl({
      layout: tabLayout,
      onChange(layout) {
        update({
          leftSidebarTabs: layout.left,
          rightSidebarTabs: layout.right,
        });
      },
    });
    tabsControl.el.dataset.settingId = "appearance.sidebarTabs";
    body.append(tabsControl.el);
  }

  function renderImage(body: HTMLElement): void {
    const mode = createSelect({
      value: settings.image.storageMode,
      options: [
        { value: "library-assets", label: t("settings.image.libraryAssets") },
        { value: "fixed-directory", label: t("settings.image.fixedDirectory") },
      ],
      minWidth: 180,
      onChange(value) {
        patchImage({ storageMode: value as ImageStorageMode });
      },
    });
    body.append(
      createRow(
        t("settings.image.storageMode"),
        t("settings.image.storageModeDesc"),
        mode.el,
        "image.storageMode",
      ),
    );

    const filename = createSelect({
      value: settings.image.filenameFormat,
      options: [
        { value: "original", label: t("settings.image.original") },
        { value: "timestamp", label: t("settings.image.timestamp") },
        { value: "both", label: t("settings.image.both") },
      ],
      minWidth: 180,
      onChange(value) {
        patchImage({ filenameFormat: value as ImageFilenameFormat });
      },
    });
    body.append(
      createRow(
        t("settings.image.filenameFormat"),
        t("settings.image.filenameFormatDesc"),
        filename.el,
        "image.filenameFormat",
      ),
    );

    if (settings.image.storageMode === "library-assets") {
      const autoCreate = createToggle({
        checked: settings.image.autoCreateAssetsDir,
        onChange(checked) {
          patchImage({ autoCreateAssetsDir: checked });
        },
      });
      body.append(
        createRow(
          t("settings.image.autoCreate"),
          t("settings.image.autoCreateDesc"),
          autoCreate.el,
          "image.autoCreate",
        ),
      );
    }

    if (settings.image.storageMode === "fixed-directory") {
      const pathField = createTextField({
        value: settings.image.fixedDirectoryPath,
        placeholder: t("settings.image.noFolder"),
      });
      pathField.input.readOnly = true;

      const pickBtn = createButton({
        label: t("common.choose"),
        onClick: () => {
          void (async () => {
            if (!isTauri()) return;
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({ directory: true, multiple: false });
            if (typeof selected === "string" && selected) {
              patchImage({ fixedDirectoryPath: selected });
            }
          })();
        },
      });

      const group = document.createElement("div");
      group.className = "inimark-settings-inline-controls";
      group.append(pathField.el, pickBtn);
      body.append(
        createRow(
          t("settings.image.storagePath"),
          t("settings.image.storagePathDesc"),
          group,
          "image.storagePath",
        ),
      );
    }
  }

  async function ensureAboutVersion(): Promise<void> {
    if (aboutVersion !== "…") return;
    try {
      if (isTauri()) {
        const { getVersion } = await import("@tauri-apps/api/app");
        aboutVersion = await getVersion();
      } else {
        aboutVersion = "1.0.3";
      }
    } catch {
      aboutVersion = "1.0.3";
    }
    if (activeSection === "about") renderContent();
  }

  function renderAbout(body: HTMLElement): void {
    void ensureAboutVersion();
    const about = document.createElement("div");
    about.className = "inimark-about";

    const hero = document.createElement("div");
    hero.className = "inimark-about-hero";

    const icon = document.createElement("img");
    icon.className = "inimark-about-icon";
    icon.src = aboutIconUrl;
    icon.alt = "Inimark";
    icon.width = 88;
    icon.height = 88;
    icon.draggable = false;

    const name = document.createElement("h2");
    name.className = "inimark-about-name";
    name.textContent = "Inimark";

    const desc = document.createElement("p");
    desc.className = "inimark-about-desc";
    desc.textContent = t("settings.about.desc");

    hero.append(icon, name, desc);

    const versionValue = document.createElement("div");
    versionValue.className = "inimark-about-value";
    versionValue.textContent = aboutVersion;

    const updateControl = mountAboutUpdateControl();

    const proxyToggle = createToggle({
      checked: settings.useSystemProxyForUpdates,
      title: t("settings.about.useSystemProxy"),
      onChange(checked) {
        update({ useSystemProxyForUpdates: checked });
      },
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
      createRow(t("settings.about.softwareUpdate"), "", updateControl.el, "about.updates"),
    );

    if (import.meta.env.DEV) {
      const showDevToggle = createToggle({
        checked: settings.showDevSection,
        title: t("settings.about.showDevSection"),
        onChange(checked) {
          update({ showDevSection: checked });
        },
      });
      list.append(
        createRow(
          t("settings.about.showDevSection"),
          t("settings.about.showDevSectionDesc"),
          showDevToggle.el,
          "about.showDev",
        ),
      );
    }

    const licenseLink = document.createElement("a");
    licenseLink.className = "inimark-about-link";
    licenseLink.href = ABOUT_LICENSE_URL;
    licenseLink.target = "_blank";
    licenseLink.rel = "noopener noreferrer";
    licenseLink.textContent = t("settings.about.licenseName");
    licenseLink.addEventListener("click", (event) => {
      event.preventDefault();
      openExternalUrl(ABOUT_LICENSE_URL);
    });

    list.append(
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

  function renderContent(): void {
    shortcutsCleanup?.();
    shortcutsCleanup = null;
    themeCleanup?.();
    themeCleanup = null;
    graphControlsCleanup?.();
    graphControlsCleanup = null;
    publishCleanup?.();
    publishCleanup = null;
    devUpdateCleanup?.();
    devUpdateCleanup = null;
    devDocsCleanup?.();
    devDocsCleanup = null;
    libraryDropCleanup?.();
    libraryDropCleanup = null;
    content.replaceChildren();

    const body = document.createElement("div");
    body.className = "inimark-settings-body";

    if (searchQuery.trim().length > 0) {
      renderSearchResults(body);
      content.append(body);
      return;
    }

    if (activeSection === "editor") {
      renderEditor(body);
    }

    if (activeSection === "appearance") {
      renderAppearanceChrome(body);
    }

    if (activeSection === "theme") {
      const panelHost = document.createElement("div");
      panelHost.className = "inimark-settings-theme-host";
      body.append(panelHost);
      themeCleanup = renderThemePanel(panelHost, {
        onAppSettingsChange: (partial) => update(partial),
      });
    }

    if (activeSection === "shortcuts") {
      const panelHost = document.createElement("div");
      panelHost.className = "inimark-settings-shortcuts-host";
      body.append(panelHost);
      shortcutsCleanup = renderShortcutsPanel(panelHost);
    }

    if (activeSection === "libraries") {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "inimark-control inimark-settings-library-add";
      addBtn.dataset.settingId = "libraries.add";
      const addLabel = document.createElement("span");
      addLabel.className = "inimark-settings-library-add-label";
      addLabel.innerHTML = `${libraryIcon()}<span>${t("settings.libraries.add")}</span>`;
      addBtn.append(addLabel);
      addBtn.addEventListener("click", () => {
        void (async () => {
          const picked = await pickWorkspace();
          if (picked.status !== "picked") return;
          if (picked.libraryCreated) {
            showLibraryAddedToast(mainWrap, picked.workspace.rootName);
          }
          renderContent();
        })();
      });
      libraryDropCleanup = mountLibraryDropTarget(addBtn, {
        toastHost: mainWrap,
        onAdded: () => renderContent(),
      });
      body.append(addBtn);

      const libraries = listLibraries();
      if (libraries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "inimark-settings-libraries-empty";
        empty.textContent = t("settings.libraries.empty");
        body.append(empty);
      } else {
        const list = document.createElement("div");
        list.className = "inimark-settings-libraries-list";
        for (const library of libraries) {
          const item = document.createElement("div");
          item.className = "inimark-settings-library-item";

          const meta = document.createElement("div");
          meta.className = "inimark-settings-library-meta";
          const nameRow = document.createElement("div");
          nameRow.className = "inimark-settings-library-name-row";
          const nameEl = document.createElement("div");
          nameEl.className = "inimark-settings-library-name";
          nameEl.textContent = library.rootName;
          nameRow.append(nameEl);
          const path = document.createElement("div");
          path.className = "inimark-settings-library-path";
          path.textContent = library.rootPath;
          path.title = library.rootPath;
          meta.append(nameRow, path);

          const actions = document.createElement("div");
          actions.className = "inimark-settings-library-actions";
          const renameBtn = createIconButton({
            label: t("settings.libraries.rename"),
            title: t("settings.libraries.rename"),
            html: menuIcons.rename,
            onClick: () => {
              void (async () => {
                const current = getLibraryById(library.id);
                if (!current) return;
                const nextName = await promptRenameLibrary(current.rootName);
                if (!nextName || nextName === current.rootName) return;
                renameLibrary(current.id, nextName);
                renderContent();
              })();
            },
          });
          renameBtn.classList.add("inimark-settings-library-rename-btn");
          actions.append(renameBtn);

          const removeBtn = createButton({
            label: t("common.remove"),
            variant: "ghost",
            onClick: () => {
              void (async () => {
                const current = getLibraryById(library.id);
                if (!current) return;
                const confirmed = await promptConfirm({
                  title: t("settings.libraries.removeTitle"),
                  message: t("settings.libraries.removeMessage", { name: current.rootName }),
                  confirmLabel: t("common.remove"),
                  cancelLabel: t("common.cancel"),
                  danger: true,
                });
                if (!confirmed) return;
                removeLibrary(current.id);
                await removeLibraryAccess(current.id);
                renderContent();
              })();
            },
          });
          actions.append(removeBtn);

          item.append(meta, actions);
          list.append(item);
        }
        body.append(list);
      }
    }

    if (activeSection === "image") {
      renderImage(body);
    }

    if (activeSection === "publish") {
      const panelHost = document.createElement("div");
      body.append(panelHost);
      const panel = mountPublishPanel(panelHost);
      publishCleanup = () => panel.destroy();
    }

    if (activeSection === "graph") {
      const controls = mountGraphControls({
        settings: settings.graph,
        onChange(partial) {
          const graph = patchGraphSettings(partial);
          settings = { ...settings, graph };
          onChangeHandler(settings);
          controls.refresh(graph);
        },
      });
      body.append(controls.el);
      graphControlsCleanup = () => controls.destroy();
    }

    if (activeSection === "about") {
      renderAbout(body);
    }

    if (activeSection === "dev" && isDevSettingsVisible()) {
      const docsPanel = mountDevDocsPublishPanel();
      body.append(docsPanel.el);
      devDocsCleanup = () => docsPanel.destroy();

      const panel = mountDevUpdatePanel();
      body.append(panel.el);
      devUpdateCleanup = () => panel.destroy();
    }

    content.append(body);

    if (pendingHighlightId) {
      const id = pendingHighlightId;
      pendingHighlightId = null;
      highlightSettingRow(id);
    }
  }

  renderNav();
  renderContent();

  const unsubscribeLocale = onLocaleChange(() => {
    search.input.placeholder = t("settings.searchPlaceholder");
    search.input.setAttribute("aria-label", t("settings.searchPlaceholder"));
    renderSearchHint();
    renderNav();
    renderContent();
  });

  return {
    onChange(handler) {
      onChangeHandler = handler;
    },
    navigateToSection,
    refresh() {
      const prevShowDev = settings.showDevSection;
      settings = loadSettings();
      if (activeSection === "dev" && !isDevSettingsVisible()) {
        activeSection = "about";
      }
      if (settings.showDevSection !== prevShowDev) {
        rebuildNavButtons();
      }
      search.input.placeholder = t("settings.searchPlaceholder");
      search.input.setAttribute("aria-label", t("settings.searchPlaceholder"));
      renderNav();
      renderContent();
    },
    destroy() {
      window.removeEventListener("keydown", onFocusSearchKeyDown, true);
      unsubscribeLocale();
      resize.destroy();
      titlebar.destroy();
      search.destroy();
      shortcutsCleanup?.();
      themeCleanup?.();
      graphControlsCleanup?.();
      publishCleanup?.();
      devUpdateCleanup?.();
      devDocsCleanup?.();
      libraryDropCleanup?.();
      host.replaceChildren();
      host.className = "";
    },
  };
}
