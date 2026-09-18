import { createIconButton } from "@dionysen/ui";
import type { AppearanceMode, ThemePair } from "./appearance.ts";
import { BUILTIN_THEMES } from "./builtin.ts";
import { createThemeColorField } from "./color-field.ts";
import { syncAccentDerived, syncLinkedChromeBackgrounds } from "./color-utils.ts";
import { themeT, tryGetThemeConfig } from "./config.ts";
import { builtinThemeLabel, themeLabel, themeTokenDesc } from "./labels.ts";
import { getThemeManager } from "./manager.ts";
import { createThemeSizeField } from "./size-field.ts";
import {
  pickAndReadThemePackFile,
  type ThemePack,
} from "./theme-pack.ts";
import {
  getCustomThemeCss,
  parseCssVariables,
  resolveThemePreviewColors,
  type ThemeManifest,
  type ThemeVariable,
} from "./theme-store.ts";
import {
  buildThemeEditorSections,
  getBuiltinColorMap,
  mergeWithSchema,
} from "./theme-tokens.ts";
import { createThemeToggleField } from "./toggle-field.ts";

function syncDerivedThemeVariables(variables: ThemeVariable[]): ThemeVariable[] {
  let next = syncAccentDerived(variables) as ThemeVariable[];
  if (tryGetThemeConfig()?.editorProfile === "chrome") {
    next = syncLinkedChromeBackgrounds(next) as ThemeVariable[];
  }
  return next;
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

type PackDialogState =
  | null
  | {
      mode: "export";
      packName: string;
      selectedApp: Set<string>;
    }
  | {
      mode: "import";
      pack: ThemePack;
      selectedApp: Set<number>;
    };

type NameDialogState = {
  open: boolean;
  id: string;
  defaultName: string;
};

type FieldDestroyable = HTMLElement & { destroy?: () => void };

function attachOverlayDismiss(overlay: HTMLElement, onDismiss: () => void): void {
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) onDismiss();
  });
}

/**
 * Chrome-only theme settings panel: appearance mode, app theme cards,
 * custom theme editor, and app-only pack import/export.
 */
