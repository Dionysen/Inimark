import {
  type AppSettings,
  type AppearanceMode,
  type EditorWidth,
  editorWidthLabel,
  loadSettings,
  saveSettings,
} from "./store.ts";

export interface SettingsViewController {
  onChange(handler: (settings: AppSettings) => void): void;
  destroy(): void;
}

export interface SettingsViewOptions {
  onChange?: (settings: AppSettings) => void;
}

type SettingsSection = "editor" | "appearance" | "about";

export function mountSettingsView(
  host: HTMLElement,
  options?: SettingsViewOptions,
): SettingsViewController {
  let settings = loadSettings();
  let activeSection: SettingsSection = "editor";
  let onChangeHandler: (settings: AppSettings) => void =
    options?.onChange ?? (() => {});

  host.className = "inimark-settings-window";

  const layout = document.createElement("div");
  layout.className = "inimark-settings-layout";

  const nav = document.createElement("nav");
  nav.className = "inimark-settings-nav";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "inimark-settings-search";
  search.placeholder = "Search settings…";
  search.disabled = true;
  search.title = "Search coming soon";

  const navList = document.createElement("div");
  navList.className = "inimark-settings-nav-list";

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "editor", label: "Editor" },
    { id: "appearance", label: "Appearance" },
    { id: "about", label: "About" },
  ];

  const navButtons = new Map<SettingsSection, HTMLButtonElement>();

  for (const section of sections) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "inimark-settings-nav-item";
    btn.dataset.section = section.id;
    btn.innerHTML = `<span class="inimark-settings-nav-chevron">›</span><span>${section.label}</span>`;
    btn.addEventListener("click", () => {
      activeSection = section.id;
      renderNav();
      renderContent();
    });
    navButtons.set(section.id, btn);
    navList.append(btn);
  }

  nav.append(search, navList);

  const main = document.createElement("div");
  main.className = "inimark-settings-main";

  const content = document.createElement("div");
  content.className = "inimark-settings-content";

  main.append(content);
  layout.append(nav, main);
  host.append(layout);

  function renderNav(): void {
    for (const [id, btn] of navButtons) {
      btn.classList.toggle("is-active", id === activeSection);
    }
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

  function renderContent(): void {
    content.replaceChildren();

    const header = document.createElement("header");
    header.className = "inimark-settings-header";
    const badge = document.createElement("span");
    badge.className = "inimark-settings-badge";
    badge.textContent = "User";
    const title = document.createElement("h2");
    title.className = "inimark-settings-title";
    title.textContent =
      activeSection === "editor"
        ? "Editor"
        : activeSection === "appearance"
          ? "Appearance"
          : "About";
    const subtitle = document.createElement("p");
    subtitle.className = "inimark-settings-subtitle";
    subtitle.textContent =
      activeSection === "editor"
        ? "Editor display and layout"
        : activeSection === "appearance"
          ? "Theme and visual preferences"
          : "Application information";
    header.append(badge, title, subtitle);
    content.append(header);

    const body = document.createElement("div");
    body.className = "inimark-settings-body";

    if (activeSection === "editor") {
      const fontSize = document.createElement("input");
      fontSize.type = "range";
      fontSize.className = "inimark-range";
      fontSize.min = "13";
      fontSize.max = "22";
      fontSize.step = "1";
      fontSize.value = String(settings.fontSize);
      const fontSizeValue = document.createElement("span");
      fontSizeValue.className = "inimark-settings-value";
      fontSizeValue.textContent = `${settings.fontSize}px`;
      fontSize.addEventListener("input", () => {
        const value = Number(fontSize.value);
        fontSizeValue.textContent = `${value}px`;
        update({ fontSize: value });
      });
      const fontSizeWrap = document.createElement("div");
      fontSizeWrap.className = "inimark-settings-range-wrap";
      fontSizeWrap.append(fontSize, fontSizeValue);
      body.append(
        createRow(
          "font_size",
          "Base font size for the editor content area.",
          fontSizeWrap,
        ),
      );

      const widthSelect = document.createElement("select");
      widthSelect.className = "inimark-select";
      for (const option of ["narrow", "medium", "wide", "full"] as EditorWidth[]) {
        const el = document.createElement("option");
        el.value = option;
        el.textContent = editorWidthLabel(option);
        widthSelect.append(el);
      }
      widthSelect.value = settings.editorWidth;
      widthSelect.addEventListener("change", () => {
        update({ editorWidth: widthSelect.value as EditorWidth });
      });
      body.append(
        createRow(
          "editor_width",
          "Maximum width of the writing column.",
          widthSelect,
        ),
      );
    }

    if (activeSection === "appearance") {
      const appearanceSelect = document.createElement("select");
      appearanceSelect.className = "inimark-select";
      for (const option of [
        { value: "system", label: "System default" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ] as Array<{ value: AppearanceMode; label: string }>) {
        const el = document.createElement("option");
        el.value = option.value;
        el.textContent = option.label;
        appearanceSelect.append(el);
      }
      appearanceSelect.value = settings.appearance;
      appearanceSelect.addEventListener("change", () => {
        update({ appearance: appearanceSelect.value as AppearanceMode });
      });
      body.append(
        createRow(
          "appearance",
          "Choose light, dark, or follow the operating system.",
          appearanceSelect,
        ),
      );
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
    destroy() {
      host.replaceChildren();
      host.className = "";
    },
  };
}
