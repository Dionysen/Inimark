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
import { mountDevDocsPublishPanel } from "./dev-docs-publish-panel.ts";
import { promptConfirm } from "../ui/confirm-dialog.ts";
import { pickWorkspace, removeLibraryAccess } from "../platform/workspace.ts";
import aboutIconUrl from "../../app-icon.png";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  createButton,
  createFontPicker,
  createIconButton,
  createSelect,
  createSlider,
  createToggle,
  createTextField,
  libraryIcon,
  menuIcons,
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
  settingsAiIcon,
  settingsShortcutsIcon,
  settingsThemeIcon,
} from "../ui/widgets/index.ts";
import {
  createRow,
  createSectionTitle,
  mountSettingsView as mountSettingsShell,
  type SettingsSectionDef,
  type SettingsViewController as SettingsShellController,
} from "@dionysen/settings-kit";
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
  type WikiLinkPreviewTrigger,
  type MenuDensity,
  EDITOR_WIDTH_MAX,
  EDITOR_WIDTH_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  CODE_INDENT_SIZE_MAX,
  CODE_INDENT_SIZE_MIN,
  loadSettings,
  menuDensityLabel,
  patchGraphSettings,
  saveSettings,
} from "./store.ts";
import { mountPublishPanel } from "../publish/panel.ts";
import { mountGraphControls } from "./graph-controls.ts";
import { renderAiSettingsPanel } from "./ai-panel.ts";
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
  ai: settingsAiIcon,
  about: settingsAboutIcon,
  dev: settingsDevIcon,
};

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

