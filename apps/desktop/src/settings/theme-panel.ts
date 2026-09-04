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
import { BUILTIN_THEME_LABELS, themeLabel } from "../themes/labels.ts";
import {
  getCustomThemeCss,
  getCodeThemeCss,
  parseCssVariables,
  resolveThemePreviewColors,
  type ThemeManifest,
  type ThemeVariable,
} from "../themes/custom-theme-manager.ts";

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

const BUILTIN_PREVIEW_COLORS: Record<string, string[]> = {
  white: ["#ffffff", "#2563eb", "#1e293b", "#d1d9e6"],
  mint: ["#ffffff", "#4eb289", "#1e293b", "#a5cfc0"],
  "mint-dark": ["#272729", "#4eb289", "#cccccc", "#39393a"],
  "modern-dark": ["#1b1d24", "#74a7fe", "#cccccc", "#111217"],
  "claude-code": ["#faf8f5", "#c47a2a", "#1a1a1a", "#ddd6cc"],
  purple: ["#faf5ff", "#7c3aed", "#1e1b2e", "#ddd6ee"],
  hermes: ["#f0f1ff", "#0000f2", "#1a1a4e", "rgba(0,0,242,0.12)"],
  next: ["#fffef8", "#00796b", "#4a4a4a", "#e0ddd6"],
  slate: ["#f8fafc", "#475569", "#0f172a", "#e2e8f0"],
  ocean: ["#f0f9ff", "#0891b2", "#0c4a6e", "#a5f3fc"],
};

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

interface EditPreview {
  bg: string;
  accent: string;
  text: string;
  strong: string;
  border: string;
  codeBg: string;
  codeText: string;
  radiusInline: string;
  paddingInlineY: string;
  paddingInlineX: string;
}

type DeleteConfirm =
  | { kind: "app"; name: string; id: string }
  | { kind: "code"; name: string; id: string };

type NameDialogState = {
  open: boolean;
  mode: "export-pack" | "rename-app" | "rename-code";
  id: string;
  defaultName: string;
};

type FieldDestroyable = HTMLElement & { destroy?: () => void; updateValue?: (v: string) => void };

function computeEditPreview(vars: ThemeVariable[]): EditPreview {
  const get = (name: string, fallback: string) =>
    vars.find((v) => v.name === name)?.value || fallback;
  return {
    bg: get("--bg-primary", "#ffffff"),
    accent: get("--accent", "#4eb289"),
    text: get("--text-primary", "#1e293b"),
    strong: get("--text-strong", "#bd387d"),
    border: get("--border", "#a5cfc0"),
    codeBg: get("--bg-code-inline", "rgba(78, 178, 137, 0.08)"),
    codeText: get("--text-code", "#e83e8c"),
    radiusInline: get("--radius-code-inline", "4px"),
    paddingInlineY: get("--padding-code-inline-y", "3px"),
    paddingInlineX: get("--padding-code-inline-x", "6px"),
  };
}