export function renderChromeThemePanel(host: HTMLElement): () => void {
  const themeManager = getThemeManager();

  let importing = false;
  let exporting = false;
  let forking = false;
  let editingTheme: ThemeManifest | null = null;
  let editVariables: ThemeVariable[] = [];
  let deleteConfirm: { id: string; name: string } | null = null;
  let packDialog: PackDialogState = null;
  let nameDialog: NameDialogState = { open: false, id: "", defaultName: "" };
  let themeName = "";
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
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

  function resolveAppDisplayName(id: string, customThemes: ThemeManifest[]): string {
    if ((BUILTIN_THEMES as readonly string[]).includes(id)) return builtinThemeLabel(id);
    if (id.startsWith("custom-")) {
      const mid = id.replace("custom-", "");
      return customThemes.find((m) => m.id === mid)?.name || id;
    }
    return id;
  }

  function renderThemeSlotLabel(id: string, pair: ThemePair): HTMLElement | null {
    const slot = getThemeSlotSelection(id, pair);
    if (slot === "none") return null;
    const labels: Record<string, string> = {
      both: themeT("settings.theme.slotBoth"),
      light: themeT("settings.theme.light"),
      dark: themeT("settings.theme.dark"),
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
    for (const { w, color, opacity } of [
      { w: "60%", color: colors[1], opacity: 1 },
      { w: "80%", color: colors[2], opacity: 0.3 },
      { w: "45%", color: colors[2], opacity: 0.3 },
    ]) {
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

  async function openEditor(manifest: ThemeManifest, variables: ThemeVariable[]): Promise<void> {
    const merged = syncDerivedThemeVariables(
      mergeWithSchema(variables, getBuiltinColorMap("light") ?? undefined),
    );
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
      const name = themeT("settings.theme.forkName", { name: label });
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
        themeT("settings.theme.newTheme"),
      );
      await handleStartEdit(manifest);
    } catch (err) {
      console.error("Create theme failed", err);
    } finally {
      forking = false;
      render();
    }
  }

  async function handleSaveAppEdit(manifest: ThemeManifest): Promise<void> {
    const synced = syncDerivedThemeVariables(editVariables);
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
    title.textContent = themeT("settings.theme.editTheme", { name: manifest.name });
    const actions = document.createElement("div");
    actions.className = "theme-editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = themeT("settings.theme.save");
    saveBtn.addEventListener("click", () => void handleSaveAppEdit(manifest));
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button theme-editor-cancel";
    cancelBtn.textContent = themeT("settings.theme.cancel");
    cancelBtn.addEventListener("click", () => void handleCancelAppEdit(manifest));
    actions.append(saveBtn, cancelBtn);
    header.append(title, actions);
    sticky.append(header);

    const variablesHost = document.createElement("div");
    variablesHost.className = "theme-editor-variables inimark-scrollbar";

    function handleVariableChange(name: string, newValue: string): void {
      let next = editVariables.map((v) => (v.name === name ? { ...v, value: newValue } : v));
      if (
        name === "--accent" ||
        name === "--bg-secondary" ||
        name === "--bg-primary"
      ) {
        next = syncDerivedThemeVariables(next);
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
      ? themeT("settings.theme.packDeselectAll")
      : themeT("settings.theme.packSelectAll");
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

  async function handleConfirmPackDialog(): Promise<void> {
    if (!packDialog) return;
    try {
      if (packDialog.mode === "export") {
        if (packDialog.selectedApp.size === 0) return;
        exporting = true;
        render();
        await themeManager.exportSelectedThemePack(
          packDialog.packName.trim() || "Theme Pack",
          [...packDialog.selectedApp],
        );
      } else {
        if (packDialog.selectedApp.size === 0) return;
        importing = true;
        render();
        await themeManager.importSelectedThemePack(packDialog.pack, [...packDialog.selectedApp]);
      }
      packDialog = null;
    } catch (err) {
      console.error("Theme pack operation failed", err);
      alert(
        themeT("settings.theme.operationFailed", {
          error: err instanceof Error ? err.message : themeT("settings.theme.unknownError"),
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
      await themeManager.renameAppTheme(nameDialog.id, name);
      nameDialog = { open: false, id: "", defaultName: "" };
    } catch (err) {
      console.error("Rename failed", err);
    } finally {
      render();
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteConfirm) return;
    await themeManager.deleteTheme(deleteConfirm.id);
    deleteConfirm = null;
    render();
  }

  function renderDialogs(container: HTMLElement): void {
    if (packDialog) {
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
          ? themeT("settings.theme.exportSelectThemes")
          : themeT("settings.theme.importSelectThemes");
      dialog.append(title);

      if (packDialog.mode === "export") {
        const nameLabel = document.createElement("label");
        nameLabel.className = "theme-pack-name-field";
        const nameText = document.createElement("span");
        nameText.textContent = themeT("settings.theme.packName");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "theme-name-dialog-input";
        nameInput.value = packDialog.packName;
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
          themeT("settings.theme.packAppThemes"),
          snap.customThemes.map((m) => ({ key: m.id, name: m.name })),
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
        if (appGroup) body.append(appGroup);
      } else {
        const appGroup = renderPackThemeGroup(
          themeT("settings.theme.packAppThemes"),
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
        if (appGroup) body.append(appGroup);
      }
      dialog.append(body);

      const actions = document.createElement("div");
      actions.className = "theme-name-dialog-actions";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "settings-button theme-name-dialog-cancel";
      cancelBtn.textContent = themeT("settings.theme.cancel");
      cancelBtn.addEventListener("click", () => {
        packDialog = null;
        render();
      });
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "settings-button";
      const selectedCount = packDialog.selectedApp.size;
      confirmBtn.disabled = exporting || importing || selectedCount === 0;
      confirmBtn.textContent =
        packDialog.mode === "export"
          ? exporting
            ? themeT("settings.theme.exporting")
            : themeT("settings.theme.exportPack")
          : importing
            ? themeT("settings.theme.importing")
            : themeT("settings.theme.importPack");
      confirmBtn.addEventListener("click", () => void handleConfirmPackDialog());
      actions.append(cancelBtn, confirmBtn);
      dialog.append(actions);
      overlay.append(dialog);
      container.append(overlay);
    }

    if (nameDialog.open) {
      const overlay = document.createElement("div");
      overlay.className = "theme-name-dialog-overlay";
      attachOverlayDismiss(overlay, () => {
        nameDialog = { open: false, id: "", defaultName: "" };
        render();
      });
      const dialog = document.createElement("div");
      dialog.className = "theme-name-dialog";
      const title = document.createElement("h3");
      title.className = "theme-name-dialog-title";
      title.textContent = themeT("settings.theme.renameTheme");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "theme-name-dialog-input";
      input.value = themeName;
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
      cancelBtn.textContent = themeT("settings.theme.cancel");
      cancelBtn.addEventListener("click", () => {
        nameDialog = { open: false, id: "", defaultName: "" };
        render();
      });
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "settings-button";
      confirmBtn.textContent = themeT("settings.theme.confirm");
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
      title.textContent = themeT("settings.theme.deleteTheme");
      const msg = document.createElement("p");
      msg.style.cssText = "font-size: 14px; color: var(--text-secondary); margin: 0 0 16px";
      msg.textContent = themeT("settings.theme.deleteMessage", { name: deleteConfirm.name });
      const actions = document.createElement("div");
      actions.className = "theme-name-dialog-actions";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "settings-button theme-name-dialog-cancel";
      cancelBtn.textContent = themeT("settings.theme.cancel");
      cancelBtn.addEventListener("click", () => {
        deleteConfirm = null;
        render();
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "settings-button warning";
      deleteBtn.textContent = themeT("settings.theme.delete");
      deleteBtn.addEventListener("click", () => void handleConfirmDelete());
      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, msg, actions);
      overlay.append(dialog);
      container.append(overlay);
    }
  }

  function renderMain(): HTMLElement {
    const snap = themeManager.getSnapshot();
    const { appearanceMode, resolvedMode, theme, preferredAppTheme, customThemes } = snap;

    const root = document.createElement("div");
    root.className = "settings-section";

    const modeBlock = document.createElement("div");
    modeBlock.dataset.settingId = "theme.appearanceMode";
    const modeTitle = document.createElement("h3");
    modeTitle.className = "settings-section-title";
    modeTitle.textContent = themeT("settings.theme.appearanceMode");
    const modeHint = document.createElement("p");
    modeHint.className = "settings-hint";
    modeHint.textContent = themeT("settings.theme.appearanceModeDesc");
    const modeToggle = document.createElement("div");
    modeToggle.className = "appearance-mode-toggle";
    modeToggle.setAttribute("role", "radiogroup");

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
      btn.textContent = themeT(labelKey);
      btn.addEventListener("click", () => themeManager.setAppearanceMode(mode as AppearanceMode));
      modeToggle.append(btn);
    }

    const modeStatus = document.createElement("p");
    modeStatus.className = "settings-hint appearance-mode-status";
    const resolvedLabel =
      resolvedMode === "dark" ? themeT("settings.theme.dark") : themeT("settings.theme.light");
    modeStatus.textContent = themeT("settings.theme.currentlyChrome", {
      mode: resolvedLabel,
      app: resolveAppDisplayName(theme, customThemes),
    });
    modeBlock.append(modeTitle, modeHint, modeToggle, modeStatus);

    const slotHint = document.createElement("p");
    slotHint.className = "settings-hint";
    slotHint.style.cssText = "margin-top: 8px; margin-bottom: 12px";
    slotHint.textContent = themeT("settings.theme.slotHint", { mode: resolvedLabel });

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
      forkBtn.title = themeT("settings.theme.forkAndEdit");
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
    divider.textContent = themeT("settings.theme.customThemes");
    grid.append(divider);

    for (const manifest of customThemes) {
      const themeId = `custom-${manifest.id}`;
      const preferred = theme === themeId;
      const [c0, c1, c2, c3] = resolveThemePreviewColors(manifest);

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
      editBtn.title = themeT("settings.theme.edit");
      editBtn.innerHTML = SVG_EDIT;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void handleStartEdit(manifest);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "custom-theme-delete-btn";
      delBtn.title = themeT("settings.theme.delete");
      delBtn.innerHTML = SVG_DELETE;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteConfirm = { id: manifest.id, name: manifest.name };
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
      nameEl.textContent = manifest.name;
      const renameBtn = createIconButton({
        label: themeT("settings.theme.rename"),
        title: themeT("settings.theme.rename"),
        html: SVG_EDIT,
        onClick(e) {
          e.stopPropagation();
          themeName = manifest.name;
          nameDialog = { open: true, id: manifest.id, defaultName: manifest.name };
          render();
        },
      });
      renameBtn.classList.add("settings-theme-rename-btn");
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
    newName.textContent = themeT("settings.theme.newTheme");
    newCard.append(newPreview, newName);
    grid.append(newCard);

    const packBar = document.createElement("div");
    packBar.className = "theme-pack-bar theme-pack-bar-footer";

    const packActions = document.createElement("div");
    packActions.className = "theme-pack-actions";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "theme-pack-btn";
    exportBtn.disabled = exporting;
    exportBtn.innerHTML = `${SVG_EXPORT}<span>${exporting ? themeT("settings.theme.exporting") : themeT("settings.theme.exportThemePack")}</span>`;
    exportBtn.addEventListener("click", () => {
      if (customThemes.length === 0) {
        alert(themeT("settings.theme.packNoCustomThemes"));
        return;
      }
      packDialog = {
        mode: "export",
        packName: customThemes[0]?.name || "Theme Pack",
        selectedApp: new Set(customThemes.map((m) => m.id)),
      };
      render();
    });

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "theme-pack-btn";
    importBtn.disabled = importing;
    importBtn.innerHTML = `${SVG_IMPORT}<span>${importing ? themeT("settings.theme.importing") : themeT("settings.theme.importThemePack")}</span>`;
    importBtn.addEventListener("click", () => void handleImportPack());

    packActions.append(exportBtn, importBtn);

    const packHint = document.createElement("p");
    packHint.className = "settings-hint theme-pack-hint";
    packHint.textContent = themeT("settings.theme.packHint");

    packBar.append(packActions, packHint);

    root.append(modeBlock, slotHint, grid, packBar);
    return root;
  }

  async function handleImportPack(): Promise<void> {
    try {
      const picked = await pickAndReadThemePackFile();
      if (!picked) return;
      const pack = picked.pack;
      if (pack.themes.app.length === 0) {
        alert(themeT("settings.theme.packNoThemesInFile"));
        return;
      }
      packDialog = {
        mode: "import",
        pack,
        selectedApp: new Set(pack.themes.app.map((_, index) => index)),
      };
      render();
    } catch (err) {
      console.error("Import pack failed", err);
      alert(
        themeT("settings.theme.importFailed", {
          error: err instanceof Error ? err.message : themeT("settings.theme.unknownError"),
        }),
      );
    }
  }

  function render(): void {
    clearFieldCleanups();
    host.replaceChildren();
    if (editingTheme) {
      host.append(renderAppEditor());
    } else {
      host.append(renderMain());
    }
    renderDialogs(host);
  }

  const unsubscribe = themeManager.subscribe(() => render());
  render();

  return () => {
    unsubscribe();
    clearFieldCleanups();
    if (previewTimer) clearTimeout(previewTimer);
    host.replaceChildren();
  };
}
