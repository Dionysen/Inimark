import { onLocaleChange, t } from "../i18n/index.ts";
import {
  listLibraries,
  removeLibrary,
  upsertLibrary,
} from "../libraries/store.ts";
import { isTauri } from "../platform/env.ts";
import { pickWorkspace, removeLibraryAccess } from "../platform/workspace.ts";
import {
  attachColumnResize,
  loadPersistedWidth,
  persistWidth,
} from "../ui/column-resize.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  createButton,
  createFontPicker,
  createNavItem,
  createNavList,
  createSearchField,
  createSelect,
  createSlider,
  createToggle,
  createTextField,
} from "../ui/widgets/index.ts";
import {
  type AppLocale,
  type AppSettings,
  type EditorWidth,
  type FontPresetId,
  type ImageFilenameFormat,
  type ImageStorageMode,
  type MenuDensity,
  editorWidthLabel,
  loadSettings,
  menuDensityLabel,
  saveSettings,
} from "./store.ts";
import { renderShortcutsPanel } from "./shortcuts-panel.ts";
import { renderThemePanel } from "./theme-panel.ts";

export interface SettingsViewController {
  onChange(handler: (settings: AppSettings) => void): void;
  refresh(): void;
  destroy(): void;
}

export interface SettingsViewOptions {
  onChange?: (settings: AppSettings) => void;
}

type SettingsSection =
  | "editor"
  | "appearance"
  | "theme"
  | "shortcuts"
  | "libraries"
  | "image"
  | "about";

const SECTION_SEARCH_TERMS: Record<SettingsSection, string[]> = {
  editor: [
    "font",
    "size",
    "width",
    "layout",
    "typography",
    "autosave",
    "format",
    "typewriter",
    "line height",
  ],
  appearance: [
    "density",
    "ui font",
    "library bar",
    "interface",
    "chrome",
    "menu",
    "language",
    "locale",
  ],
  theme: ["theme", "color", "dark", "light", "style", "syntax", "highlight"],
  shortcuts: ["keyboard", "hotkey", "keymap", "binding"],
  libraries: ["folder", "vault", "workspace", "files"],
  image: ["image", "assets", "paste", "filename", "upload"],
  about: ["version", "license", "info", "github", "update", "upgrade"],
};

function sectionMeta(id: SettingsSection): {
  title: string;
  subtitle: string;
  searchTerms: string[];
} {
  return {
    title: t(`settings.nav.${id}`),
    subtitle: t(`settings.subtitle.${id}`),
    searchTerms: SECTION_SEARCH_TERMS[id],
  };
}

const SETTINGS_NAV_WIDTH_KEY = "inimark-settings-nav-width";
const SETTINGS_NAV_WIDTH_DEFAULT = 220;
const SETTINGS_NAV_WIDTH_MIN = 160;
const SETTINGS_NAV_WIDTH_MAX = 420;

const EDITOR_FONT_PRESETS: FontPresetId[] = ["serif", "rounded", "mono"];
const CODE_FONT_PRESETS: FontPresetId[] = ["code", "mono"];
const UI_FONT_PRESETS: FontPresetId[] = ["rounded", "serif"];