export function renderThemePanel(host: HTMLElement): () => void {
  const themeManager = getThemeManager();

  let themeKindTab: "app" | "code" = "app";
  let importing = false;
  let exporting = false;
  let forking = false;
  let forkingCode = false;
  let codeSampleLang = CODE_THEME_SAMPLE_SNIPPETS[0].id;

  let editingTheme: ThemeManifest | null = null;
  let editVariables: ThemeVariable[] = [];
  let editPreview: EditPreview = computeEditPreview([]);

  let editingCodeTheme: CustomCodeTheme | null = null;
  let editCodeVariables: ThemeVariable[] = [];

  let deleteConfirm: DeleteConfirm | null = null;
  let nameDialog: NameDialogState = {
    open: false,
    mode: "export-pack",
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
    const builtin = BUILTIN_THEME_LABELS[id];
    if (builtin) return builtin;
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
      both: "Light & Dark",
      light: "Light",
      dark: "Dark",
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
    title.textContent = "Preview";

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
      mergeWithSchema(variables, getBuiltinColorMap("mint") ?? undefined),
    ) as ThemeVariable[];
    editVariables = merged;
    editPreview = computeEditPreview(merged);
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
      const name = `${label} (fork)`;
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
      const manifest = await themeManager.createThemeFromTemplate(kind, "New theme");
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
      const name = `${label} (fork)`;
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

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "theme-editor-back";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => void handleCancelAppEdit(manifest));

    const title = document.createElement("h3");
    title.className = "settings-section-title";
    title.textContent = `Edit theme: ${manifest.name}`;

    const actions = document.createElement("div");
    actions.className = "theme-editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => void handleSaveAppEdit(manifest));
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-editor-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => void handleCancelAppEdit(manifest));
    actions.append(saveBtn, cancelBtn);
    header.append(backBtn, title, actions);

    const preview = document.createElement("div");
    preview.className = "theme-editor-preview theme-editor-preview-rich";
    preview.style.background = editPreview.bg;
    preview.style.borderColor = editPreview.accent;

    const previewSidebar = document.createElement("div");
    previewSidebar.className = "theme-editor-preview-sidebar";
    previewSidebar.style.background =
      editVariables.find((v) => v.name === "--bg-secondary")?.value ?? "";

    const line1 = document.createElement("div");
    line1.className = "theme-editor-preview-line";
    line1.style.background = editPreview.accent;
    line1.style.width = "70%";
    const line2 = document.createElement("div");
    line2.className = "theme-editor-preview-line";
    line2.style.background = editPreview.text;
    line2.style.opacity = "0.35";
    line2.style.width = "55%";
    previewSidebar.append(line1, line2);

    const previewEditor = document.createElement("div");
    previewEditor.className = "theme-editor-preview-editor";

    const text1 = document.createElement("div");
    text1.className = "theme-editor-preview-text";
    text1.style.color = editPreview.text;
    text1.textContent = "Preview body text with normal styling.";

    const text2 = document.createElement("div");
    text2.className = "theme-editor-preview-text";
    text2.style.color = editPreview.strong;
    text2.style.fontWeight = "700";
    text2.append("Strong emphasis ");
    const inlineCode = document.createElement("code");
    inlineCode.className = "theme-editor-preview-inline-code";
    inlineCode.style.background = editPreview.codeBg;
    inlineCode.style.color = editPreview.codeText;
    inlineCode.style.borderColor = editPreview.border;
    inlineCode.style.borderRadius = editPreview.radiusInline;
    inlineCode.style.padding = `${editPreview.paddingInlineY} ${editPreview.paddingInlineX}`;
    inlineCode.textContent = "inline_code";
    text2.append(inlineCode);

    const accentBar = document.createElement("div");
    accentBar.className = "theme-editor-preview-accent";
    accentBar.style.background = editPreview.accent;
    accentBar.textContent = "Accent";

    previewEditor.append(text1, text2, accentBar);
    preview.append(previewSidebar, previewEditor);
    sticky.append(header, preview);

    const variablesHost = document.createElement("div");
    variablesHost.className = "theme-editor-variables";

    function handleVariableChange(name: string, newValue: string): void {
      let next = editVariables.map((v) => (v.name === name ? { ...v, value: newValue } : v));
      if (name === "--accent") {
        next = syncAccentRgb(next) as ThemeVariable[];
      }
      editVariables = next;
      editPreview = computeEditPreview(next);
      preview.style.background = editPreview.bg;
      preview.style.borderColor = editPreview.accent;
      previewSidebar.style.background =
        next.find((v) => v.name === "--bg-secondary")?.value ?? "";
      line1.style.background = editPreview.accent;
      line2.style.background = editPreview.text;
      text1.style.color = editPreview.text;
      text2.style.color = editPreview.strong;
      inlineCode.style.background = editPreview.codeBg;
      inlineCode.style.color = editPreview.codeText;
      inlineCode.style.borderColor = editPreview.border;
      inlineCode.style.borderRadius = editPreview.radiusInline;
      inlineCode.style.padding = `${editPreview.paddingInlineY} ${editPreview.paddingInlineX}`;
      accentBar.style.background = editPreview.accent;
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
            varName: field.variable.name,
            value: field.variable.value,
            onChange: (val) => handleVariableChange(field.variable.name, val),
          }) as FieldDestroyable;
          if (row.destroy) fieldCleanups.push(row.destroy);
          group.append(row);
        } else {
          group.append(
            createThemeSizeField({
              label: themeLabel(field.meta.labelKey),
              varName: field.variable.name,
              value: field.variable.value,
              meta: field.meta,
              onChange: (val) => handleVariableChange(field.variable.name, val),
            }),
          );
        }
      }
      variablesHost.append(group);
    }

    root.append(sticky, variablesHost);
    return root;
  }

  async function handleSaveCodeEdit(manifest: CustomCodeTheme): Promise<void> {
    await themeManager.updateCodeThemeVariables(manifest.id, editCodeVariables);
    editingCodeTheme = null;
    render();
  }

  async function handleCancelCodeEdit(manifest: CustomCodeTheme): Promise<void> {
    try {
      const css = await getCodeThemeCss(manifest.id);
      themeManager.previewCodeThemeVariables(manifest.id, parseCssVariables(css));
    } catch {
      /* ignore */
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

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "theme-editor-back";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => void handleCancelCodeEdit(manifest));

    const title = document.createElement("h3");
    title.className = "settings-section-title";
    title.textContent = `Edit code theme: ${manifest.name}`;

    const actions = document.createElement("div");
    actions.className = "theme-editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => void handleSaveCodeEdit(manifest));
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-editor-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => void handleCancelCodeEdit(manifest));
    actions.append(saveBtn, cancelBtn);
    header.append(backBtn, title, actions);

    const previewWrap = createCodePreviewBlock(previewStyle, () => {
      /* re-render handled in tab click */
    });
    previewWrap.classList.add("code-theme-editor-preview");

    sticky.append(header, previewWrap);

    const variablesHost = document.createElement("div");
    variablesHost.className = "theme-editor-variables";
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
        varName: token.name,
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

  function renderDialogs(container: HTMLElement): void {
    if (nameDialog.open) {
      const overlay = document.createElement("div");
      overlay.className = "theme-name-dialog-overlay";
      overlay.addEventListener("click", () => {
        nameDialog = { open: false, mode: "export-pack", id: "", defaultName: "" };
        render();
      });

      const dialog = document.createElement("div");
      dialog.className = "theme-name-dialog";
      dialog.addEventListener("click", (e) => e.stopPropagation());

      const title = document.createElement("h3");
      title.className = "theme-name-dialog-title";
      title.textContent =
        nameDialog.mode === "export-pack" ? "Name theme pack" : "Rename theme";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "theme-name-dialog-input";
      input.value = themeName;
      input.placeholder =
        nameDialog.mode === "export-pack"
          ? "Pack name"
          : "Theme name";
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
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        nameDialog = { open: false, mode: "export-pack", id: "", defaultName: "" };
        render();
      });

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "settings-button";
      confirmBtn.disabled = exporting;
      confirmBtn.textContent =
        exporting
          ? "Exporting…"
          : nameDialog.mode === "export-pack"
            ? "Export pack"
            : "Confirm";
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
      overlay.addEventListener("click", () => {
        deleteConfirm = null;
        render();
      });

      const dialog = document.createElement("div");
      dialog.className = "theme-name-dialog";
      dialog.addEventListener("click", (e) => e.stopPropagation());

      const title = document.createElement("h3");
      title.className = "theme-name-dialog-title";
      title.textContent =
        deleteConfirm.kind === "code" ? "Delete code theme?" : "Delete theme?";

      const msg = document.createElement("p");
      msg.style.cssText = "font-size: 14px; color: var(--text-secondary); margin: 0 0 16px";
      msg.textContent =
        deleteConfirm.kind === "code"
          ? `Delete "${deleteConfirm.name}"? This cannot be undone.`
          : `Delete "${deleteConfirm.name}"? This cannot be undone.`;

      const actions = document.createElement("div");
      actions.className = "theme-name-dialog-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "settings-button theme-name-dialog-cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        deleteConfirm = null;
        render();
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "settings-button warning";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => void handleConfirmDelete());

      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, msg, actions);
      overlay.append(dialog);
      container.append(overlay);
    }
  }

  async function handleConfirmNameDialog(): Promise<void> {
    const name = themeName.trim() || nameDialog.defaultName;
    try {
      if (nameDialog.mode === "export-pack") {
        exporting = true;
        render();
        await themeManager.exportCurrentThemePack(name);
        nameDialog = { open: false, mode: "export-pack", id: "", defaultName: "" };
      } else if (nameDialog.mode === "rename-app") {
        await themeManager.renameAppTheme(nameDialog.id, name);
        nameDialog = { open: false, mode: "export-pack", id: "", defaultName: "" };
      } else if (nameDialog.mode === "rename-code") {
        await themeManager.renameCodeTheme(nameDialog.id, name);
        nameDialog = { open: false, mode: "export-pack", id: "", defaultName: "" };
      }
    } catch (err) {
      console.error("Rename/export failed", err);
      alert(`Operation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      exporting = false;
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

    const modeTitle = document.createElement("h3");
    modeTitle.className = "settings-section-title";
    modeTitle.textContent = "Appearance mode";

    const modeHint = document.createElement("p");
    modeHint.className = "settings-hint";
    modeHint.style.cssText = "margin-top: -8px; margin-bottom: 12px";
    modeHint.textContent =
      "Choose whether the app follows your system, or stays in light or dark mode.";

    const modeToggle = document.createElement("div");
    modeToggle.className = "appearance-mode-toggle";
    modeToggle.setAttribute("role", "radiogroup");
    modeToggle.setAttribute("aria-label", "Appearance mode");

    for (const [mode, label] of [
      ["system", "System"],
      ["light", "Light"],
      ["dark", "Dark"],
    ] as const) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(appearanceMode === mode));
      btn.className = `appearance-mode-btn${appearanceMode === mode ? " active" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", () => themeManager.setAppearanceMode(mode));
      modeToggle.append(btn);
    }

    const modeStatus = document.createElement("p");
    modeStatus.className = "settings-hint appearance-mode-status";
    const resolvedLabel = resolvedMode === "dark" ? "Dark" : "Light";
    modeStatus.textContent = `Currently ${resolvedLabel} — App: ${resolveAppDisplayName(theme, customThemes)}, Code: ${resolveCodeDisplayName(codeTheme, customCodeThemes)}`;

    const kindTabs = document.createElement("div");
    kindTabs.className = "theme-kind-tabs";
    kindTabs.setAttribute("role", "tablist");
    kindTabs.setAttribute("aria-label", "Theme kind");

    for (const [tab, label] of [
      ["app", "App theme"],
      ["code", "Code theme"],
    ] as const) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(themeKindTab === tab));
      btn.className = `theme-kind-tab${themeKindTab === tab ? " active" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", () => {
        themeKindTab = tab;
        render();
      });
      kindTabs.append(btn);
    }

    const slotHint = document.createElement("p");
    slotHint.className = "settings-hint";
    slotHint.style.cssText = "margin-top: 8px; margin-bottom: 12px";
    slotHint.textContent = `Themes you pick apply to the ${resolvedLabel.toLowerCase()} appearance slot.`;

    root.append(modeTitle, modeHint, modeToggle, modeStatus, kindTabs, slotHint);

    if (themeKindTab === "app") {
      const grid = document.createElement("div");
      grid.className = "settings-theme-grid";

      for (const value of BUILTIN_THEMES) {
        const colors = BUILTIN_PREVIEW_COLORS[value] ?? ["#ffffff", "#4eb289", "#1e293b", "#e2e8f0"];
        const label = BUILTIN_THEME_LABELS[value] ?? value;
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
        forkBtn.title = "Fork and edit";
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
      divider.textContent = "Custom themes";
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
        editBtn.title = "Edit";
        editBtn.innerHTML = SVG_EDIT;
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleStartEdit(m);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "custom-theme-delete-btn";
        delBtn.title = "Delete";
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
        renameBtn.title = "Rename";
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
      newName.textContent = "New theme";
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
        forkBtn.title = "Fork and edit";
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
        divider.textContent = "Custom themes";
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
        editBtn.title = "Edit";
        editBtn.innerHTML = SVG_EDIT;
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void handleStartEditCodeTheme(m);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "custom-theme-delete-btn";
        delBtn.title = "Delete";
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
        renameBtn.title = "Rename";
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
    exportBtn.innerHTML = `${SVG_EXPORT}<span>${exporting ? "Exporting…" : "Export theme pack"}</span>`;
    exportBtn.addEventListener("click", () => {
      const lightName =
        customThemes.find((m) => `custom-${m.id}` === preferredAppTheme.light)?.name
        || preferredAppTheme.light;
      nameDialog = { open: true, mode: "export-pack", id: "", defaultName: lightName };
      themeName = lightName;
      render();
    });

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "theme-pack-btn";
    importBtn.disabled = importing;
    importBtn.innerHTML = `${SVG_IMPORT}<span>${importing ? "Importing…" : "Import theme pack"}</span>`;
    importBtn.addEventListener("click", () => void handleImportPack());

    packActions.append(exportBtn, importBtn);

    const packHint = document.createElement("p");
    packHint.className = "settings-hint theme-pack-hint";
    packHint.textContent =
      "Export or import a .inimark-theme pack with app and code themes for light and dark slots.";

    packBar.append(packActions, packHint);
    root.append(packBar);

    renderDialogs(root);
    return root;
  }

  async function handleImportPack(): Promise<void> {
    try {
      importing = true;
      render();
      const result = await themeManager.importThemePack();
      if (!result) return;
    } catch (err) {
      console.error("Import pack failed", err);
      alert(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      importing = false;
      render();
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
