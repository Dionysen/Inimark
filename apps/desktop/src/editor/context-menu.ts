import type { Editor, EditorCommandName } from "@inimark/editor";
import { detectPlatform } from "../platform/platform.ts";

export interface EditorContextMenuController {
  destroy(): void;
}

type IconAction = {
  name: EditorCommandName;
  label: string;
  shortcut?: string;
  icon: string;
};

type SubmenuEntry =
  | { kind: "item"; name: EditorCommandName; label: string; shortcut?: string; icon?: string }
  | { kind: "divider" };

type SubmenuRow = {
  name: string;
  label: string;
  icon: string;
  items: SubmenuEntry[];
};

function modKey(): string {
  return detectPlatform() === "macos" ? "⌘" : "Ctrl";
}

function svg(paths: string, size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  cut: svg(
    `<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>`,
  ),
  copy: svg(
    `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>`,
  ),
  paste: svg(
    `<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>`,
  ),
  trash: svg(
    `<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>`,
  ),
  bold: svg(
    `<path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>`,
  ),
  italic: svg(
    `<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>`,
  ),
  strikethrough: svg(
    `<path d="M16 4H9a3 3 0 00-2.83 4"/><path d="M14 12a4 4 0 010 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>`,
  ),
  code: svg(`<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`),
  link: svg(
    `<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>`,
  ),
  quote: svg(
    `<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>`,
  ),
  listUnordered: svg(
    `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>`,
  ),
  listOrdered: svg(
    `<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="2" y="14" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="2" y="20" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text>`,
  ),
  checkSquare: svg(
    `<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>`,
  ),
  highlight: svg(
    `<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>`,
  ),
  heading: svg(`<path d="M6 4v16M18 4v16M6 12h12"/>`),
  plus: svg(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`),
  chevronRight: svg(`<polyline points="9 18 15 12 9 6"/>`, 12),
  image: svg(
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`,
    16,
  ),
  minus: svg(`<line x1="5" y1="12" x2="19" y2="12"/>`, 16),
  table: svg(
    `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>`,
    16,
  ),
  codeBlock: svg(
    `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,
    16,
  ),
  math: svg(
    `<text x="3" y="17" font-size="14" fill="currentColor" stroke="none" font-family="serif" font-style="italic">x</text><line x1="14" y1="5" x2="20" y2="19"/><line x1="20" y1="5" x2="14" y2="19"/>`,
    16,
  ),
  wikiLink: svg(
    `<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>`,
    16,
  ),
};

function buildIconRows(): IconAction[][] {
  const m = modKey();
  return [
    [
      { name: "cut", label: "Cut", icon: ICONS.cut },
      { name: "copy", label: "Copy", icon: ICONS.copy },
      { name: "paste", label: "Paste", icon: ICONS.paste },
      { name: "delete", label: "Delete", icon: ICONS.trash },
    ],
    [
      { name: "bold", label: "Bold", shortcut: `${m}B`, icon: ICONS.bold },
      { name: "italic", label: "Italic", shortcut: `${m}I`, icon: ICONS.italic },
      { name: "strike", label: "Strikethrough", shortcut: "Alt+Shift+5", icon: ICONS.strikethrough },
      { name: "inline-code", label: "Inline Code", shortcut: `${m}Shift+\``, icon: ICONS.code },
      { name: "link", label: "Link", shortcut: `${m}K`, icon: ICONS.link },
    ],
    [
      { name: "quote", label: "Quote", shortcut: `${m}Shift+Q`, icon: ICONS.quote },
      { name: "list", label: "Bullet List", shortcut: `${m}Shift+8`, icon: ICONS.listUnordered },
      {
        name: "ordered-list",
        label: "Ordered List",
        shortcut: `${m}Shift+7`,
        icon: ICONS.listOrdered,
      },
      { name: "check", label: "Task List", shortcut: `${m}Shift+X`, icon: ICONS.checkSquare },
      { name: "highlight", label: "Highlight", icon: ICONS.highlight },
    ],
  ];
}