function sectionMatches(id: SettingsSection, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const meta = sectionMeta(id);
  if (meta.title.toLowerCase().includes(q)) return true;
  if (meta.subtitle.toLowerCase().includes(q)) return true;
  return meta.searchTerms.some((term) => term.includes(q) || q.includes(term));
}

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
): HTMLElement {
  const row = document.createElement("div");
  row.className = "inimark-settings-row";
  const meta = document.createElement("div");
  meta.className = "inimark-settings-row-meta";
  const h = document.createElement("div");
  h.className = "inimark-settings-row-title";
  h.textContent = title;
  const p = document.createElement("p");
  p.className = "inimark-settings-row-desc";
  p.textContent = description;
  meta.append(h, p);
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
  navBody.className = "inimark-settings-nav-body";

  const search = createSearchField({
    placeholder: t("settings.searchPlaceholder"),
    onInput(value) {
      searchQuery = value;
      renderNav();
    },
  });

  const navList = createNavList();

  const navEmpty = document.createElement("div");
  navEmpty.className = "inimark-settings-nav-empty";
  navEmpty.hidden = true;
  const navEmptyLabel = document.createElement("span");
  navEmptyLabel.textContent = t("settings.noMatch");
  navEmpty.append(navEmptyLabel);

  const sectionIds: SettingsSection[] = [
    "editor",
    "appearance",
    "theme",
    "shortcuts",
    "libraries",
    "image",
    "about",
  ];

  const navButtons = new Map<SettingsSection, HTMLButtonElement>();

  for (const id of sectionIds) {
    const btn = createNavItem({
      id,
      label: sectionMeta(id).title,
      onClick() {
        activeSection = id;
        renderNav();
        renderContent();
      },
    });
    navButtons.set(id, btn);
    navList.append(btn);
  }

  navBody.append(search.el, navList, navEmpty);
  nav.append(navTopbar, navBody);

  const mainWrap = document.createElement("div");
  mainWrap.className = "inimark-settings-main-wrap";

  const mainTopbar = document.createElement("header");
  const titlebar = mountTitleBar(mainTopbar, {
    title: "",
    controlMode: "close-only",
  });

  const main = document.createElement("div");
  main.className = "inimark-settings-main";

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
      const match = sectionMatches(id, searchQuery);
      btn.hidden = !match;
      btn.classList.toggle("is-active", id === activeSection);
      btn.textContent = sectionMeta(id).title;
      if (match) visible += 1;
    }
    const querying = searchQuery.trim().length > 0;
    navList.hidden = querying && visible === 0;
    navEmpty.hidden = !(querying && visible === 0);
    navEmptyLabel.textContent = t("settings.noMatch");
  }

  function update(partial: Partial<AppSettings>): void {
    settings = { ...settings, ...partial };
    saveSettings(settings);
    onChangeHandler(settings);
    renderContent();
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

  function renderEditor(body: HTMLElement): void {
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
      ),
    );

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
      ),
    );

    const fontSize = createSlider({
      min: 10,
      max: 24,
      step: 1,
      value: settings.fontSize,
      formatValue: (value) => `${value}px`,
      onChange(value) {
        update({ fontSize: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.fontSize"),
        t("settings.editor.fontSizeDesc"),
        fontSize.el,
      ),
    );

    const codeFontSize = createSlider({
      min: 10,
      max: 24,
      step: 1,
      value: settings.codeFontSize,
      formatValue: (value) => `${value}px`,
      onChange(value) {
        update({ codeFontSize: value });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeFontSize"),
        t("settings.editor.codeFontSizeDesc"),
        codeFontSize.el,
      ),
    );

    const lineHeight = createSlider({
      min: 12,
      max: 28,
      step: 1,
      value: Math.round(settings.lineHeight * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onChange(value) {
        update({ lineHeight: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.lineHeight"),
        t("settings.editor.lineHeightDesc"),
        lineHeight.el,
      ),
    );

    const paragraphSpacing = createSlider({
      min: 0,
      max: 20,
      step: 1,
      value: Math.round(settings.paragraphSpacing * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onChange(value) {
        update({ paragraphSpacing: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.paragraphSpacing"),
        t("settings.editor.paragraphSpacingDesc"),
        paragraphSpacing.el,
      ),
    );

    const codeLineHeight = createSlider({
      min: 11,
      max: 24,
      step: 1,
      value: Math.round(settings.codeLineHeight * 10),
      formatValue: (value) => (value / 10).toFixed(1),
      onChange(value) {
        update({ codeLineHeight: value / 10 });
      },
    });
    body.append(
      createRow(
        t("settings.editor.codeLineHeight"),
        t("settings.editor.codeLineHeightDesc"),
        codeLineHeight.el,
      ),
    );

    const widthSelect = createSelect({
      value: settings.editorWidth,
      options: (["narrow", "medium", "wide", "full"] as EditorWidth[]).map((option) => ({
        value: option,
        label: editorWidthLabel(option),
      })),
      minWidth: 150,
      onChange(value) {
        update({ editorWidth: value as EditorWidth });
      },
    });
    body.append(
      createRow(
        t("settings.editor.editorWidth"),
        t("settings.editor.editorWidthDesc"),
        widthSelect.el,
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
      ),
    );
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
        aboutVersion = "0.1.5";
      }
    } catch {
      aboutVersion = "0.1.5";
    }
    if (activeSection === "about") renderContent();
  }

  function renderAbout(body: HTMLElement): void {
    void ensureAboutVersion();
    const about = document.createElement("div");
    about.className = "inimark-about";

    const name = document.createElement("p");
    name.className = "inimark-about-name";
    name.textContent = "Inimark";

    const version = document.createElement("p");
    version.className = "inimark-about-version";
    version.textContent = t("settings.about.version", { version: aboutVersion });

    const desc = document.createElement("p");
    desc.className = "inimark-about-desc";
    desc.textContent = t("settings.about.desc");

    const license = document.createElement("p");
    license.className = "inimark-about-license";
    license.textContent = t("settings.about.license");

    const updateRow = document.createElement("div");
    updateRow.className = "inimark-about-update";

    const updateStatus = document.createElement("p");
    updateStatus.className = "inimark-about-update-status";
    updateStatus.textContent = "";

    const updateActions = document.createElement("div");
    updateActions.className = "inimark-about-links";

    let checking = false;
    let installing = false;
    let pendingVersion: string | null = null;

    const setStatus = (text: string) => {
      updateStatus.textContent = text;
    };

    const checkBtn = createButton({
      label: t("settings.about.checkUpdates"),
      variant: "ghost",
      onClick: () => {
        void (async () => {
          if (!isTauri() || checking || installing) return;
          checking = true;
          pendingVersion = null;
          setStatus(t("settings.about.checking"));
          checkBtn.disabled = true;
          installBtn.hidden = true;
          try {
            const { checkForUpdate } = await import("../updater.ts");
            const info = await checkForUpdate();
            if (!info) {
              setStatus(t("settings.about.upToDate"));
            } else {
              pendingVersion = info.version;
              setStatus(t("settings.about.available", { version: info.version }));
              installBtn.hidden = false;
              installBtn.textContent = t("settings.about.available", {
                version: info.version,
              });
            }
          } catch {
            setStatus(t("settings.about.failed"));
          } finally {
            checking = false;
            checkBtn.disabled = false;
          }
        })();
      },
    });

    const installBtn = createButton({
      label: t("settings.about.checkUpdates"),
      variant: "primary",
      onClick: () => {
        void (async () => {
          if (!isTauri() || installing || !pendingVersion) return;
          installing = true;
          checkBtn.disabled = true;
          installBtn.disabled = true;
          setStatus(t("settings.about.downloading"));
          try {
            const {
              downloadAndInstall,
              formatProgressPercent,
              relaunchApp,
            } = await import("../updater.ts");
            await downloadAndInstall((downloaded, contentLength) => {
              const pct = formatProgressPercent(downloaded, contentLength);
              setStatus(
                pct
                  ? `${t("settings.about.downloading")} ${pct}`
                  : t("settings.about.downloading"),
              );
            });
            setStatus(t("settings.about.installed"));
            await relaunchApp();
          } catch {
            setStatus(t("settings.about.failed"));
            installing = false;
            checkBtn.disabled = false;
            installBtn.disabled = false;
          }
        })();
      },
    });
    installBtn.hidden = true;

    if (!isTauri()) {
      setStatus(t("settings.about.desktopOnly"));
      checkBtn.disabled = true;
    }

    updateActions.append(checkBtn, installBtn);
    updateRow.append(updateStatus, updateActions);

    const links = document.createElement("div");
    links.className = "inimark-about-links";

    const github = createButton({
      label: t("settings.about.github"),
      variant: "ghost",
      onClick: () => {
        window.open("https://github.com/Dionysen/Inimark2", "_blank", "noopener,noreferrer");
      },
    });
    const issues = createButton({
      label: t("settings.about.issues"),
      variant: "ghost",
      onClick: () => {
        window.open(
          "https://github.com/Dionysen/Inimark2/issues",
          "_blank",
          "noopener,noreferrer",
        );
      },
    });
    links.append(github, issues);

    about.append(name, version, desc, license, updateRow, links);
    body.append(about);
  }

  function renderContent(): void {
    shortcutsCleanup?.();
    shortcutsCleanup = null;
    themeCleanup?.();
    themeCleanup = null;
    content.replaceChildren();

    const body = document.createElement("div");
    body.className = "inimark-settings-body";

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
      themeCleanup = renderThemePanel(panelHost);
    }

    if (activeSection === "shortcuts") {
      const panelHost = document.createElement("div");
      panelHost.className = "inimark-settings-shortcuts-host";
      body.append(panelHost);
      shortcutsCleanup = renderShortcutsPanel(panelHost);
    }

    if (activeSection === "libraries") {
      const toolbar = document.createElement("div");
      toolbar.className = "inimark-settings-libraries-toolbar";
      const addBtn = createButton({
        label: t("settings.libraries.add"),
        variant: "primary",
        onClick: () => {
          void (async () => {
            const picked = await pickWorkspace();
            if (picked.status !== "picked") return;
            upsertLibrary(picked.workspace.rootPath, picked.workspace.rootName);
            renderContent();
          })();
        },
      });
      toolbar.append(addBtn);
      body.append(toolbar);

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
          const nameEl = document.createElement("div");
          nameEl.className = "inimark-settings-library-name";
          nameEl.textContent = library.rootName;
          const path = document.createElement("div");
          path.className = "inimark-settings-library-path";
          path.textContent = library.rootPath;
          path.title = library.rootPath;
          meta.append(nameEl, path);

          const removeBtn = createButton({
            label: t("common.remove"),
            variant: "ghost",
            onClick: () => {
              void (async () => {
                removeLibrary(library.id);
                await removeLibraryAccess(library.id);
                renderContent();
              })();
            },
          });

          item.append(meta, removeBtn);
          list.append(item);
        }
        body.append(list);
      }
    }

    if (activeSection === "image") {
      renderImage(body);
    }

    if (activeSection === "about") {
      renderAbout(body);
    }

    content.append(body);
  }

  renderNav();
  renderContent();

  const unsubscribeLocale = onLocaleChange(() => {
    search.input.placeholder = t("settings.searchPlaceholder");
    search.input.setAttribute("aria-label", t("settings.searchPlaceholder"));
    renderNav();
    renderContent();
  });

  return {
    onChange(handler) {
      onChangeHandler = handler;
    },
    refresh() {
      settings = loadSettings();
      search.input.placeholder = t("settings.searchPlaceholder");
      search.input.setAttribute("aria-label", t("settings.searchPlaceholder"));
      renderNav();
      renderContent();
    },
    destroy() {
      unsubscribeLocale();
      resize.destroy();
      titlebar.destroy();
      search.destroy();
      shortcutsCleanup?.();
      themeCleanup?.();
      host.replaceChildren();
      host.className = "";
    },
  };
}
