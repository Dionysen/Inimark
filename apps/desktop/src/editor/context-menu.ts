import type { Editor, EditorCommandName } from "@inimark/editor";
import { t } from "../i18n/index.ts";
import { formatShortcutDisplay } from "../shortcuts/store.ts";
import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../ui/exclusive-layer.ts";
import { headingLevelBadgeHtml } from "../ui/heading-level-badge.ts";
import { bindTooltip } from "../ui/widgets/tooltip.ts";

export interface EditorContextMenuController {
  destroy(): void;
}

export interface EditorContextMenuOptions {
  onOpenSearch?: () => void;
}

const EDITOR_CONTEXT_LAYER = Symbol("editor-context-menu");

type IconAction =
  | {
      kind: "command";
      name: EditorCommandName;
      label: string;
      shortcut?: string;
      icon: string;
    }
  | {
      kind: "search";
      label: string;
      shortcut?: string;
      icon: string;
    };

type SubmenuLeaf = {
  kind: "item";
  name: EditorCommandName;
  label: string;
  shortcut?: string;
  icon?: string;
};

type SubmenuEntry =
  | SubmenuLeaf
  | { kind: "submenu"; label: string; icon?: string; items: SubmenuLeaf[] }
  | { kind: "divider" };

type SubmenuRow = {
  name: string;
  label: string;
  icon: string;
  items: SubmenuEntry[];
};

function modShortcut(...keys: string[]): string {
  return formatShortcutDisplay(["Ctrl", ...keys]);
}

