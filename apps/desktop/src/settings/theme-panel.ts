import { t } from "../i18n/index.ts";
import { createToggle } from "../ui/widgets/index.ts";
import { getThemeManager } from "../themes/manager.ts";
import type { ThemePair } from "../themes/appearance.ts";
import { BUILTIN_THEMES } from "../themes/builtin.ts";
import { CODE_THEMES, type CustomCodeTheme } from "../themes/code-themes.ts";
import {
  CODE_THEME_COLOR_SCHEMA,
  CODE_THEME_SAMPLE_SNIPPETS,
  mergeCodeThemeWithSchema,
  codeThemeVarsToPreviewStyle,
} from "../themes/code-theme-tokens.ts";
import {
  buildThemeEditorSections,
  getBuiltinColorMap,
  mergeWithSchema,
} from "../themes/theme-tokens.ts";
import { syncAccentRgb } from "../themes/color-utils.ts";
import { createThemeColorField } from "../themes/color-field.ts";
import { createThemeSizeField } from "../themes/size-field.ts";
import { createThemeToggleField } from "../themes/toggle-field.ts";
import { builtinThemeLabel, themeLabel, themeTokenDesc } from "../themes/labels.ts";
import {
  getCustomThemeCss,
  getCodeThemeCss,
  parseCssVariables,
  resolveThemePreviewColors,
  type ThemeManifest,
  type ThemeVariable,
} from "../themes/custom-theme-manager.ts";
import { loadSettings, type AppSettings } from "./store.ts";
import {
  pickAndReadThemePackFile,
  type ThemePack,
} from "../themes/theme-pack.ts";

export interface ThemePanelOptions {
  onAppSettingsChange?: (partial: Partial<AppSettings>) => void;
}

export function getThemeSlotSelection(
  id: string,
  pair: ThemePair,
): "none" | "light" | "dark" | "both" {
  const light = pair.light === id;
  const dark = pair.dark === id;
  if (light && dark) return "both";
  if (light) return "light";
  if (dark) return "dark";
  return "none";
}

/** Thumbnail palette from builtin color maps — stays in sync with themes.css. */
function builtinPreviewColors(id: string): string[] {
  const colors = getBuiltinColorMap(id);
  if (!colors) return ["#ffffff", "#4eb289", "#1e293b", "#e2e8f0"];
  return [
    colors["--bg-primary"] ?? "#ffffff",
    colors["--accent"] ?? "#4eb289",
    colors["--text-primary"] ?? "#1e293b",
    colors["--bg-secondary"] ?? colors["--border"] ?? "#e2e8f0",
  ];
}

const CODE_SAMPLE_LABELS: Record<string, string> = {
  codeSampleJs: "JavaScript",
  codeSamplePython: "Python",
  codeSampleCss: "CSS",
  codeSampleCpp: "C++",
  codeSampleRust: "Rust",
};

/** Static hljs-class markup for code theme previews (no highlight.js). */
const CODE_SAMPLE_HTML: Record<string, string> = {
  javascript: `<span class="hljs-keyword">function</span> <span class="hljs-built_in">greet</span>(name) {
  <span class="hljs-comment">// say hello</span>
  <span class="hljs-keyword">return</span> <span class="hljs-string">\`Hi, \${name}!\`</span>;
}

<span class="hljs-keyword">const</span> answer = <span class="hljs-number">42</span>;
<span class="hljs-built_in">console</span>.<span class="hljs-built_in">log</span>(<span class="hljs-built_in">greet</span>(<span class="hljs-string">"Inimark"</span>));`,
  python: `<span class="hljs-keyword">def</span> <span class="hljs-built_in">greet</span>(name: str) -> str:
    <span class="hljs-comment"># say hello</span>
    <span class="hljs-keyword">return</span> <span class="hljs-string">f"Hi, {name}!"</span>

answer = <span class="hljs-number">42</span>
<span class="hljs-built_in">print</span>(<span class="hljs-built_in">greet</span>(<span class="hljs-string">"Inimark"</span>))`,
  css: `<span class="hljs-built_in">.card</span> {
  <span class="hljs-comment">/* surface */</span>
  color: <span class="hljs-number">#1e293b</span>;
  background: <span class="hljs-string">rgba(78, 178, 137, 0.08)</span>;
  border-radius: <span class="hljs-number">8px</span>;
}`,
  cpp: `<span class="hljs-keyword">#include</span> <span class="hljs-string">&lt;cstdio&gt;</span>

<span class="hljs-comment">// greet helper</span>
<span class="hljs-keyword">int</span> <span class="hljs-built_in">main</span>() {
  <span class="hljs-keyword">const</span> <span class="hljs-keyword">char</span>* name = <span class="hljs-string">"Inimark"</span>;
  <span class="hljs-keyword">int</span> answer = <span class="hljs-number">42</span>;
  <span class="hljs-built_in">printf</span>(<span class="hljs-string">"%s %d\\n"</span>, name, answer);
  <span class="hljs-keyword">return</span> <span class="hljs-built_in">sizeof</span>(<span class="hljs-keyword">int</span>);
}`,
  rust: `<span class="hljs-keyword">fn</span> <span class="hljs-built_in">greet</span>(name: &amp;<span class="hljs-keyword">str</span>) -> <span class="hljs-built_in">String</span> {
    <span class="hljs-comment">// say hello</span>
    <span class="hljs-built_in">format!</span>(<span class="hljs-string">"Hi, {}!"</span>, name)
}

<span class="hljs-keyword">fn</span> <span class="hljs-built_in">main</span>() {
    <span class="hljs-keyword">let</span> answer: <span class="hljs-built_in">i32</span> = <span class="hljs-number">42</span>;
    <span class="hljs-built_in">println!</span>(<span class="hljs-string">"{} {}"</span>, <span class="hljs-built_in">greet</span>(<span class="hljs-string">"Inimark"</span>), answer);
}`,
};

const SVG_CHECK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
const SVG_EDIT =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const SVG_DELETE =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const SVG_PLUS =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SVG_EXPORT =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const SVG_IMPORT =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

type DeleteConfirm =
  | { kind: "app"; name: string; id: string }
  | { kind: "code"; name: string; id: string };

type NameDialogState = {
  open: boolean;
  mode: "rename-app" | "rename-code";
  id: string;
  defaultName: string;
};

