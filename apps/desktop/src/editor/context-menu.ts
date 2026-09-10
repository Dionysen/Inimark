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

const EDITOR_CONTEXT_LAYER = Symbol("editor-context-menu");

type IconAction = {
  name: EditorCommandName;
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

/** GitHub Octicons (MIT) — same glyphs as editor callout blocks. */
const CALLOUT_ICONS = {
  note: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`,
  tip: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>`,
  important: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`,
  danger: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`,
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
      { name: "cut", label: t("editor.ctx.cut"), icon: ICONS.cut },
      { name: "copy", label: t("editor.ctx.copy"), icon: ICONS.copy },
      { name: "paste", label: t("editor.ctx.paste"), icon: ICONS.paste },
      { name: "delete", label: t("editor.ctx.delete"), icon: ICONS.trash },
    ],
    [
      { name: "bold", label: t("editor.ctx.bold"), shortcut: modShortcut("B"), icon: ICONS.bold },
      { name: "italic", label: t("editor.ctx.italic"), shortcut: modShortcut("I"), icon: ICONS.italic },
      {
        name: "strike",
        label: t("editor.ctx.strike"),
        shortcut: formatShortcutDisplay(["Alt", "Shift", "5"]),
        icon: ICONS.strikethrough,
      },
      {
        name: "inline-code",
        label: t("editor.ctx.inlineCode"),
        shortcut: modShortcut("Shift", "`"),
        icon: ICONS.code,
      },
      { name: "link", label: t("editor.ctx.link"), shortcut: modShortcut("K"), icon: ICONS.link },
    ],
    [
      {
        name: "quote",
        label: t("editor.ctx.quote"),
        shortcut: altModShortcut("Q"),
        icon: ICONS.quote,
      },
      {
        name: "list",
        label: t("editor.ctx.bulletList"),
        shortcut: altModShortcut("U"),
        icon: ICONS.listUnordered,
      },
      {
        name: "ordered-list",
        label: t("editor.ctx.orderedList"),
        shortcut: altModShortcut("O"),
        icon: ICONS.listOrdered,
      },
      {
        name: "check",
        label: t("editor.ctx.taskList"),
        shortcut: altModShortcut("X"),
        icon: ICONS.checkSquare,
      },
      { name: "highlight", label: t("editor.ctx.highlight"), icon: ICONS.highlight },
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
): EditorContextMenuController {
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
    const iconRows = buildIconRows();
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
