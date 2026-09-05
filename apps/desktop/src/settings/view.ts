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

const SECTION_META: Record<
  SettingsSection,
  { title: string; subtitle: string; searchTerms: string[] }
> = {
  editor: {
    title: "Editor",
    subtitle: "Typography, layout, and save behavior",
    searchTerms: [
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
  },
  appearance: {
    title: "Appearance",
    subtitle: "Interface chrome and density",
    searchTerms: ["density", "ui font", "library bar", "interface", "chrome", "menu"],
  },
  theme: {
    title: "Theme",
    subtitle: "App and code themes",
    searchTerms: ["theme", "color", "dark", "light", "style", "syntax", "highlight"],
  },
  shortcuts: {
    title: "Shortcuts",
    subtitle: "Keyboard shortcuts for common actions",
    searchTerms: ["keyboard", "hotkey", "keymap", "binding"],
  },
  libraries: {
    title: "Libraries",
    subtitle: "Manage saved folder libraries",
    searchTerms: ["folder", "vault", "workspace", "files"],
  },
  image: {
    title: "Images",
    subtitle: "Paste and drop image storage",
    searchTerms: ["image", "assets", "paste", "filename", "upload"],
  },
  about: {
    title: "About",
    subtitle: "Version and updates",
    searchTerms: ["version", "license", "info", "github", "update", "upgrade"],
  },
};

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
  const meta = SECTION_META[id];
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
    placeholder: "Search settings…",
    onInput(value) {
      searchQuery = value;
      renderNav();
    },
  });

  const navList = createNavList();

  const navEmpty = document.createElement("div");
  navEmpty.className = "inimark-settings-nav-empty";
  navEmpty.hidden = true;
  navEmpty.innerHTML = `<span>No matching settings</span>`;

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "editor", label: "Editor" },
    { id: "appearance", label: "Appearance" },
    { id: "theme", label: "Theme" },
    { id: "shortcuts", label: "Shortcuts" },
    { id: "libraries", label: "Libraries" },
    { id: "image", label: "Images" },
    { id: "about", label: "About" },
  ];

  const navButtons = new Map<SettingsSection, HTMLButtonElement>();

  for (const section of sections) {
    const btn = createNavItem({
      id: section.id,
      label: section.label,
      onClick() {
        activeSection = section.id;
        renderNav();
        renderContent();
      },
    });
    navButtons.set(section.id, btn);
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
      if (match) visible += 1;
    }
    const querying = searchQuery.trim().length > 0;
    navList.hidden = querying && visible === 0;
    navEmpty.hidden = !(querying && visible === 0);
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
    body.append(createSectionTitle("Experience"));

    const typewriter = createToggle({
      checked: settings.typewriterMode,
      title: "Typewriter mode",
      onChange(checked) {
        update({ typewriterMode: checked });
      },
    });
    body.append(
      createRow(
        "Typewriter mode",
        "Keep the caret line vertically centered while writing.",
        typewriter.el,
      ),
    );

    body.append(createSectionTitle("Typography"));

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
      createRow("Editor font", "Font family for the writing surface.", editorFont.el),
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
      createRow("Code font", "Monospace font for fenced and inline code.", codeFont.el),
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
      createRow("Font size", "Base font size for editor content.", fontSize.el),
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
      createRow("Code font size", "Font size inside code blocks.", codeFontSize.el),
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
      createRow("Line height", "Leading for body paragraphs.", lineHeight.el),
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
        "Paragraph spacing",
        "Vertical gap after paragraphs (em).",
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
      createRow("Code line height", "Leading inside code blocks.", codeLineHeight.el),
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
      createRow("Editor width", "Maximum width of the writing column.", widthSelect.el),
    );

    body.append(createSectionTitle("Save"));

    const autoSave = createToggle({
      checked: settings.autoSave,
      title: "Auto save",
      onChange(checked) {
        update({ autoSave: checked });
      },
    });
    body.append(
      createRow(
        "Auto save",
        "Save the open library file shortly after edits.",
        autoSave.el,
      ),
    );

    const formatOnSave = createToggle({
      checked: settings.markdownFormat.formatOnSave,
      title: "Format on save",
      onChange(checked) {
        patchFormat({ formatOnSave: checked });
      },
    });
    body.append(
      createRow(
        "Format on save",
        "Apply Markdown hygiene options when saving.",
        formatOnSave.el,
      ),
    );

    body.append(createSectionTitle("Markdown format"));

    const cjk = createToggle({
      checked: settings.markdownFormat.cjkSpacing,
      onChange(checked) {
        patchFormat({ cjkSpacing: checked });
      },
    });
    body.append(
      createRow(
        "CJK ↔ Latin spacing",
        "Insert spaces between CJK and Latin/number characters.",
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
        "Trim trailing whitespace",
        "Remove end-of-line spaces (keeps Markdown hard breaks).",
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
      createRow("Final newline", "Ensure the file ends with a single newline.", newline.el),
    );

    const blanks = createToggle({
      checked: settings.markdownFormat.normalizeBlankLines,
      onChange(checked) {
        patchFormat({ normalizeBlankLines: checked });
      },
    });
    body.append(
      createRow(
        "Collapse blank lines",
        "Reduce runs of 3+ blank lines to a single blank line.",
        blanks.el,
      ),
    );
  }

  function renderAppearanceChrome(body: HTMLElement): void {
    body.append(createSectionTitle("Interface"));

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
      createRow("UI font", "Font for chrome, sidebar, and menus.", uiFont.el),
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
      createRow("Menu density", "Padding and control size for lists and menus.", density.el),
    );

    const autoHide = createToggle({
      checked: settings.autoHideLibraryBar,
      onChange(checked) {
        update({ autoHideLibraryBar: checked });
      },
    });
    body.append(
      createRow(
        "Auto-hide library bar",
        "Show the floating library chrome only while hovering the sidebar.",
        autoHide.el,
      ),
    );
  }

  function renderImage(body: HTMLElement): void {
    const mode = createSelect({
      value: settings.image.storageMode,
      options: [
        { value: "library-assets", label: "Library assets folder" },
        { value: "fixed-directory", label: "Fixed local directory" },
      ],
      minWidth: 180,
      onChange(value) {
        patchImage({ storageMode: value as ImageStorageMode });
      },
    });
    body.append(
      createRow(
        "Storage mode",
        "Where pasted and dropped images are stored.",
        mode.el,
      ),
    );

    const filename = createSelect({
      value: settings.image.filenameFormat,
      options: [
        { value: "original", label: "Original name" },
        { value: "timestamp", label: "Timestamp" },
        { value: "both", label: "Original + timestamp" },
      ],
      minWidth: 180,
      onChange(value) {
        patchImage({ filenameFormat: value as ImageFilenameFormat });
      },
    });
    body.append(
      createRow("Filename format", "How new image files are named.", filename.el),
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
          "Auto-create assets folder",
          "Create an assets directory under the library when needed.",
          autoCreate.el,
        ),
      );
    }

    if (settings.image.storageMode === "fixed-directory") {
      const pathField = createTextField({
        value: settings.image.fixedDirectoryPath,
        placeholder: "No folder selected",
      });
      pathField.input.readOnly = true;

      const pickBtn = createButton({
        label: "Choose…",
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
          "Storage path",
          "Absolute folder used for all saved images.",
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
        aboutVersion = "0.1.4";
      }
    } catch {
      aboutVersion = "0.1.4";
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
    version.textContent = aboutVersion === "…" ? "Version …" : `Version ${aboutVersion}`;

    const desc = document.createElement("p");
    desc.className = "inimark-about-desc";
    desc.textContent =
      "A minimal, fast Markdown editor built with Tauri and a Typora-style editing core.";

    const license = document.createElement("p");
    license.className = "inimark-about-license";
    license.textContent = "MIT License · Editor core includes typora-web (MIT)";

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
      label: "Check for updates",
      variant: "ghost",
      onClick: () => {
        void (async () => {
          if (!isTauri() || checking || installing) return;
          checking = true;
          pendingVersion = null;
          setStatus("Checking…");
          checkBtn.disabled = true;
          installBtn.hidden = true;
          try {
            const { checkForUpdate } = await import("../updater.ts");
            const info = await checkForUpdate();
            if (!info) {
              setStatus("You're up to date.");
            } else {
              pendingVersion = info.version;
              setStatus(`Update available: v${info.version}`);
              installBtn.hidden = false;
              installBtn.textContent = `Update to v${info.version}`;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Could not check for updates: ${message}`);
          } finally {
            checking = false;
            checkBtn.disabled = false;
          }
        })();
      },
    });

    const installBtn = createButton({
      label: "Install update",
      variant: "primary",
      onClick: () => {
        void (async () => {
          if (!isTauri() || installing || !pendingVersion) return;
          installing = true;
          checkBtn.disabled = true;
          installBtn.disabled = true;
          setStatus(`Downloading v${pendingVersion}…`);
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
                  ? `Downloading v${pendingVersion}… ${pct}`
                  : `Downloading v${pendingVersion}…`,
              );
            });
            setStatus("Update installed. Restarting…");
            await relaunchApp();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Update failed: ${message}`);
            installing = false;
            checkBtn.disabled = false;
            installBtn.disabled = false;
          }
        })();
      },
    });
    installBtn.hidden = true;

    if (!isTauri()) {
      setStatus("Updates are available in the desktop app.");
      checkBtn.disabled = true;
    }

    updateActions.append(checkBtn, installBtn);
    updateRow.append(updateStatus, updateActions);

    const links = document.createElement("div");
    links.className = "inimark-about-links";

    const github = createButton({
      label: "GitHub",
      variant: "ghost",
      onClick: () => {
        window.open("https://github.com/Dionysen/Inimark2", "_blank", "noopener,noreferrer");
      },
    });
    const issues = createButton({
      label: "Issues",
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
        label: "Add library…",
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
        empty.textContent = "No libraries saved yet. Add a folder to get started.";
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
            label: "Remove",
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

  return {
    onChange(handler) {
      onChangeHandler = handler;
    },
    refresh() {
      settings = loadSettings();
      renderNav();
      renderContent();
    },
    destroy() {
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