type PackDialogState =
  | null
  | {
      mode: "export";
      packName: string;
      selectedApp: Set<string>;
      selectedCode: Set<string>;
    }
  | {
      mode: "import";
      pack: ThemePack;
      selectedApp: Set<number>;
      selectedCode: Set<number>;
    };

function attachOverlayDismiss(overlay: HTMLElement, onDismiss: () => void): void {
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) onDismiss();
  });
}

type FieldDestroyable = HTMLElement & { destroy?: () => void; updateValue?: (v: string) => void };

export function renderThemePanel(
  host: HTMLElement,
  options?: ThemePanelOptions,
): () => void {
  const themeManager = getThemeManager();
  const onAppSettingsChange = options?.onAppSettingsChange;

  let themeKindTab: "app" | "code" = "app";
  let importing = false;
  let exporting = false;
  let forking = false;
  let forkingCode = false;
  let codeSampleLang = CODE_THEME_SAMPLE_SNIPPETS[0].id;

  let editingTheme: ThemeManifest | null = null;
  let editVariables: ThemeVariable[] = [];

  let editingCodeTheme: CustomCodeTheme | null = null;
  let editCodeVariables: ThemeVariable[] = [];

  let deleteConfirm: DeleteConfirm | null = null;
  let packDialog: PackDialogState = null;
  let nameDialog: NameDialogState = {
    open: false,
    mode: "rename-app",
    id: "",
    defaultName: "",
  };
  let themeName = "";

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let codePreviewTimer: ReturnType<typeof setTimeout> | null = null;
  let fieldCleanups: Array<() => void> = [];

  function clearFieldCleanups(): void {
    for (const fn of fieldCleanups) fn();
    fieldCleanups = [];
  }

  function schedulePreview(id: string, vars: ThemeVariable[]): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      themeManager.previewThemeVariables(id, vars);
    }, 120);
  }

  function scheduleCodePreview(id: string, vars: ThemeVariable[]): void {
    if (codePreviewTimer) clearTimeout(codePreviewTimer);
    codePreviewTimer = setTimeout(() => {
      themeManager.previewCodeThemeVariables(id, vars);
    }, 80);
  }

  function resolveAppDisplayName(id: string, customThemes: ThemeManifest[]): string {
    if ((BUILTIN_THEMES as readonly string[]).includes(id)) return builtinThemeLabel(id);
    if (id.startsWith("custom-")) {
      const mid = id.replace("custom-", "");
      return customThemes.find((m) => m.id === mid)?.name || id;
    }
    return id;
  }

  function resolveCodeDisplayName(id: string, customCodeThemes: CustomCodeTheme[]): string {
    const builtin = CODE_THEMES.find((c) => c.id === id);
    if (builtin) return builtin.name;
    return customCodeThemes.find((m) => m.id === id)?.name || id;
  }

  function renderThemeSlotLabel(id: string, pair: ThemePair): HTMLElement | null {
    const slot = getThemeSlotSelection(id, pair);
    if (slot === "none") return null;
    const labels: Record<string, string> = {
      both: t("settings.theme.slotBoth"),
      light: t("settings.theme.light"),
      dark: t("settings.theme.dark"),
    };
    const span = document.createElement("span");
    span.className = `settings-theme-slot-label slot-${slot}`;
    span.textContent = labels[slot];
    return span;
  }

  function createThemeMock(colors: string[]): HTMLElement {
    const mock = document.createElement("div");
    mock.className = "theme-preview-mock";

    const titlebar = document.createElement("div");
    titlebar.className = "mock-titlebar";
    titlebar.style.background = colors[0];
    const dots = document.createElement("div");
    dots.className = "mock-dots";
    for (const idx of [1, 3, 3]) {
      const dot = document.createElement("span");
      dot.style.background = colors[idx];
      dots.append(dot);
    }
    titlebar.append(dots);

    const body = document.createElement("div");
    body.className = "mock-body";

    const sidebar = document.createElement("div");
    sidebar.className = "mock-sidebar";
    sidebar.style.background = colors[3];
    const sidebarLines = [
      { w: "60%", color: colors[1], opacity: 1 },
      { w: "80%", color: colors[2], opacity: 0.3 },
      { w: "45%", color: colors[2], opacity: 0.3 },
    ];
    for (const { w, color, opacity } of sidebarLines) {
      const line = document.createElement("div");
      line.className = "mock-line";
      line.style.background = color;
      line.style.width = w;
      if (opacity < 1) line.style.opacity = String(opacity);
      sidebar.append(line);
    }

    const editor = document.createElement("div");
    editor.className = "mock-editor";
    editor.style.background = colors[0];
    for (const [w, opacity, accent] of [
      ["70%", 0.2, false],
      ["55%", 0.15, false],
      ["40%", 1, true],
    ] as const) {
      const line = document.createElement("div");
      line.className = accent ? "mock-accent-line" : "mock-line";
      line.style.background = accent ? colors[1] : colors[2];
      line.style.width = w;
      if (!accent) line.style.opacity = String(opacity);
      editor.append(line);
    }

    body.append(sidebar, editor);
    mock.append(titlebar, body);
    return mock;
  }

  function appendCheckmark(parent: HTMLElement): void {
    const check = document.createElement("div");
    check.className = "settings-theme-check";
    check.innerHTML = SVG_CHECK;
    parent.append(check);
  }

  function createCodePreviewBlock(
    previewStyle?: Record<string, string>,
    onLangChange?: (id: string) => void,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "settings-code-theme-preview";

    const toolbar = document.createElement("div");
    toolbar.className = "settings-code-theme-preview-toolbar";

    const title = document.createElement("div");
    title.className = "settings-code-theme-preview-title";
    title.textContent = t("settings.theme.preview");

    const tabs = document.createElement("div");
    tabs.className = "settings-code-sample-tabs";
    for (const snippet of CODE_THEME_SAMPLE_SNIPPETS) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `settings-code-sample-tab${codeSampleLang === snippet.id ? " active" : ""}`;
      tab.textContent = CODE_SAMPLE_LABELS[snippet.labelKey] ?? snippet.id;
      tab.addEventListener("click", () => {
        codeSampleLang = snippet.id;
        onLangChange?.(snippet.id);
        render();
      });
      tabs.append(tab);
    }

    toolbar.append(title, tabs);

    const pre = document.createElement("pre");
    pre.className = "settings-code-theme-preview-code";
    if (previewStyle) {
      for (const [k, v] of Object.entries(previewStyle)) {
        pre.style.setProperty(k, v);
      }
    }
    const code = document.createElement("code");
    code.innerHTML = CODE_SAMPLE_HTML[codeSampleLang] ?? CODE_SAMPLE_HTML.javascript;
    pre.append(code);

    wrap.append(toolbar, pre);
    return wrap;
  }

  async function openEditor(manifest: ThemeManifest, variables: ThemeVariable[]): Promise<void> {
    const merged = syncAccentRgb(
      mergeWithSchema(variables, getBuiltinColorMap("light") ?? undefined),
    ) as ThemeVariable[];
    editVariables = merged;
    editingTheme = manifest;
    const snap = themeManager.getSnapshot();
    themeManager.setPreferredAppTheme(snap.resolvedMode, `custom-${manifest.id}`);
    themeManager.previewThemeVariables(manifest.id, merged);
    render();
  }

  async function handleStartEdit(manifest: ThemeManifest): Promise<void> {
    try {
      const css = await getCustomThemeCss(manifest.id);
      await openEditor(manifest, parseCssVariables(css));
    } catch (err) {
      console.error("Failed to load theme", err);
    }
  }

  async function handleForkBuiltin(builtinId: string, label: string): Promise<void> {
    try {
      forking = true;
      render();
      const name = t("settings.theme.forkName", { name: label });
      const manifest = await themeManager.createThemeFromBuiltin(builtinId, name);
      await handleStartEdit(manifest);
    } catch (err) {
      console.error("Fork failed", err);
    } finally {
      forking = false;
      render();
    }
  }

  async function handleCreateBlank(kind: "light" | "dark"): Promise<void> {
    try {
      forking = true;
      render();
      const manifest = await themeManager.createThemeFromTemplate(
        kind,
        t("settings.theme.newTheme"),
      );
      await handleStartEdit(manifest);
    } catch (err) {
      console.error("Create theme failed", err);
    } finally {
      forking = false;
      render();
    }
  }

  async function openCodeEditor(
    manifest: CustomCodeTheme,
    variables: ThemeVariable[],
  ): Promise<void> {
    const merged = mergeCodeThemeWithSchema(variables);
    editCodeVariables = merged;
    editingCodeTheme = manifest;
    const snap = themeManager.getSnapshot();
    themeManager.setPreferredCodeTheme(snap.resolvedMode, manifest.id);
    themeManager.previewCodeThemeVariables(manifest.id, merged);
    render();
  }

  async function handleStartEditCodeTheme(manifest: CustomCodeTheme): Promise<void> {
    try {
      const css = await getCodeThemeCss(manifest.id);
      await openCodeEditor(manifest, parseCssVariables(css));
    } catch (err) {
      console.error("Failed to load code theme", err);
    }
  }

  async function handleForkCodeTheme(builtinId: string, label: string): Promise<void> {
    try {
      forkingCode = true;
      render();
      const name = t("settings.theme.forkName", { name: label });
      const manifest = await themeManager.createCodeThemeFromBuiltin(builtinId, name);
      await handleStartEditCodeTheme(manifest);
    } catch (err) {
      console.error("Fork code theme failed", err);
    } finally {
      forkingCode = false;
      render();
    }
  }

  async function handleSaveAppEdit(manifest: ThemeManifest): Promise<void> {
    const synced = syncAccentRgb(editVariables) as ThemeVariable[];
    await themeManager.updateThemeVariables(manifest.id, synced);
    editingTheme = null;
    render();
  }

  async function handleCancelAppEdit(manifest: ThemeManifest): Promise<void> {
    try {
      const css = await getCustomThemeCss(manifest.id);
      themeManager.previewThemeVariables(manifest.id, parseCssVariables(css));
    } catch {
      /* ignore */
    }
    editingTheme = null;
    render();
  }

  function renderAppEditor(): HTMLElement {
    clearFieldCleanups();
    const manifest = editingTheme!;
    const sections = buildThemeEditorSections(editVariables);

    const root = document.createElement("div");
    root.className = "settings-section theme-editor";

    const sticky = document.createElement("div");
    sticky.className = "theme-editor-sticky";

    const header = document.createElement("div");
    header.className = "theme-editor-header";

    const title = document.createElement("h3");
    title.className = "theme-editor-title";
    title.textContent = t("settings.theme.editTheme", { name: manifest.name });

    const actions = document.createElement("div");
    actions.className = "theme-editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = t("settings.theme.save");
    saveBtn.addEventListener("click", () => void handleSaveAppEdit(manifest));
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-editor-cancel";
    cancelBtn.textContent = t("settings.theme.cancel");
    cancelBtn.addEventListener("click", () => void handleCancelAppEdit(manifest));
    actions.append(saveBtn, cancelBtn);
    header.append(title, actions);
    sticky.append(header);

    const variablesHost = document.createElement("div");
    variablesHost.className = "theme-editor-variables inimark-scrollbar";

    function handleVariableChange(name: string, newValue: string): void {
      let next = editVariables.map((v) => (v.name === name ? { ...v, value: newValue } : v));
      if (name === "--accent") {
        next = syncAccentRgb(next) as ThemeVariable[];
      }
      editVariables = next;
      schedulePreview(manifest.id, next);
    }

    for (const section of sections) {
      const group = document.createElement("div");
      group.className = "theme-editor-group";
      const groupTitle = document.createElement("h4");
      groupTitle.className = "theme-editor-group-title";
      groupTitle.textContent = themeLabel(section.titleKey);
      group.append(groupTitle);

      for (const field of section.fields) {
        if (field.kind === "color") {
          const row = createThemeColorField({
            label: themeLabel(field.meta.labelKey),
            description: themeTokenDesc(field.meta.labelKey),
            value: field.variable.value,
            onChange: (val) => handleVariableChange(field.variable.name, val),
          }) as FieldDestroyable;
          if (row.destroy) fieldCleanups.push(row.destroy);
          group.append(row);
        } else if (field.kind === "size") {
          group.append(
            createThemeSizeField({
              label: themeLabel(field.meta.labelKey),
              description: themeTokenDesc(field.meta.labelKey),
              value: field.variable.value,
              meta: field.meta,
              onChange: (val) => handleVariableChange(field.variable.name, val),
            }),
          );
        } else {
          const row = createThemeToggleField({
            label: themeLabel(field.meta.labelKey),
            description: themeTokenDesc(field.meta.labelKey),
            value: field.variable.value,
            onChange: (val) => handleVariableChange(field.variable.name, val),
          });
          fieldCleanups.push(row.destroy);
          group.append(row);
        }
      }
      variablesHost.append(group);
    }

    root.append(sticky, variablesHost);
    return root;
  }

  async function handleSaveCodeEdit(manifest: CustomCodeTheme): Promise<void> {
    try {
      await themeManager.updateCodeThemeVariables(manifest.id, editCodeVariables);
    } catch (err) {
      console.error("Save code theme failed", err);
      alert(
        t("settings.theme.saveFailed", {
          error: err instanceof Error ? err.message : t("settings.theme.unknownError"),
        }),
      );
      return;
    }
    editingCodeTheme = null;
    render();
  }

  async function handleCancelCodeEdit(manifest: CustomCodeTheme): Promise<void> {
    try {
      const css = await getCodeThemeCss(manifest.id);
      if (css) {
        themeManager.previewCodeThemeVariables(manifest.id, parseCssVariables(css));
      }
    } catch (err) {
      console.error("Cancel code theme edit failed", err);
    }
    editingCodeTheme = null;
    render();
  }

  function renderCodeEditor(): HTMLElement {
    clearFieldCleanups();
    const manifest = editingCodeTheme!;
    const previewStyle = codeThemeVarsToPreviewStyle(editCodeVariables);

    const root = document.createElement("div");
    root.className = "settings-section theme-editor code-theme-editor";

    const sticky = document.createElement("div");
    sticky.className = "theme-editor-sticky";

    const header = document.createElement("div");
    header.className = "theme-editor-header";

    const title = document.createElement("h3");
    title.className = "theme-editor-title";
    title.textContent = t("settings.theme.editCodeTheme", { name: manifest.name });

    const actions = document.createElement("div");
    actions.className = "theme-editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = t("settings.theme.save");
    saveBtn.addEventListener("click", () => void handleSaveCodeEdit(manifest));
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-editor-cancel";
    cancelBtn.textContent = t("settings.theme.cancel");
    cancelBtn.addEventListener("click", () => void handleCancelCodeEdit(manifest));
    actions.append(saveBtn, cancelBtn);
    header.append(title, actions);

    const previewWrap = createCodePreviewBlock(previewStyle, () => {
      /* re-render handled in tab click */
    });
    previewWrap.classList.add("code-theme-editor-preview");

    sticky.append(header, previewWrap);

    const variablesHost = document.createElement("div");
    variablesHost.className = "theme-editor-variables inimark-scrollbar";
    const group = document.createElement("div");
    group.className = "theme-editor-group";
    const groupTitle = document.createElement("h4");
    groupTitle.className = "theme-editor-group-title";
    groupTitle.textContent = themeLabel("groupCodeHighlight");
    group.append(groupTitle);

    const pre = previewWrap.querySelector("pre")!;

    function handleCodeVariableChange(name: string, newValue: string): void {
      editCodeVariables = editCodeVariables.map((v) =>
        v.name === name ? { ...v, value: newValue } : v,
      );
      const style = codeThemeVarsToPreviewStyle(editCodeVariables);
      for (const [k, v] of Object.entries(style)) {
        pre.style.setProperty(k, v);
      }
      scheduleCodePreview(manifest.id, editCodeVariables);
    }

    for (const token of CODE_THEME_COLOR_SCHEMA) {
      const variable = editCodeVariables.find((v) => v.name === token.name);
      if (!variable) continue;
      const row = createThemeColorField({
        label: themeLabel(token.labelKey),
        description: themeTokenDesc(token.labelKey),
        value: variable.value,
        onChange: (val) => handleCodeVariableChange(token.name, val),
      }) as FieldDestroyable;
      if (row.destroy) fieldCleanups.push(row.destroy);
      group.append(row);
    }
    variablesHost.append(group);
    root.append(sticky, variablesHost);
    return root;
  }

  function renderPackThemeGroup<T extends string | number>(
    title: string,
    items: { key: T; name: string }[],
    selected: Set<T>,
    onToggle: (key: T, checked: boolean) => void,
    onSelectAll: (checked: boolean) => void,
  ): HTMLElement | null {
    if (items.length === 0) return null;

    const group = document.createElement("section");
    group.className = "theme-pack-select-group";

    const header = document.createElement("div");
    header.className = "theme-pack-select-group-header";

    const heading = document.createElement("h4");
    heading.className = "theme-pack-select-group-title";
    heading.textContent = title;

    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "theme-pack-select-all";
    const allSelected = items.every((item) => selected.has(item.key));
    selectAllBtn.textContent = allSelected
      ? t("settings.theme.packDeselectAll")
      : t("settings.theme.packSelectAll");
    selectAllBtn.addEventListener("click", () => onSelectAll(!allSelected));

    header.append(heading, selectAllBtn);
    group.append(header);

    const list = document.createElement("div");
    list.className = "theme-pack-select-list";

    for (const item of items) {
      const row = document.createElement("label");
      row.className = "theme-pack-select-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(item.key);
      checkbox.addEventListener("change", () => onToggle(item.key, checkbox.checked));

      const name = document.createElement("span");
      name.className = "theme-pack-select-name";
      name.textContent = item.name;

      row.append(checkbox, name);
      list.append(row);
    }

    group.append(list);
    return group;
  }

  function renderPackDialog(container: HTMLElement): void {
    if (!packDialog) return;

    const overlay = document.createElement("div");
    overlay.className = "theme-name-dialog-overlay";
    attachOverlayDismiss(overlay, () => {
      packDialog = null;
      render();
    });

    const dialog = document.createElement("div");
    dialog.className = "theme-name-dialog theme-pack-dialog";

    const title = document.createElement("h3");
    title.className = "theme-name-dialog-title";
    title.textContent =
      packDialog.mode === "export"
        ? t("settings.theme.exportSelectThemes")
        : t("settings.theme.importSelectThemes");

    dialog.append(title);

    if (packDialog.mode === "export") {
      const nameLabel = document.createElement("label");
      nameLabel.className = "theme-pack-name-field";
      const nameText = document.createElement("span");
      nameText.textContent = t("settings.theme.packName");
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "theme-name-dialog-input";
      nameInput.value = packDialog.packName;
      nameInput.placeholder = t("settings.theme.packName");
      nameInput.addEventListener("input", () => {
        if (packDialog?.mode === "export") packDialog.packName = nameInput.value;
      });
      nameLabel.append(nameText, nameInput);
      dialog.append(nameLabel);
    } else {
      const packMeta = document.createElement("p");
      packMeta.className = "theme-pack-dialog-meta";
      packMeta.textContent = packDialog.pack.name;
      dialog.append(packMeta);
    }

    const body = document.createElement("div");
    body.className = "theme-pack-select-body inimark-scrollbar";

    if (packDialog.mode === "export") {
      const snap = themeManager.getSnapshot();
      const appGroup = renderPackThemeGroup(
        t("settings.theme.packAppThemes"),
        snap.customThemes.map((m) => ({
          key: m.id,
          name: m.name,
        })),
        packDialog.selectedApp,
        (key, checked) => {
          if (packDialog?.mode !== "export") return;
          if (checked) packDialog.selectedApp.add(key);
          else packDialog.selectedApp.delete(key);
          render();
        },
        (checked) => {
          if (packDialog?.mode !== "export") return;
          packDialog.selectedApp = checked
            ? new Set(snap.customThemes.map((m) => m.id))
            : new Set();
          render();
        },
      );
      const codeGroup = renderPackThemeGroup(
        t("settings.theme.packCodeThemes"),
        snap.customCodeThemes.map((m) => ({
          key: m.id,
          name: m.name,
        })),
        packDialog.selectedCode,
        (key, checked) => {
          if (packDialog?.mode !== "export") return;
          if (checked) packDialog.selectedCode.add(key);
          else packDialog.selectedCode.delete(key);
          render();
        },
        (checked) => {
          if (packDialog?.mode !== "export") return;
          packDialog.selectedCode = checked
            ? new Set(snap.customCodeThemes.map((m) => m.id))
            : new Set();
          render();
        },
      );
      if (appGroup) body.append(appGroup);
      if (codeGroup) body.append(codeGroup);
    } else {
      const appGroup = renderPackThemeGroup(
        t("settings.theme.packAppThemes"),
        packDialog.pack.themes.app.map((entry, index) => ({
          key: index,
          name: entry.name,
        })),
        packDialog.selectedApp,
        (key, checked) => {
          if (packDialog?.mode !== "import") return;
          if (checked) packDialog.selectedApp.add(key);
          else packDialog.selectedApp.delete(key);
          render();
        },
        (checked) => {
          if (packDialog?.mode !== "import") return;
          packDialog.selectedApp = checked
            ? new Set(packDialog.pack.themes.app.map((_, index) => index))
            : new Set();
          render();
        },
      );
      const codeGroup = renderPackThemeGroup(
        t("settings.theme.packCodeThemes"),
        packDialog.pack.themes.code.map((entry, index) => ({
          key: index,
          name: entry.name,
        })),
        packDialog.selectedCode,
        (key, checked) => {
          if (packDialog?.mode !== "import") return;
          if (checked) packDialog.selectedCode.add(key);
          else packDialog.selectedCode.delete(key);
          render();
        },
        (checked) => {
          if (packDialog?.mode !== "import") return;
          packDialog.selectedCode = checked
            ? new Set(packDialog.pack.themes.code.map((_, index) => index))
            : new Set();
          render();
        },
      );
      if (appGroup) body.append(appGroup);
      if (codeGroup) body.append(codeGroup);
    }

    dialog.append(body);

    const actions = document.createElement("div");
    actions.className = "theme-name-dialog-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-name-dialog-cancel";
    cancelBtn.textContent = t("settings.theme.cancel");
    cancelBtn.addEventListener("click", () => {
      packDialog = null;
      render();
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "settings-button";
    const selectedCount =
      packDialog.mode === "export"
        ? packDialog.selectedApp.size + packDialog.selectedCode.size
        : packDialog.selectedApp.size + packDialog.selectedCode.size;
    confirmBtn.disabled = exporting || importing || selectedCount === 0;
    confirmBtn.textContent =
      packDialog.mode === "export"
        ? exporting
          ? t("settings.theme.exporting")
          : t("settings.theme.exportPack")
        : importing
          ? t("settings.theme.importing")
          : t("settings.theme.importPack");
    confirmBtn.addEventListener("click", () => void handleConfirmPackDialog());

    actions.append(cancelBtn, confirmBtn);
    dialog.append(actions);
    overlay.append(dialog);
    container.append(overlay);
  }

  function renderDialogs(container: HTMLElement): void {
    renderPackDialog(container);

    if (nameDialog.open) {
      const overlay = document.createElement("div");
      overlay.className = "theme-name-dialog-overlay";
      attachOverlayDismiss(overlay, () => {
        nameDialog = { open: false, mode: "rename-app", id: "", defaultName: "" };
        render();
      });

      const dialog = document.createElement("div");
      dialog.className = "theme-name-dialog";

      const title = document.createElement("h3");
      title.className = "theme-name-dialog-title";
      title.textContent = t("settings.theme.renameTheme");

      const input = document.createElement("input");
      input.type = "text";
      input.className = "theme-name-dialog-input";
      input.value = themeName;
      input.placeholder = t("settings.theme.themeName");
      input.addEventListener("input", () => {
        themeName = input.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void handleConfirmNameDialog();
      });

      const actions = document.createElement("div");
      actions.className = "theme-name-dialog-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "settings-button theme-name-dialog-cancel";
      cancelBtn.textContent = t("settings.theme.cancel");
      cancelBtn.addEventListener("click", () => {
        nameDialog = { open: false, mode: "rename-app", id: "", defaultName: "" };
        render();
      });

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "settings-button";
      confirmBtn.textContent = t("settings.theme.confirm");
      confirmBtn.addEventListener("click", () => void handleConfirmNameDialog());

      actions.append(cancelBtn, confirmBtn);
      dialog.append(title, input, actions);
      overlay.append(dialog);
      container.append(overlay);
      queueMicrotask(() => input.focus());
    }

    if (deleteConfirm) {
      const overlay = document.createElement("div");
      overlay.className = "theme-name-dialog-overlay";
      attachOverlayDismiss(overlay, () => {
        deleteConfirm = null;
        render();
      });

      const dialog = document.createElement("div");
      dialog.className = "theme-name-dialog";

      const title = document.createElement("h3");
      title.className = "theme-name-dialog-title";
      title.textContent =
        deleteConfirm.kind === "code"
          ? t("settings.theme.deleteCodeTheme")
          : t("settings.theme.deleteTheme");

      const msg = document.createElement("p");
      msg.style.cssText = "font-size: 14px; color: var(--text-secondary); margin: 0 0 16px";
      msg.textContent = t("settings.theme.deleteMessage", { name: deleteConfirm.name });

      const actions = document.createElement("div");
      actions.className = "theme-name-dialog-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "settings-button theme-name-dialog-cancel";
      cancelBtn.textContent = t("settings.theme.cancel");
      cancelBtn.addEventListener("click", () => {
        deleteConfirm = null;
        render();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "settings-button warning";
      deleteBtn.textContent = t("settings.theme.delete");
      deleteBtn.addEventListener("click", () => void handleConfirmDelete());

      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, msg, actions);
      overlay.append(dialog);
      container.append(overlay);
    }
  }

  async function handleConfirmPackDialog(): Promise<void> {
    if (!packDialog) return;
    try {
      if (packDialog.mode === "export") {
        if (packDialog.selectedApp.size === 0 && packDialog.selectedCode.size === 0) return;
        exporting = true;
        render();
        await themeManager.exportSelectedThemePack(
          packDialog.packName.trim() || "Inimark Theme",
          [...packDialog.selectedApp],
          [...packDialog.selectedCode],
        );
      } else {
        if (packDialog.selectedApp.size === 0 && packDialog.selectedCode.size === 0) return;
        importing = true;
        render();
        await themeManager.importSelectedThemePack(
          packDialog.pack,
          [...packDialog.selectedApp],
          [...packDialog.selectedCode],
        );
      }
      packDialog = null;
    } catch (err) {
      console.error("Theme pack operation failed", err);
      alert(
        t("settings.theme.operationFailed", {
          error: err instanceof Error ? err.message : t("settings.theme.unknownError"),
        }),
      );
    } finally {
      exporting = false;
      importing = false;
      render();
    }
  }

  async function handleConfirmNameDialog(): Promise<void> {
    const name = themeName.trim() || nameDialog.defaultName;
    try {
      if (nameDialog.mode === "rename-app") {
        await themeManager.renameAppTheme(nameDialog.id, name);
        nameDialog = { open: false, mode: "rename-app", id: "", defaultName: "" };
      } else if (nameDialog.mode === "rename-code") {
        await themeManager.renameCodeTheme(nameDialog.id, name);
        nameDialog = { open: false, mode: "rename-app", id: "", defaultName: "" };
      }
    } catch (err) {
      console.error("Rename failed", err);
      alert(
        t("settings.theme.operationFailed", {
          error: err instanceof Error ? err.message : t("settings.theme.unknownError"),
        }),
      );
    } finally {
      render();
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteConfirm) return;
    if (deleteConfirm.kind === "app") {
      await themeManager.deleteTheme(deleteConfirm.id);
    } else {
      await themeManager.deleteCodeTheme(deleteConfirm.id);
    }
    deleteConfirm = null;
    render();
  }

  function renderMain(): HTMLElement {
    const snap = themeManager.getSnapshot();
    const {
      appearanceMode,
      resolvedMode,
      theme,
      codeTheme,
      preferredAppTheme,
      preferredCodeTheme,
      customThemes,
      customCodeThemes,
    } = snap;

    const root = document.createElement("div");
    root.className = "settings-section";

    const modeBlock = document.createElement("div");
    modeBlock.dataset.settingId = "theme.appearanceMode";

    const modeTitle = document.createElement("h3");
    modeTitle.className = "settings-section-title";
    modeTitle.textContent = t("settings.theme.appearanceMode");

    const modeHint = document.createElement("p");
    modeHint.className = "settings-hint";
    modeHint.textContent = t("settings.theme.appearanceModeDesc");

    const modeToggle = document.createElement("div");
    modeToggle.className = "appearance-mode-toggle";
    modeToggle.setAttribute("role", "radiogroup");
    modeToggle.setAttribute("aria-label", t("settings.theme.appearanceMode"));

    for (const [mode, labelKey] of [
      ["system", "settings.theme.system"],
      ["light", "settings.theme.light"],
      ["dark", "settings.theme.dark"],
    ] as const) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(appearanceMode === mode));
      btn.className = `appearance-mode-btn${appearanceMode === mode ? " active" : ""}`;
      btn.textContent = t(labelKey);
      btn.addEventListener("click", () => themeManager.setAppearanceMode(mode));
      modeToggle.append(btn);
    }

    modeBlock.append(modeTitle, modeHint, modeToggle);

    const modeStatus = document.createElement("p");
    modeStatus.className = "settings-hint appearance-mode-status";
    const resolvedLabel =
      resolvedMode === "dark" ? t("settings.theme.dark") : t("settings.theme.light");
    modeStatus.textContent = t("settings.theme.currently", {
      mode: resolvedLabel,
      app: resolveAppDisplayName(theme, customThemes),
      code: resolveCodeDisplayName(codeTheme, customCodeThemes),
    });
    modeBlock.append(modeStatus);

    const glassRow = document.createElement("div");
    glassRow.className = "inimark-settings-row";
    glassRow.style.margin = "4px 0 16px";
    glassRow.dataset.settingId = "theme.glassEffect";
    const glassMeta = document.createElement("div");
    glassMeta.className = "inimark-settings-row-meta";
    const glassTitle = document.createElement("div");
    glassTitle.className = "inimark-settings-row-title";
    glassTitle.textContent = t("settings.theme.glassEffect");
    const glassDesc = document.createElement("p");
    glassDesc.className = "inimark-settings-row-desc";
    glassDesc.textContent = t("settings.theme.glassEffectDesc");
    glassMeta.append(glassTitle, glassDesc);
    const glassCtrl = document.createElement("div");
    glassCtrl.className = "inimark-settings-row-control";
    const glassToggle = createToggle({
      checked: loadSettings().glassEffect,
      onChange(checked) {
        onAppSettingsChange?.({ glassEffect: checked });
      },
    });
    glassCtrl.append(glassToggle.el);
    glassRow.append(glassMeta, glassCtrl);

    const kindTabs = document.createElement("div");
    kindTabs.className = "theme-kind-tabs";
    kindTabs.setAttribute("role", "tablist");
    kindTabs.setAttribute("aria-label", t("settings.theme.themeKind"));
    kindTabs.dataset.settingId = "theme.appTheme";

    for (const [tab, labelKey] of [
      ["app", "settings.theme.appTheme"],
      ["code", "settings.theme.codeTheme"],
    ] as const) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(themeKindTab === tab));
      btn.dataset.themeKindTab = tab;
      btn.className = `theme-kind-tab${themeKindTab === tab ? " active" : ""}`;
      btn.textContent = t(labelKey);
      btn.addEventListener("click", () => {
        themeKindTab = tab;
        render();
      });
      kindTabs.append(btn);
    }

    const slotHint = document.createElement("p");
    slotHint.className = "settings-hint";
    slotHint.style.cssText = "margin-top: 8px; margin-bottom: 12px";
    slotHint.textContent = t("settings.theme.slotHint", { mode: resolvedLabel });

    root.append(modeBlock, glassRow, kindTabs, slotHint);

    if (themeKindTab === "app") {
      const grid = document.createElement("div");
      grid.className = "settings-theme-grid";

      for (const value of BUILTIN_THEMES) {
        const colors = builtinPreviewColors(value);
        const label = builtinThemeLabel(value);
        const preferred = theme === value;

        const card = document.createElement("div");
        card.className = `settings-theme-card${preferred ? " active" : ""}`;
        card.addEventListener("click", () =>
          themeManager.setPreferredAppTheme(resolvedMode, value),
        );

        const preview = document.createElement("div");
        preview.className = "settings-theme-preview";
        preview.dataset.theme = value;
        preview.append(createThemeMock(colors));
        if (preferred) appendCheckmark(preview);

        const actions = document.createElement("div");
        actions.className = "custom-theme-actions";
        const forkBtn = document.createElement("button");
        forkBtn.type = "button";
        forkBtn.className = "custom-theme-edit-btn";
        forkBtn.title = t("settings.theme.forkAndEdit");
        forkBtn.disabled = forking;
        forkBtn.innerHTML = SVG_EDIT;
        forkBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleForkBuiltin(value, label);
        });
        actions.append(forkBtn);
        preview.append(actions);

        const meta = document.createElement("div");
        meta.className = "settings-theme-meta";
        const nameEl = document.createElement("span");
        nameEl.className = "settings-theme-name";
        nameEl.textContent = label;
        meta.append(nameEl);
        const slotLabel = renderThemeSlotLabel(value, preferredAppTheme);
        if (slotLabel) meta.append(slotLabel);

        card.append(preview, meta);
        grid.append(card);
      }

      const divider = document.createElement("div");
      divider.className = "settings-theme-divider";
      divider.setAttribute("role", "separator");
      divider.textContent = t("settings.theme.customThemes");
      grid.append(divider);

      for (const m of customThemes) {
        const themeId = `custom-${m.id}`;
        const preferred = theme === themeId;
        const [c0, c1, c2, c3] = resolveThemePreviewColors(m);

        const card = document.createElement("div");
        card.className = `settings-theme-card custom-theme-card${preferred ? " active" : ""}`;
        card.addEventListener("click", () =>
          themeManager.setPreferredAppTheme(resolvedMode, themeId),
        );

        const preview = document.createElement("div");
        preview.className = "settings-theme-preview";
        preview.append(createThemeMock([c0, c1, c2, c3]));
        if (preferred) appendCheckmark(preview);

        const actions = document.createElement("div");
        actions.className = "custom-theme-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "custom-theme-edit-btn";
        editBtn.title = t("settings.theme.edit");
        editBtn.innerHTML = SVG_EDIT;
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleStartEdit(m);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "custom-theme-delete-btn";
        delBtn.title = t("settings.theme.delete");
        delBtn.innerHTML = SVG_DELETE;
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteConfirm = { kind: "app", name: m.name, id: m.id };
          render();
        });

        actions.append(editBtn, delBtn);
        preview.append(actions);

        const meta = document.createElement("div");
        meta.className = "settings-theme-meta";
        const nameRow = document.createElement("div");
        nameRow.className = "settings-theme-name-row";
        const nameEl = document.createElement("span");
        nameEl.className = "settings-theme-name";
        nameEl.textContent = m.name;
        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "settings-theme-rename-btn";
        renameBtn.title = t("settings.theme.rename");
        renameBtn.innerHTML = SVG_EDIT;
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          nameDialog = { open: true, mode: "rename-app", id: m.id, defaultName: m.name };
          themeName = m.name;
          render();
        });
        nameRow.append(nameEl, renameBtn);
        meta.append(nameRow);
        const slotLabel = renderThemeSlotLabel(themeId, preferredAppTheme);
        if (slotLabel) meta.append(slotLabel);

        card.append(preview, meta);
        grid.append(card);
      }

      const newCard = document.createElement("div");
      newCard.className = "settings-theme-card settings-theme-import-card";
      newCard.addEventListener("click", () => void handleCreateBlank(resolvedMode));

      const newPreview = document.createElement("div");
      newPreview.className = "settings-theme-preview settings-theme-import-preview";
      newPreview.innerHTML = SVG_PLUS;
      const newName = document.createElement("span");
      newName.className = "settings-theme-name";
      newName.textContent = t("settings.theme.newTheme");
      newCard.append(newPreview, newName);
      grid.append(newCard);

      root.append(grid);
    } else {
      const grid = document.createElement("div");
      grid.className = "settings-theme-grid";

      for (const ct of CODE_THEMES) {
        const colors = [
          ct.variables["--hljs-keyword"],
          ct.variables["--hljs-string"],
          ct.variables["--hljs-comment"],
          ct.variables["--hljs-number"],
          ct.variables["--hljs-built_in"],
        ];
        const preferred = codeTheme === ct.id;

        const card = document.createElement("div");
        card.className = `settings-theme-card${preferred ? " active" : ""}`;
        card.addEventListener("click", () =>
          themeManager.setPreferredCodeTheme(resolvedMode, ct.id),
        );

        const preview = document.createElement("div");
        preview.className = "settings-theme-preview code-theme-card-preview";
        preview.style.background = ct.isDark ? "#0d1117" : "#f6f8fa";

        const mock = document.createElement("div");
        mock.className = "code-theme-card-mock";
        mock.setAttribute("aria-hidden", "true");
        colors.forEach((c, i) => {
          const line = document.createElement("span");
          line.className = "code-theme-card-line";
          line.style.background = c;
          line.style.width = `${72 - i * 8}%`;
          mock.append(line);
        });
        preview.append(mock);
        if (preferred) appendCheckmark(preview);

        const actions = document.createElement("div");
        actions.className = "custom-theme-actions";
        const forkBtn = document.createElement("button");
        forkBtn.type = "button";
        forkBtn.className = "custom-theme-edit-btn";
        forkBtn.title = t("settings.theme.forkAndEdit");
        forkBtn.disabled = forkingCode;
        forkBtn.innerHTML = SVG_EDIT;
        forkBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleForkCodeTheme(ct.id, ct.name);
        });
        actions.append(forkBtn);
        preview.append(actions);

        const meta = document.createElement("div");
        meta.className = "settings-theme-meta";
        const nameEl = document.createElement("span");
        nameEl.className = "settings-theme-name";
        nameEl.textContent = ct.name;
        meta.append(nameEl);
        const slotLabel = renderThemeSlotLabel(ct.id, preferredCodeTheme);
        if (slotLabel) meta.append(slotLabel);

        card.append(preview, meta);
        grid.append(card);
      }

      if (customCodeThemes.length > 0) {
        const divider = document.createElement("div");
        divider.className = "settings-theme-divider";
        divider.setAttribute("role", "separator");
        divider.textContent = t("settings.theme.customThemes");
        grid.append(divider);
      }

      for (const m of customCodeThemes) {
        const colors = m.previewColors ?? [
          "#d73a49",
          "#032f62",
          "#6a737d",
          "#005cc5",
          "#e36209",
        ];
        const preferred = codeTheme === m.id;

        const card = document.createElement("div");
        card.className = `settings-theme-card custom-theme-card${preferred ? " active" : ""}`;
        card.addEventListener("click", () =>
          themeManager.setPreferredCodeTheme(resolvedMode, m.id),
        );

        const preview = document.createElement("div");
        preview.className = "settings-theme-preview code-theme-card-preview";
        preview.style.background = m.isDark ? "#0d1117" : "#f6f8fa";

        const mock = document.createElement("div");
        mock.className = "code-theme-card-mock";
        mock.setAttribute("aria-hidden", "true");
        colors.slice(0, 5).forEach((c, i) => {
          const line = document.createElement("span");
          line.className = "code-theme-card-line";
          line.style.background = c;
          line.style.width = `${72 - i * 8}%`;
          mock.append(line);
        });
        preview.append(mock);
        if (preferred) appendCheckmark(preview);

        const actions = document.createElement("div");
        actions.className = "custom-theme-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "custom-theme-edit-btn";
        editBtn.title = t("settings.theme.edit");
        editBtn.innerHTML = SVG_EDIT;
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleStartEditCodeTheme(m);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "custom-theme-delete-btn";
        delBtn.title = t("settings.theme.delete");
        delBtn.innerHTML = SVG_DELETE;
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteConfirm = { kind: "code", name: m.name, id: m.id };
          render();
        });

        actions.append(editBtn, delBtn);
        preview.append(actions);

        const meta = document.createElement("div");
        meta.className = "settings-theme-meta";
        const nameRow = document.createElement("div");
        nameRow.className = "settings-theme-name-row";
        const nameEl = document.createElement("span");
        nameEl.className = "settings-theme-name";
        nameEl.textContent = m.name;
        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "settings-theme-rename-btn";
        renameBtn.title = t("settings.theme.rename");
        renameBtn.innerHTML = SVG_EDIT;
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          nameDialog = { open: true, mode: "rename-code", id: m.id, defaultName: m.name };
          themeName = m.name;
          render();
        });
        nameRow.append(nameEl, renameBtn);
        meta.append(nameRow);
        const slotLabel = renderThemeSlotLabel(m.id, preferredCodeTheme);
        if (slotLabel) meta.append(slotLabel);

        card.append(preview, meta);
        grid.append(card);
      }

      root.append(grid);

      const codePreview = createCodePreviewBlock();
      codePreview.style.marginTop = "8px";
      root.append(codePreview);
    }

    const packBar = document.createElement("div");
    packBar.className = "theme-pack-bar theme-pack-bar-footer";

    const packActions = document.createElement("div");
    packActions.className = "theme-pack-actions";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "theme-pack-btn";
    exportBtn.disabled = exporting;
    exportBtn.innerHTML = `${SVG_EXPORT}<span>${exporting ? t("settings.theme.exporting") : t("settings.theme.exportThemePack")}</span>`;
    exportBtn.addEventListener("click", () => {
      if (customThemes.length === 0 && customCodeThemes.length === 0) {
        alert(t("settings.theme.packNoCustomThemes"));
        return;
      }
      packDialog = {
        mode: "export",
        packName: customThemes[0]?.name || "Inimark Theme",
        selectedApp: new Set(customThemes.map((m) => m.id)),
        selectedCode: new Set(customCodeThemes.map((m) => m.id)),
      };
      render();
    });

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "theme-pack-btn";
    importBtn.disabled = importing;
    importBtn.innerHTML = `${SVG_IMPORT}<span>${importing ? t("settings.theme.importing") : t("settings.theme.importThemePack")}</span>`;
    importBtn.addEventListener("click", () => void handleImportPack());

    packActions.append(exportBtn, importBtn);

    const packHint = document.createElement("p");
    packHint.className = "settings-hint theme-pack-hint";
    packHint.textContent = t("settings.theme.packHint");

    packBar.append(packActions, packHint);
    root.append(packBar);

    renderDialogs(root);
    return root;
  }

  async function handleImportPack(): Promise<void> {
    try {
      const picked = await pickAndReadThemePackFile();
      if (!picked) return;
      const pack = picked.pack;
      if (pack.themes.app.length === 0 && pack.themes.code.length === 0) {
        alert(t("settings.theme.packNoThemesInFile"));
        return;
      }
      packDialog = {
        mode: "import",
        pack,
        selectedApp: new Set(pack.themes.app.map((_, index) => index)),
        selectedCode: new Set(pack.themes.code.map((_, index) => index)),
      };
      render();
    } catch (err) {
      console.error("Import pack failed", err);
      alert(
        t("settings.theme.importFailed", {
          error: err instanceof Error ? err.message : t("settings.theme.unknownError"),
        }),
      );
    }
  }

  function render(): void {
    clearFieldCleanups();
    host.replaceChildren();
    if (editingCodeTheme) {
      host.append(renderCodeEditor());
      return;
    }
    if (editingTheme) {
      host.append(renderAppEditor());
      return;
    }
    host.append(renderMain());
  }

  const unsubscribe = themeManager.subscribe(() => {
    if (!editingTheme && !editingCodeTheme) {
      render();
    }
  });

  render();

  return () => {
    unsubscribe();
    if (previewTimer) clearTimeout(previewTimer);
    if (codePreviewTimer) clearTimeout(codePreviewTimer);
    clearFieldCleanups();
    host.replaceChildren();
  };
}