function buildSubmenus(): SubmenuRow[] {
  const m = modKey();
  return [
    {
      name: "heading",
      label: "Heading",
      icon: ICONS.heading,
      items: [
        { kind: "item", name: "heading-1", label: "Heading 1", shortcut: `${m}1` },
        { kind: "item", name: "heading-2", label: "Heading 2", shortcut: `${m}2` },
        { kind: "item", name: "heading-3", label: "Heading 3", shortcut: `${m}3` },
        { kind: "item", name: "heading-4", label: "Heading 4", shortcut: `${m}4` },
        { kind: "item", name: "heading-5", label: "Heading 5", shortcut: `${m}5` },
        { kind: "item", name: "heading-6", label: "Heading 6", shortcut: `${m}6` },
        { kind: "divider" },
        { kind: "item", name: "paragraph", label: "Paragraph", shortcut: `${m}0` },
      ],
    },
    {
      name: "insert",
      label: "Insert",
      icon: ICONS.plus,
      items: [
        { kind: "item", name: "upload", label: "Image", icon: ICONS.image },
        { kind: "item", name: "hr", label: "Horizontal Rule", icon: ICONS.minus },
        { kind: "item", name: "more", label: "More Tag", icon: ICONS.minus },
        { kind: "item", name: "table", label: "Table", icon: ICONS.table },
        { kind: "item", name: "code", label: "Code Block", shortcut: `${m}Shift+K`, icon: ICONS.codeBlock },
        { kind: "item", name: "math", label: "Math Block", shortcut: `${m}Shift+M`, icon: ICONS.math },
        { kind: "divider" },
        { kind: "item", name: "wiki-link", label: "Wiki Link", icon: ICONS.wikiLink },
      ],
    },
  ];
}

/**
 * Typora-style editor context menu (icon grid + Heading/Insert submenus).
 * Opens on right-click inside `host` when not in source mode.
 */