function altModShortcut(key: string): string {
  return formatShortcutDisplay(["Alt", "Ctrl", key]);
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
  search: svg(
    `<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>`,
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

/** Material Design Icons (via mkdocs-material) — same glyphs as editor callout blocks. */
const CALLOUT_ICONS = {
  note: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2m3.1 5.07c.14 0 .28.05.4.16l1.27 1.27c.23.22.23.57 0 .78l-1 1-2.05-2.05 1-1c.1-.11.24-.16.38-.16m-1.97 1.74 2.06 2.06-6.06 6.06H7.07v-2.06z"/></svg>`,
  tip: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6-1.12.4-2.24-.16-2.9-.82 1.19-.28 1.9-1.16 2.11-2.05.17-.8-.15-1.46-.28-2.23-.12-.74-.1-1.37.17-2.06.19.38.39.76.63 1.06.77 1 1.98 1.44 2.24 2.8.04.14.06.28.06.43.03.82-.33 1.72-.93 2.27"/></svg>`,
  important: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6-1.12.4-2.24-.16-2.9-.82 1.19-.28 1.9-1.16 2.11-2.05.17-.8-.15-1.46-.28-2.23-.12-.74-.1-1.37.17-2.06.19.38.39.76.63 1.06.77 1 1.98 1.44 2.24 2.8.04.14.06.28.06.43.03.82-.33 1.72-.93 2.27"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2z"/></svg>`,
  danger: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m11.5 20 4.86-9.73H13V4l-5 9.73h3.5zM12 2c2.75 0 5.1 1 7.05 2.95S22 9.25 22 12s-1 5.1-2.95 7.05S14.75 22 12 22s-5.1-1-7.05-2.95S2 14.75 2 12s1-5.1 2.95-7.05S9.25 2 12 2"/></svg>`,
};

function buildCalloutSubmenuItems(): SubmenuLeaf[] {
  return [
    {
      kind: "item",
      name: "callout-note",
      label: t("editor.ctx.calloutNote"),
      icon: CALLOUT_ICONS.note,
    },
    {
      kind: "item",
      name: "callout-tip",
      label: t("editor.ctx.calloutTip"),
      icon: CALLOUT_ICONS.tip,
    },
    {
      kind: "item",
      name: "callout-important",
      label: t("editor.ctx.calloutImportant"),
      icon: CALLOUT_ICONS.important,
    },
    {
      kind: "item",
      name: "callout-warning",
      label: t("editor.ctx.calloutWarning"),
      icon: CALLOUT_ICONS.warning,
    },
    {
      kind: "item",
      name: "callout-danger",
      label: t("editor.ctx.calloutDanger"),
      icon: CALLOUT_ICONS.danger,
    },
  ];
}

function buildIconRows(): IconAction[][] {
  return [
    [
      { kind: "command", name: "cut", label: t("editor.ctx.cut"), icon: ICONS.cut },
      { kind: "command", name: "copy", label: t("editor.ctx.copy"), icon: ICONS.copy },
      { kind: "command", name: "paste", label: t("editor.ctx.paste"), icon: ICONS.paste },
      { kind: "command", name: "delete", label: t("editor.ctx.delete"), icon: ICONS.trash },
      {
        kind: "search",
        label: t("editor.ctx.search"),
        shortcut: modShortcut("F"),
        icon: ICONS.search,
      },
    ],
    [
      { kind: "command", name: "bold", label: t("editor.ctx.bold"), shortcut: modShortcut("B"), icon: ICONS.bold },
      { kind: "command", name: "italic", label: t("editor.ctx.italic"), shortcut: modShortcut("I"), icon: ICONS.italic },
      {
        kind: "command",
        name: "strike",
        label: t("editor.ctx.strike"),
        shortcut: formatShortcutDisplay(["Alt", "Shift", "5"]),
        icon: ICONS.strikethrough,
      },
      {
        kind: "command",
        name: "inline-code",
        label: t("editor.ctx.inlineCode"),
        shortcut: modShortcut("Shift", "`"),
        icon: ICONS.code,
      },
      { kind: "command", name: "link", label: t("editor.ctx.link"), shortcut: modShortcut("K"), icon: ICONS.link },
    ],
    [
      {
        kind: "command",
        name: "quote",
        label: t("editor.ctx.quote"),
        shortcut: altModShortcut("Q"),
        icon: ICONS.quote,
      },
      {
        kind: "command",
        name: "list",
        label: t("editor.ctx.bulletList"),
        shortcut: altModShortcut("U"),
        icon: ICONS.listUnordered,
      },
      {
        kind: "command",
        name: "ordered-list",
        label: t("editor.ctx.orderedList"),
        shortcut: altModShortcut("O"),
        icon: ICONS.listOrdered,
      },
      {
        kind: "command",
        name: "check",
        label: t("editor.ctx.taskList"),
        shortcut: altModShortcut("X"),
        icon: ICONS.checkSquare,
      },
      { kind: "command", name: "highlight", label: t("editor.ctx.highlight"), icon: ICONS.highlight },
    ],
  ];
}

function buildSubmenus(): SubmenuRow[] {
  return [
    {
      name: "heading",
      label: t("editor.ctx.heading"),
      icon: ICONS.heading,
      items: [
        {
          kind: "item",
          name: "heading-1",
          label: t("editor.ctx.heading1"),
          shortcut: modShortcut("1"),
          icon: headingLevelBadgeHtml(1),
        },
        {
          kind: "item",
          name: "heading-2",
          label: t("editor.ctx.heading2"),
          shortcut: modShortcut("2"),
          icon: headingLevelBadgeHtml(2),
        },
        {
          kind: "item",
          name: "heading-3",
          label: t("editor.ctx.heading3"),
          shortcut: modShortcut("3"),
          icon: headingLevelBadgeHtml(3),
        },
        {
          kind: "item",
          name: "heading-4",
          label: t("editor.ctx.heading4"),
          shortcut: modShortcut("4"),
          icon: headingLevelBadgeHtml(4),
        },
        {
          kind: "item",
          name: "heading-5",
          label: t("editor.ctx.heading5"),
          shortcut: modShortcut("5"),
          icon: headingLevelBadgeHtml(5),
        },
        {
          kind: "item",
          name: "heading-6",
          label: t("editor.ctx.heading6"),
          shortcut: modShortcut("6"),
          icon: headingLevelBadgeHtml(6),
        },
        { kind: "divider" },
        {
          kind: "item",
          name: "paragraph",
          label: t("editor.ctx.paragraph"),
          shortcut: modShortcut("0"),
          icon: headingLevelBadgeHtml(0),
        },
      ],
    },
    {
      name: "insert",
      label: t("editor.ctx.insert"),
      icon: ICONS.plus,
      items: [
        { kind: "item", name: "upload", label: t("editor.ctx.image"), icon: ICONS.image },
        {
          kind: "item",
          name: "hr",
          label: t("editor.ctx.hr"),
          shortcut: altModShortcut("-"),
          icon: ICONS.minus,
        },
        { kind: "item", name: "more", label: t("editor.ctx.moreTag"), icon: ICONS.minus },
        {
          kind: "item",
          name: "table",
          label: t("editor.ctx.table"),
          shortcut: altModShortcut("T"),
          icon: ICONS.table,
        },
        {
          kind: "item",
          name: "code",
          label: t("editor.ctx.codeBlock"),
          shortcut: altModShortcut("C"),
          icon: ICONS.codeBlock,
        },
        {
          kind: "item",
          name: "math",
          label: t("editor.ctx.mathBlock"),
          shortcut: altModShortcut("B"),
          icon: ICONS.math,
        },
        { kind: "divider" },
        { kind: "item", name: "wiki-link", label: t("editor.ctx.wikiLink"), icon: ICONS.wikiLink },
      ],
    },
    {
      name: "callout",
      label: t("editor.ctx.callout"),
      icon: CALLOUT_ICONS.note,
      items: buildCalloutSubmenuItems(),
    },
    {
      name: "clipboard-as",
      label: t("editor.ctx.clipboardAs"),
      icon: ICONS.copy,
      items: [
        {
          kind: "item",
          name: "copy-as-html",
          label: t("editor.ctx.copyAsHtml"),
          icon: ICONS.codeBlock,
        },
        {
          kind: "item",
          name: "copy-as-plain-text",
          label: t("editor.ctx.copyAsPlainText"),
          icon: ICONS.copy,
        },
        {
          kind: "item",
          name: "paste-as-plain-text",
          label: t("editor.ctx.pasteAsPlainText"),
          shortcut: formatShortcutDisplay(["Ctrl", "Shift", "V"]),
          icon: ICONS.paste,
        },
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
  options: EditorContextMenuOptions = {},
): EditorContextMenuController {
  const onOpenSearch = options.onOpenSearch;
  const menu = document.createElement("div");
  menu.className = "inimark-editor-context-menu inimark-glass";
  menu.hidden = true;
  document.body.append(menu);

  const submenu = document.createElement("div");
  submenu.className = "inimark-editor-context-submenu inimark-glass";
  submenu.hidden = true;
  document.body.append(submenu);

  const nestedSubmenu = document.createElement("div");
  nestedSubmenu.className =
    "inimark-editor-context-submenu inimark-editor-context-submenu--nested inimark-glass";
  nestedSubmenu.hidden = true;
  document.body.append(nestedSubmenu);

  let open = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let nestedCloseTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCloseTimer(): void {
    if (closeTimer != null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function clearNestedCloseTimer(): void {
    if (nestedCloseTimer != null) {
      clearTimeout(nestedCloseTimer);
      nestedCloseTimer = null;
    }
  }

  function scheduleCloseSubmenu(): void {
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      submenu.hidden = true;
      nestedSubmenu.hidden = true;
      closeTimer = null;
    }, 200);
  }

  function scheduleCloseNestedSubmenu(): void {
    clearNestedCloseTimer();
    nestedCloseTimer = setTimeout(() => {
      nestedSubmenu.hidden = true;
      nestedCloseTimer = null;
    }, 200);
  }

  function closeNestedSubmenu(): void {
    clearNestedCloseTimer();
    nestedSubmenu.hidden = true;
  }

  function close(): void {
    clearCloseTimer();
    clearNestedCloseTimer();
    const wasOpen = open;
    open = false;
    menu.hidden = true;
    submenu.hidden = true;
    nestedSubmenu.hidden = true;
    if (wasOpen) releaseExclusiveLayer(EDITOR_CONTEXT_LAYER);
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

  function appendSubmenuLeaf(target: HTMLElement, entry: SubmenuLeaf): void {
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
    target.append(btn);
  }

  function positionFlyout(el: HTMLElement, anchor: HTMLElement, x: number, y: number): void {
    const GAP = 4;
    const width = Math.max(180, el.offsetWidth || 180);
    const height = Math.max(120, el.offsetHeight || 120);
    let nextX = x;
    let nextY = y;
    if (nextX + width > window.innerWidth - GAP) nextX = anchor.getBoundingClientRect().left - width - GAP;
    if (nextY + height > window.innerHeight - GAP) nextY = window.innerHeight - height - GAP;
    if (nextY < GAP) nextY = GAP;
    el.style.left = `${nextX}px`;
    el.style.top = `${nextY}px`;
    requestAnimationFrame(() => clampMenu(el, nextX, nextY));
  }

  function showNestedSubmenu(items: SubmenuLeaf[], anchor: HTMLElement): void {
    clearNestedCloseTimer();
    nestedSubmenu.replaceChildren();
    for (const entry of items) {
      appendSubmenuLeaf(nestedSubmenu, entry);
    }
    nestedSubmenu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const GAP = 4;
    positionFlyout(nestedSubmenu, anchor, rect.right + GAP, rect.top);
  }

  function showSubmenu(row: SubmenuRow, anchor: HTMLElement): void {
    clearCloseTimer();
    closeNestedSubmenu();
    submenu.replaceChildren();

    for (const entry of row.items) {
      if (entry.kind === "divider") {
        const divider = document.createElement("div");
        divider.className = "inimark-editor-context-divider";
        submenu.append(divider);
        continue;
      }
      if (entry.kind === "submenu") {
        const wrap = document.createElement("div");
        wrap.className = "inimark-editor-context-row";
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
        const arrow = document.createElement("span");
        arrow.className = "inimark-editor-context-item-arrow";
        arrow.innerHTML = ICONS.chevronRight;
        btn.append(label, arrow);
        wrap.append(btn);
        wrap.addEventListener("mouseenter", () => showNestedSubmenu(entry.items, wrap));
        wrap.addEventListener("mouseleave", () => scheduleCloseNestedSubmenu());
        submenu.append(wrap);
        continue;
      }
      appendSubmenuLeaf(submenu, entry);
    }

    submenu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const GAP = 4;
    positionFlyout(submenu, anchor, rect.right + GAP, rect.top);
  }

  function renderMenu(): void {
    const iconRows = buildIconRows().map((row) =>
      row.filter((action) => action.kind !== "search" || onOpenSearch),
    );
    const submenuRows = buildSubmenus();
    menu.replaceChildren();

    for (const row of iconRows) {
      const rowEl = document.createElement("div");
      rowEl.className = "inimark-editor-context-icon-row";
      for (const action of row) {
        const wrap = document.createElement("div");
        wrap.className = "inimark-editor-context-icon-wrap";
        bindTooltip(wrap, action.label, action.shortcut);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "inimark-editor-context-icon-btn";
        btn.setAttribute("aria-label", action.label);
        btn.innerHTML = action.icon;
        btn.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (action.kind === "search") {
            onOpenSearch?.();
            close();
            return;
          }
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

  submenu.addEventListener("mouseenter", () => clearCloseTimer());
  submenu.addEventListener("mouseleave", () => scheduleCloseSubmenu());
  nestedSubmenu.addEventListener("mouseenter", () => clearNestedCloseTimer());
  nestedSubmenu.addEventListener("mouseleave", () => scheduleCloseNestedSubmenu());
  function openAt(x: number, y: number): void {
    if (editor.isSourceMode()) {
      close();
      return;
    }
    acquireExclusiveLayer(EDITOR_CONTEXT_LAYER, close, {
      contains: (node) =>
        node != null &&
        (menu.contains(node) || submenu.contains(node) || nestedSubmenu.contains(node)),
    });
    renderMenu();
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

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && open) close();
  }

  host.addEventListener("mousedown", onMouseDownCapture, true);
  host.addEventListener("contextmenu", onContextMenuCapture, true);
  host.addEventListener("selectstart", onSelectStartCapture, true);
  document.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      host.removeEventListener("mousedown", onMouseDownCapture, true);
      host.removeEventListener("contextmenu", onContextMenuCapture, true);
      host.removeEventListener("selectstart", onSelectStartCapture, true);
      document.removeEventListener("keydown", onKeyDown);
      clearCloseTimer();
      close();
      menu.remove();
      submenu.remove();
      nestedSubmenu.remove();
    },
  };
}
