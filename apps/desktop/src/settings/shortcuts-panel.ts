import { t } from "../i18n/index.ts";
import { createButton } from "../ui/widgets/index.ts";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutBinding,
} from "../shortcuts/defaults.ts";
import {
  formatShortcutDisplay,
  keysFromKeyboardEvent,
  loadShortcuts,
  saveShortcuts,
} from "../shortcuts/store.ts";

function shortcutGroupLabel(group: string): string {
  switch (group) {
    case "File":
      return t("settings.shortcuts.groupFile");
    case "View":
      return t("settings.shortcuts.groupView");
    case "App":
      return t("settings.shortcuts.groupApp");
    default:
      return group;
  }
}

function shortcutActionLabel(id: string, fallback: string): string {
  switch (id) {
    case "save":
      return t("settings.shortcuts.save");
    case "save-as":
      return t("settings.shortcuts.saveAs");
    case "new":
      return t("settings.shortcuts.newFile");
    case "open":
      return t("settings.shortcuts.openFile");
    case "open-folder":
      return t("settings.shortcuts.openFolder");
    case "close":
      return t("settings.shortcuts.close");
    case "toggle-sidebar":
      return t("settings.shortcuts.toggleSidebar");
    case "open-settings":
      return t("settings.shortcuts.openSettings");
    default:
      return fallback;
  }
}

export function renderShortcutsPanel(host: HTMLElement): () => void {
  let shortcuts = loadShortcuts();
  let editingId: string | null = null;
  let editingKeys: string[] = [];

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
  host.append(toolbar, list);

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

        const label = document.createElement("span");
        label.className = "inimark-settings-shortcut-label";
        label.textContent = shortcutActionLabel(item.id, item.label);

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
    host.replaceChildren();
  };
}