export function mountEditorContextMenu(
  host: HTMLElement,
  editor: Editor,
): EditorContextMenuController {
  const menu = document.createElement("div");
  menu.className = "inimark-editor-context-menu inimark-glass";
  menu.hidden = true;
  document.body.append(menu);

  const submenu = document.createElement("div");
  submenu.className = "inimark-editor-context-submenu inimark-glass";
  submenu.hidden = true;
  document.body.append(submenu);

  let open = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const iconRows = buildIconRows();
  const submenuRows = buildSubmenus();

  function clearCloseTimer(): void {
    if (closeTimer != null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function scheduleCloseSubmenu(): void {
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      submenu.hidden = true;
      closeTimer = null;
    }, 200);
  }

  function close(): void {
    clearCloseTimer();
    open = false;
    menu.hidden = true;
    submenu.hidden = true;
  }

  function runCommand(name: EditorCommandName): void {
    editor.executeCommand(name);
    close();
  }

  function clampMenu(el: HTMLElement, x: number, y: number): void {
    const GAP = 4;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - GAP) left = x - rect.width;
    if (top + rect.height > window.innerHeight - GAP) top = y - rect.height;
    if (left < GAP) left = GAP;
    if (top < GAP) top = GAP;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function showSubmenu(row: SubmenuRow, anchor: HTMLElement): void {
    clearCloseTimer();
    submenu.replaceChildren();

    for (const entry of row.items) {
      if (entry.kind === "divider") {
        const divider = document.createElement("div");
        divider.className = "inimark-editor-context-divider";
        submenu.append(divider);
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-editor-context-item";
      if (entry.icon) {
        const icon = document.createElement("span");
        icon.className = "inimark-editor-context-item-icon";
        icon.innerHTML = entry.icon;
        btn.append(icon);
      }
      const label = document.createElement("span");
      label.className = "inimark-editor-context-item-label";
      label.textContent = entry.label;
      btn.append(label);
      if (entry.shortcut) {
        const meta = document.createElement("span");
        meta.className = "inimark-editor-context-item-shortcut";
        meta.textContent = entry.shortcut;
        btn.append(meta);
      }
      btn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        runCommand(entry.name);
      });
      submenu.append(btn);
    }

    submenu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const GAP = 4;
    const width = Math.max(180, submenu.offsetWidth || 180);
    const height = Math.max(120, submenu.offsetHeight || 120);
    let x = rect.right + GAP;
    let y = rect.top;
    if (x + width > window.innerWidth - GAP) x = rect.left - width - GAP;
    if (y + height > window.innerHeight - GAP) y = window.innerHeight - height - GAP;
    if (y < GAP) y = GAP;
    submenu.style.left = `${x}px`;
    submenu.style.top = `${y}px`;
    requestAnimationFrame(() => clampMenu(submenu, x, y));
  }

  function renderMenu(): void {
    menu.replaceChildren();

    for (const row of iconRows) {
      const rowEl = document.createElement("div");
      rowEl.className = "inimark-editor-context-icon-row";
      for (const action of row) {
        const wrap = document.createElement("div");
        wrap.className = "inimark-editor-context-icon-wrap";
        wrap.dataset.tooltip = action.shortcut
          ? `${action.label} (${action.shortcut})`
          : action.label;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "inimark-editor-context-icon-btn";
        btn.setAttribute("aria-label", action.label);
        btn.innerHTML = action.icon;
        btn.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          runCommand(action.name);
        });
        wrap.append(btn);
        rowEl.append(wrap);
      }
      menu.append(rowEl);
    }

    const divider = document.createElement("div");
    divider.className = "inimark-editor-context-divider";
    menu.append(divider);

    for (const row of submenuRows) {
      const wrap = document.createElement("div");
      wrap.className = "inimark-editor-context-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-editor-context-item";
      const icon = document.createElement("span");
      icon.className = "inimark-editor-context-item-icon";
      icon.innerHTML = row.icon;
      const label = document.createElement("span");
      label.className = "inimark-editor-context-item-label";
      label.textContent = row.label;
      const arrow = document.createElement("span");
      arrow.className = "inimark-editor-context-item-arrow";
      arrow.innerHTML = ICONS.chevronRight;
      btn.append(icon, label, arrow);
      wrap.append(btn);

      wrap.addEventListener("mouseenter", () => showSubmenu(row, wrap));
      wrap.addEventListener("mouseleave", () => scheduleCloseSubmenu());
      menu.append(wrap);
    }
  }

  renderMenu();
  submenu.addEventListener("mouseenter", () => clearCloseTimer());
  submenu.addEventListener("mouseleave", () => scheduleCloseSubmenu());
  function openAt(x: number, y: number): void {
    if (editor.isSourceMode()) {
      close();
      return;
    }
    open = true;
    submenu.hidden = true;
    menu.hidden = false;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    requestAnimationFrame(() => clampMenu(menu, x, y));
  }

  function onMouseDownCapture(event: MouseEvent): void {
    if (event.button !== 2) return;
    if (!host.contains(event.target as Node)) return;
    // Capture-phase preventDefault stops WebKit from selecting the word under cursor.
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  }

  function onContextMenuCapture(event: MouseEvent): void {
    if (!host.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  }

  function onSelectStartCapture(event: Event): void {
    // Belt-and-suspenders for WKWebView when right-click still emits selectstart.
    if (!open) return;
    if (!host.contains(event.target as Node)) return;
    event.preventDefault();
  }

  function onDocumentMouseDown(event: MouseEvent): void {
    if (!open) return;
    // Ignore the right-click that opened the menu (same event bubbles to document).
    if (event.button === 2) return;
    const target = event.target as Node | null;
    if (target && (menu.contains(target) || submenu.contains(target))) return;
    close();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && open) close();
  }

  host.addEventListener("mousedown", onMouseDownCapture, true);
  host.addEventListener("contextmenu", onContextMenuCapture, true);
  host.addEventListener("selectstart", onSelectStartCapture, true);
  document.addEventListener("mousedown", onDocumentMouseDown);
  document.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      host.removeEventListener("mousedown", onMouseDownCapture, true);
      host.removeEventListener("contextmenu", onContextMenuCapture, true);
      host.removeEventListener("selectstart", onSelectStartCapture, true);
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      clearCloseTimer();
      menu.remove();
      submenu.remove();
    },
  };
}