export function mountSettingsView(
  host: HTMLElement,
  options?: SettingsViewOptions,
): SettingsViewController {
  let settings = loadSettings();
  let onChangeHandler: (settings: AppSettings) => void =
    options?.onChange ?? (() => {});
  let aboutVersion = "…";
  let shell: SettingsShellController;

  function update(partial: Partial<AppSettings>): void {
    settings = { ...settings, ...partial };
    saveSettings(settings);
    onChangeHandler(settings);
    shell.refresh();
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

    const codeIndentSize = createSlider({
      min: CODE_INDENT_SIZE_MIN,
      max: CODE_INDENT_SIZE_MAX,
      step: 1,
      value: settings.codeIndentSize,
      formatValue: (value) => t("settings.editor.codeIndentSizeValue", { n: value }),
      onInput(value) {
        updateLive({ codeIndentSize: value });
      },
      onChange(value) {
        updateLive({ codeIndentSize: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeIndentSize"),
        t("settings.editor.codeIndentSizeDesc"),
        codeIndentSize.el,
        "editor.codeIndentSize",
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

    const firstLineIndentMd = createToggle({
      checked: settings.firstLineIndentMarkdown,
      title: t("settings.editor.firstLineIndentMarkdown"),
      onChange(checked) {
        update({ firstLineIndentMarkdown: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.firstLineIndentMarkdown"),
        t("settings.editor.firstLineIndentMarkdownDesc"),
        firstLineIndentMd.el,
        "editor.firstLineIndentMarkdown",
      ),
    );

    const firstLineIndentTxt = createToggle({
      checked: settings.firstLineIndentPlaintext,
      title: t("settings.editor.firstLineIndentPlaintext"),
      onChange(checked) {
        update({ firstLineIndentPlaintext: checked });
      },
    });
    body.append(
      createRow(
        t("settings.editor.firstLineIndentPlaintext"),
        t("settings.editor.firstLineIndentPlaintextDesc"),
        firstLineIndentTxt.el,
        "editor.firstLineIndentPlaintext",
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

    const wikiPreviewTrigger = createSelect({
      value: settings.wikiLinkPreviewTrigger,
      options: [
        { value: "modifier", label: t("settings.editor.wikiPreviewModifier") },
        { value: "hover", label: t("settings.editor.wikiPreviewHover") },
      ],
      minWidth: 180,
      onChange(value) {
        update({ wikiLinkPreviewTrigger: value as WikiLinkPreviewTrigger });
      },
    });
    body.append(
      createRow(
        t("settings.editor.wikiLinkPreviewTrigger"),
        t("settings.editor.wikiLinkPreviewTriggerDesc"),
        wikiPreviewTrigger.el,
        "editor.wikiLinkPreviewTrigger",
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
        aboutVersion = "1.0.11";
      }
    } catch {
      aboutVersion = "1.0.11";
    }
    // Refresh so the about panel picks up the resolved version string.
    shell.refresh();
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

  function sectionDef(id: SettingsSection, render: SettingsSectionDef["render"]): SettingsSectionDef {
    return {
      id,
      title: () => sectionMeta(id).title,
      subtitle: () => sectionMeta(id).subtitle,
      icon: SECTION_ICONS[id],
      visible: () => (id === "dev" ? isDevSettingsVisible() : true),
      render,
    };
  }

  const sections: SettingsSectionDef[] = [
    sectionDef("editor", (body) => {
      renderEditor(body);
    }),
    sectionDef("appearance", (body) => {
      renderAppearanceChrome(body);
    }),
    sectionDef("theme", (body) => {
      const panelHost = document.createElement("div");
      panelHost.className = "inimark-settings-theme-host";
      body.append(panelHost);
      return renderThemePanel(panelHost, {
        onAppSettingsChange: (partial) => update(partial),
      });
    }),
    sectionDef("shortcuts", (body) => {
      const panelHost = document.createElement("div");
      panelHost.className = "inimark-settings-shortcuts-host";
      body.append(panelHost);
      return renderShortcutsPanel(panelHost);
    }),
    sectionDef("libraries", (body, ctx) => {
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
            showLibraryAddedToast(ctx.mainHost, picked.workspace.rootName);
          }
          ctx.refreshContent();
        })();
      });
      const dropCleanup = mountLibraryDropTarget(addBtn, {
        toastHost: ctx.mainHost,
        onAdded: () => ctx.refreshContent(),
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
                ctx.refreshContent();
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
                  message: t("settings.libraries.removeMessage", {
                    name: current.rootName,
                  }),
                  confirmLabel: t("common.remove"),
                  cancelLabel: t("common.cancel"),
                  danger: true,
                });
                if (!confirmed) return;
                removeLibrary(current.id);
                await removeLibraryAccess(current.id);
                ctx.refreshContent();
              })();
            },
          });
          actions.append(removeBtn);

          item.append(meta, actions);
          list.append(item);
        }
        body.append(list);
      }

      return () => dropCleanup();
    }),
    sectionDef("publish", (body) => {
      const panelHost = document.createElement("div");
      body.append(panelHost);
      const panel = mountPublishPanel(panelHost);
      return () => panel.destroy();
    }),
    sectionDef("image", (body) => {
      renderImage(body);
    }),
    sectionDef("graph", (body) => {
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
      return () => controls.destroy();
    }),
    sectionDef("ai", (body) => {
      const panelHost = document.createElement("div");
      body.append(panelHost);
      return renderAiSettingsPanel(panelHost);
    }),
    sectionDef("about", (body) => {
      renderAbout(body);
    }),
    sectionDef("dev", (body) => {
      const docsPanel = mountDevDocsPublishPanel();
      body.append(docsPanel.el);
      return () => docsPanel.destroy();
    }),
  ];

  shell = mountSettingsShell(host, {
    sections,
    defaultSectionId: "editor",
    strings: {
      searchPlaceholder: () => t("settings.searchPlaceholder"),
      noMatch: () => t("settings.noMatch"),
      focusSearchHint: () => t("settings.focusSearchHint"),
    },
    mountTitleBar: (titleHost) =>
      mountTitleBar(titleHost, {
        title: "",
        controlMode: "close-only",
      }),
    search: {
      search: searchSettings,
      sectionHasMatch: (sectionId, query) =>
        sectionHasSearchMatch(sectionId as SettingsSection, query),
      appendHighlightedText: appendHighlightedSearchText,
      resolveItemTitle: (item: SettingSearchItem) =>
        item.getTitle?.() ?? (item.titleKey ? t(item.titleKey) : ""),
      resolveItemDescription: (item: SettingSearchItem) =>
        item.getDescription?.() ?? (item.descKey ? t(item.descKey) : ""),
    },
    onBeforeRefresh: () => {
      settings = loadSettings();
    },
    resolveFallbackSection: (requestedId) =>
      requestedId === "dev" && !isDevSettingsVisible() ? "about" : "editor",
    onLocaleChange,
    onHighlightSetting(content, settingId) {
      if (settingId === "theme.codeTheme") {
        content
          .querySelector<HTMLButtonElement>('[data-theme-kind-tab="code"]')
          ?.click();
      }
    },
    focusSearchKeys: FOCUS_SEARCH_KEYS,
    matchShortcut,
    formatShortcutDisplay,
    isShortcutRecordingActive,
    navWidthKey: SETTINGS_NAV_WIDTH_KEY,
    navWidthDefault: SETTINGS_NAV_WIDTH_DEFAULT,
    navWidthMin: SETTINGS_NAV_WIDTH_MIN,
    navWidthMax: SETTINGS_NAV_WIDTH_MAX,
  });

  return {
    onChange(handler) {
      onChangeHandler = handler;
    },
    navigateToSection(section) {
      shell.navigateToSection(section);
    },
    refresh() {
      shell.refresh();
    },
    destroy() {
      shell.destroy();
    },
  };
}
