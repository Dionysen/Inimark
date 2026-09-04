import {
  listLibraries,
  removeLibrary,
  upsertLibrary,
} from "../libraries/store.ts";
import { pickWorkspace, removeLibraryAccess } from "../platform/workspace.ts";
import {
  attachColumnResize,
  loadPersistedWidth,
  persistWidth,
} from "../ui/column-resize.ts";
import { mountTitleBar } from "../ui/titlebar.ts";
import {
  createButton,
  createNavItem,
  createNavList,
  createSearchField,
  createSelect,
  createSlider,
} from "../ui/widgets/index.ts";
import {
  type AppSettings,
  type EditorWidth,
  editorWidthLabel,
  loadSettings,
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

type SettingsSection = "editor" | "appearance" | "shortcuts" | "libraries" | "about";

const SECTION_META: Record<
  SettingsSection,
  { title: string; subtitle: string; searchTerms: string[] }
> = {
  editor: {
    title: "Editor",
    subtitle: "Editor display and layout",
    searchTerms: ["font", "size", "width", "layout", "typography"],
  },
  appearance: {
    title: "Appearance",
    subtitle: "Theme and visual preferences",
    searchTerms: ["theme", "color", "dark", "light", "style"],
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
  about: {
    title: "About",
    subtitle: "Application information",
    searchTerms: ["version", "license", "info"],
  },
};

const SETTINGS_NAV_WIDTH_KEY = "inimark-settings-nav-width";
const SETTINGS_NAV_WIDTH_DEFAULT = 220;
const SETTINGS_NAV_WIDTH_MIN = 160;
const SETTINGS_NAV_WIDTH_MAX = 420;

function sectionMatches(id: SettingsSection, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const meta = SECTION_META[id];
  if (meta.title.toLowerCase().includes(q)) return true;
  if (meta.subtitle.toLowerCase().includes(q)) return true;
  return meta.searchTerms.some((term) => term.includes(q) || q.includes(term));
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

  host.className = "inimark-settings-shell";
  host.replaceChildren();

  const layout = document.createElement("div");
  layout.className = "inimark-settings-layout";

  // ── Left nav (full-height; owns traffic-light topbar) ────────────
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
    { id: "shortcuts", label: "Shortcuts" },
    { id: "libraries", label: "Libraries" },
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

  // ── Right column (topbar with window controls + content) ─────────
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
    navList.hidden = visible === 0;
    navEmpty.hidden = visible > 0;
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

  function update(partial: Partial<AppSettings>): void {
    settings = { ...settings, ...partial };
    saveSettings(settings);
    onChangeHandler(settings);
    renderContent();
  }

  let shortcutsCleanup: (() => void) | null = null;
  let themeCleanup: (() => void) | null = null;

  function renderContent(): void {
    shortcutsCleanup?.();
    shortcutsCleanup = null;
    themeCleanup?.();
    themeCleanup = null;
    content.replaceChildren();

    const header = document.createElement("header");
    header.className = "inimark-settings-header";
    const badge = document.createElement("span");
    badge.className = "inimark-settings-badge";
    badge.textContent = "User";
    const title = document.createElement("h2");
    title.className = "inimark-settings-title";
    title.textContent = SECTION_META[activeSection].title;
    const subtitle = document.createElement("p");
    subtitle.className = "inimark-settings-subtitle";
    subtitle.textContent = SECTION_META[activeSection].subtitle;
    header.append(badge, title, subtitle);
    content.append(header);

    const body = document.createElement("div");
    body.className = "inimark-settings-body";

    if (activeSection === "editor") {
      const fontSize = createSlider({
        min: 13,
        max: 22,
        step: 1,
        value: settings.fontSize,
        formatValue: (value) => `${value}px`,
        onChange(value) {
          update({ fontSize: value });
        },
      });
      body.append(
        createRow(
          "font_size",
          "Base font size for the editor content area.",
          fontSize.el,
        ),
      );

      const widthSelect = createSelect({
        value: settings.editorWidth,
        options: (["narrow", "medium", "wide", "full"] as EditorWidth[]).map(
          (option) => ({
            value: option,
            label: editorWidthLabel(option),
          }),
        ),
        minWidth: 140,
        onChange(value) {
          update({ editorWidth: value as EditorWidth });
        },
      });
      body.append(
        createRow(
          "editor_width",
          "Maximum width of the writing column.",
          widthSelect.el,
        ),
      );
    }

    if (activeSection === "appearance") {
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
          const name = document.createElement("div");
          name.className = "inimark-settings-library-name";
          name.textContent = library.rootName;
          const path = document.createElement("div");
          path.className = "inimark-settings-library-path";
          path.textContent = library.rootPath;
          path.title = library.rootPath;
          meta.append(name, path);

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

    if (activeSection === "about") {
      const about = document.createElement("div");
      about.className = "inimark-about";
      about.innerHTML = `
        <p class="inimark-about-name">Inimark</p>
        <p class="inimark-about-version">Version 0.1.0</p>
        <p class="inimark-about-desc">A minimal, fast Markdown editor built with Tauri and a Typora-style editing core.</p>
        <p class="inimark-about-license">MIT License · Editor core includes typora-web (MIT)</p>
      `;
      body.append(about);
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
