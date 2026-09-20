import { keysFromKeyboardEvent } from "@dionysen/shortcut-kit";
import { createButton } from "@dionysen/ui";
import { t } from "../i18n/index.ts";
import {
  DEFAULT_SHORTCUTS,
  formatShortcutDisplay,
  loadShortcuts,
  saveShortcuts,
  type ShortcutBinding,
} from "../shortcuts/store.ts";

function shortcutGroupLabel(group: string): string {
  switch (group) {
    case "File":
      return t("settings.shortcuts.groupFile");
    case "Library":
      return t("settings.shortcuts.groupLibrary");
    case "View":
      return t("settings.shortcuts.groupView");
    case "App":
      return t("settings.shortcuts.groupApp");
    default:
      return group;
  }
}

export function shortcutActionLabel(id: string, fallback: string): string {
  switch (id) {
    case "save":
      return t("settings.shortcuts.save");
    case "new-chapter":
      return t("settings.shortcuts.newChapter");
    case "close":
      return t("settings.shortcuts.close");
    case "quit":
      return t("settings.shortcuts.quit");
    case "toggle-sidebar":
      return t("settings.shortcuts.toggleSidebar");
    case "tree-rename":
      return t("settings.shortcuts.treeRename");
    case "tree-delete":
      return t("settings.shortcuts.treeDelete");
    case "tree-copy":
      return t("settings.shortcuts.treeCopy");
    case "tree-paste":
      return t("settings.shortcuts.treePaste");
    case "open-settings":
      return t("settings.shortcuts.openSettings");
    default:
      return fallback;
  }
}

export function shortcutActionHint(id: string): string {
  switch (id) {
    case "save":
      return t("settings.shortcuts.saveHint");
    case "new-chapter":
      return t("settings.shortcuts.newChapterHint");
    case "close":
      return t("settings.shortcuts.closeHint");
    case "quit":
      return t("settings.shortcuts.quitHint");
    case "toggle-sidebar":
      return t("settings.shortcuts.toggleSidebarHint");
    case "tree-rename":
      return t("settings.shortcuts.treeRenameHint");
    case "tree-delete":
      return t("settings.shortcuts.treeDeleteHint");
    case "tree-copy":
      return t("settings.shortcuts.treeCopyHint");
    case "tree-paste":
      return t("settings.shortcuts.treePasteHint");
    case "open-settings":
      return t("settings.shortcuts.openSettingsHint");
    default:
      return "";
  }
}

/** Search rows for every binding, so the settings search can jump here. */
export function shortcutSearchEntries(): {
  id: string;
  getTitle: () => string;
  getDescription: () => string;
}[] {
  return DEFAULT_SHORTCUTS.map((item) => ({
    id: `shortcut.${item.id}`,
    getTitle: () => shortcutActionLabel(item.id, item.label),
    getDescription: () => shortcutActionHint(item.id),
  }));
}

/**
 * Shortcut list with click-to-record. Escape clears the chord being captured;
 * Save writes it, Cancel leaves the previous binding.
 */
export function renderShortcutsPanel(host: HTMLElement): () => void {
  let shortcuts = loadShortcuts();
  let editingId: string | null = null;
  let editingKeys: string[] = [];

  const intro = document.createElement("p");
  intro.className = "inimark-settings-shortcuts-intro";

  const list = document.createElement("div");
  list.className = "inimark-settings-shortcuts";

  const toolbar = document.createElement("div");
  toolbar.className = "inimark-settings-shortcuts-toolbar";
  const resetAllBtn = createButton({
    label: t("settings.shortcuts.resetAll"),
    variant: "ghost",
    onClick: () => {
      shortcuts = DEFAULT_SHORTCUTS.map((item) => ({ ...item, keys: [...item.keys] }));
      editingId = null;
      saveShortcuts(shortcuts);
      render();
    },
  });
  toolbar.append(resetAllBtn);
  host.append(intro, toolbar, list);

  function groups(): Map<string, ShortcutBinding[]> {
    const map = new Map<string, ShortcutBinding[]>();
    for (const item of shortcuts) {
      const group = map.get(item.group) ?? [];
      group.push(item);
      map.set(item.group, group);
    }
    return map;
  }

  function render(): void {
    intro.textContent = t("settings.shortcuts.intro");
    resetAllBtn.textContent = t("settings.shortcuts.resetAll");
    list.replaceChildren();
    for (const [group, items] of groups()) {
      const heading = document.createElement("h3");
      heading.className = "inimark-settings-shortcuts-group";
      heading.textContent = shortcutGroupLabel(group);
      list.append(heading);

      for (const item of items) {
        const row = document.createElement("div");
        row.className = "inimark-settings-shortcut-item";
        row.dataset.settingId = `shortcut.${item.id}`;

        const label = document.createElement("span");
        label.className = "inimark-settings-shortcut-label";
        label.textContent = shortcutActionLabel(item.id, item.label);
        const hint = shortcutActionHint(item.id);
        if (hint) label.title = hint;

        const keysHost = document.createElement("div");
        keysHost.className = "inimark-settings-shortcut-keys";

        if (editingId === item.id) {
          const capture = document.createElement("button");
          capture.type = "button";
          capture.className = "inimark-settings-shortcut-capture is-recording";
          capture.textContent =
            editingKeys.length > 0
              ? formatShortcutDisplay(editingKeys)
              : t("settings.shortcuts.pressKeys");
          capture.addEventListener("keydown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const keys = keysFromKeyboardEvent(event);
            if (!keys) {
              editingKeys = [];
              capture.textContent = t("settings.shortcuts.pressKeys");
              return;
            }
            editingKeys = keys;
            capture.textContent = formatShortcutDisplay(editingKeys);
          });
          capture.addEventListener("click", (event) => event.stopPropagation());

          const saveBtn = createButton({
            label: t("common.save"),
            variant: "primary",
            onClick: () => {
              shortcuts = shortcuts.map((entry) =>
                entry.id === item.id ? { ...entry, keys: [...editingKeys] } : entry,
              );
              editingId = null;
              saveShortcuts(shortcuts);
              render();
            },
          });
          const cancelBtn = createButton({
            label: t("common.cancel"),
            variant: "ghost",
            onClick: () => {
              editingId = null;
              render();
            },
          });
          keysHost.append(capture, saveBtn, cancelBtn);
          queueMicrotask(() => capture.focus());
        } else {
          const display = document.createElement("button");
          display.type = "button";
          display.className = "inimark-settings-shortcut-display";
          display.textContent = formatShortcutDisplay(item.keys);
          display.title = t("settings.shortcuts.clickToEdit");
          display.addEventListener("click", () => {
            editingId = item.id;
            editingKeys = [...item.keys];
            render();
          });

          const resetBtn = createButton({
            label: t("common.reset"),
            variant: "ghost",
            onClick: () => {
              const def = DEFAULT_SHORTCUTS.find((entry) => entry.id === item.id);
              if (!def) return;
              shortcuts = shortcuts.map((entry) =>
                entry.id === item.id ? { ...entry, keys: [...def.keys] } : entry,
              );
              saveShortcuts(shortcuts);
              render();
            },
          });
          keysHost.append(display, resetBtn);
        }

        row.append(label, keysHost);
        list.append(row);
      }
    }
  }

  render();
  return () => {
    editingId = null;
  };
}
