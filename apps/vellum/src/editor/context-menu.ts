/**
 * Right-click menu for the plaintext editor.
 * Reuses the shared `createMenu` + `menuIcons` language used by the library tree
 * and titlebar overflow menu.
 */

import { createMenu, menuIcons } from "@dionysen/ui";
import { t } from "../i18n/index.ts";
import type { PlaintextEditor } from "./plaintext.ts";

export interface EditorContextMenuController {
  destroy(): void;
}

/** Attach Copy / Cut / Paste to right-click inside `host`. */
export function mountEditorContextMenu(
  host: HTMLElement,
  editor: PlaintextEditor,
): EditorContextMenuController {
  const menu = createMenu();
  menu.el.classList.add("inimark-context-menu");
  menu.setPath("");
  document.body.append(menu.el);

  // Keep the editor selection when pressing a menu row (otherwise the
  // contenteditable blurs and copy/cut lose the range).
  menu.el.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  const close = (): void => {
    menu.setOpen(false);
  };

  const positionAt = (x: number, y: number): void => {
    menu.el.style.position = "fixed";
    menu.el.style.left = `${x}px`;
    menu.el.style.top = `${y}px`;
  };

  const clampToViewport = (x: number, y: number): void => {
    const rect = menu.el.getBoundingClientRect();
    const gap = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - gap) {
      left = Math.max(gap, window.innerWidth - rect.width - gap);
    }
    if (top + rect.height > window.innerHeight - gap) {
      top = Math.max(gap, window.innerHeight - rect.height - gap);
    }
    menu.el.style.left = `${left}px`;
    menu.el.style.top = `${top}px`;
  };

  const render = (): void => {
    const hasSelection = editor.hasSelection();
    menu.clear();
    menu.setPath("");
    menu.addItem({
      label: t("editor.copy"),
      icon: menuIcons.copy,
      disabled: !hasSelection,
      onClick() {
        close();
        void editor.copySelection();
      },
    });
    menu.addItem({
      label: t("editor.cut"),
      icon: menuIcons.cut,
      disabled: !hasSelection,
      onClick() {
        close();
        void editor.cutSelection();
      },
    });
    menu.addItem({
      label: t("editor.paste"),
      icon: menuIcons.paste,
      onClick() {
        close();
        void editor.pasteClipboard();
      },
    });
  };

  const openAt = (x: number, y: number): void => {
    render();
    positionAt(x, y);
    menu.setOpen(true);
    requestAnimationFrame(() => clampToViewport(x, y));
  };

  const onMouseDownCapture = (event: MouseEvent): void => {
    if (event.button !== 2) return;
    if (!host.contains(event.target as Node)) return;
    // Capture-phase preventDefault stops WebKit from selecting the word under cursor.
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  };

  const onContextMenuCapture = (event: MouseEvent): void => {
    if (!host.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  };

  host.addEventListener("mousedown", onMouseDownCapture, true);
  host.addEventListener("contextmenu", onContextMenuCapture, true);

  return {
    destroy() {
      host.removeEventListener("mousedown", onMouseDownCapture, true);
      host.removeEventListener("contextmenu", onContextMenuCapture, true);
      menu.destroy();
    },
  };
}
