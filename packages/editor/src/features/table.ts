import type { Node as PMNode, Schema } from "prosemirror-model";
import { Plugin, TextSelection, type Command } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import type { FeatureSpec } from "./_types.ts";

// GFM table — phase 1 (parse / serialize / display only). Live editor
// input (typing `| col |` etc.) and cell navigation (Tab between cells,
// add row / column buttons) are deferred to phase 2.
//
// Schema:
//   table → table_row+ → table_cell+
//   table_cell carries `{header: boolean, align: "left"|"center"|"right"|null}`
//   (alignment from the GFM `:---:` divider; header inferred from
//   md-it's th_open vs td_open tokens — first row's cells carry it).
//
// Round-trip: doc-level only. md-it produces resolved tokens; we emit
// canonical `| col1 | col2 |\n| --- | --- |\n| ... |` shape on save.
// Bare-pipe and column-width-padded variants are accepted on input;
// output is normalized.

export function parseAlignFromStyle(style: string | null): string | null {
  if (!style) return null;
  // Browsers / happy-dom may canonicalize with a space after `:` and a
  // trailing semicolon — match either form.
  const m = /text-align:\s*(left|center|right)/.exec(style);
  return m ? m[1]! : null;
}

function alignDelim(align: string | null, width: number): string {
  // Min divider width is 3 (per GFM); we expand to match content width
  // so the source is human-readable on save.
  const w = Math.max(3, width);
  if (align === "left") return ":" + "-".repeat(w - 1);
  if (align === "right") return "-".repeat(w - 1) + ":";
  if (align === "center") return ":" + "-".repeat(w - 2) + ":";
  return "-".repeat(w);
}

const TABLE_SHORTCUTS = {
  insertRowBelow: ["Mod", "Enter"],
  moveRowUp: ["Alt", "ArrowUp"],
  moveRowDown: ["Alt", "ArrowDown"],
  moveColumnLeft: ["Alt", "ArrowLeft"],
  moveColumnRight: ["Alt", "ArrowRight"],
  deleteRow: ["Mod", "Shift", "Backspace"],
} as const;

function isMacPlatform(): boolean {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("platform-macos")) return true;
    if (
      document.documentElement.classList.contains("platform-windows") ||
      document.documentElement.classList.contains("platform-linux")
    ) {
      return false;
    }
  }
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
}

function formatTableShortcutLabel(keys: readonly string[]): string {
  const mac = isMacPlatform();
  return keys
    .map((key) => {
      if (mac) {
        switch (key) {
          case "Mod":
            return "⌘";
          case "Alt":
            return "⌥";
          case "Shift":
            return "⇧";
          case "Enter":
            return "↩";
          case "Backspace":
            return "⌫";
          case "ArrowUp":
            return "↑";
          case "ArrowDown":
            return "↓";
          case "ArrowLeft":
            return "←";
          case "ArrowRight":
            return "→";
          default:
            return key;
        }
      }
      switch (key) {
        case "Mod":
          return "Ctrl";
        case "ArrowUp":
          return "↑";
        case "ArrowDown":
          return "↓";
        case "ArrowLeft":
          return "←";
        case "ArrowRight":
          return "→";
        default:
          return key;
      }
    })
    .join(mac ? "" : "+");
}

function parseAlignFromDivider(delim: string): string | null {
  const t = delim.trim();
  if (t.startsWith(":") && t.endsWith(":")) return "center";
  if (t.startsWith(":")) return "left";
  if (t.endsWith(":")) return "right";
  return null;
}

function tableNodeToMarkdown(node: PMNode): string {
  const rows: string[][] = [];
  const aligns: Array<string | null> = [];
  node.forEach((row, _, rowIdx) => {
    const cells: string[] = [];
    row.forEach((cell, _o, cellIdx) => {
      if (rowIdx === 0) aligns[cellIdx] = cell.attrs.align as string | null;
      cells.push(renderCellInline(cell));
    });
    rows.push(cells);
  });

  const colCount = aligns.length;
  const widths = new Array<number>(colCount).fill(3);
  for (const r of rows) {
    for (let i = 0; i < colCount; i++) {
      widths[i] = Math.max(widths[i]!, (r[i] ?? "").length);
    }
  }

  const formatRow = (cells: string[]): string => {
    const padded = cells.map((c, i) => " " + c.padEnd(widths[i]!) + " ");
    return "|" + padded.join("|") + "|";
  };
  const dividerRow = (): string => {
    const dividers = aligns.map((a, i) => " " + alignDelim(a, widths[i]!) + " ");
    return "|" + dividers.join("|") + "|";
  };

  const lines = [formatRow(rows[0] ?? []), dividerRow()];
  for (let i = 1; i < rows.length; i++) lines.push(formatRow(rows[i]!));
  return lines.join("\n");
}

function markdownToTableNode(md: string, schema: Schema): PMNode | null {
  const lines = md
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    if (!/^\|.+\|$/.test(line)) return [];
    return line.split("|").slice(1, -1).map((cell) => cell.trim());
  };

  const headerCells = parseRow(lines[0]!);
  const dividerCells = parseRow(lines[1]!);
  if (headerCells.length < 1 || dividerCells.length !== headerCells.length) return null;

  const aligns = dividerCells.map((cell) => parseAlignFromDivider(cell));
  const rows: PMNode[] = [];
  rows.push(
    schema.nodes.table_row.create(
      null,
      headerCells.map((text, idx) =>
        schema.nodes.table_cell.create(
          { header: true, align: aligns[idx] ?? null },
          text ? [schema.text(text)] : [],
        ),
      ),
    ),
  );

  for (let i = 2; i < lines.length; i++) {
    const bodyCells = parseRow(lines[i]!);
    if (bodyCells.length !== headerCells.length) return null;
    rows.push(
      schema.nodes.table_row.create(
        null,
        bodyCells.map((text) =>
          schema.nodes.table_cell.create(
            { header: false, align: null },
            text ? [schema.text(text)] : [],
          ),
        ),
      ),
    );
  }

  return schema.nodes.table.create(null, rows);
}

async function copyTableAt(view: EditorView, info: TableInfo): Promise<void> {
  const text = tableNodeToMarkdown(info.node);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  view.focus?.();
}

function formatTableAt(view: EditorView, info: TableInfo): void {
  const schema = view.state.schema;
  const md = tableNodeToMarkdown(info.node);
  const newTable = markdownToTableNode(md, schema);
  if (!newTable) return;
  const tr = view.state.tr.replaceWith(info.pos, info.pos + info.node.nodeSize, newTable);
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      cellCursorPos(info.pos, newTable, info.rowIdx, info.cellIdx),
    ),
  );
  view.dispatch(tr);
  view.focus?.();
}

// Precompute the inline serialization of a cell — needed twice (column
// width measurement, then actual emission). We render via the same
// inline serializer the rest of the doc uses, but into a sandbox so
// pmPos/markers from the outer state don't leak.
// ---------------- toolbar plugin ----------------
//
// Floating toolbar shown when the cursor is inside a table. Carries:
//   * resize trigger (田字格 icon) → opens a popup with a hover-grid
//     and numeric R × C inputs to resize the table.
//   * 3 align buttons → toggle `align` on every cell in the cursor's
//     current column (click again to clear).
//
// The toolbar lives at `document.body` (position: fixed, viewport
// coords). Position is recomputed every PM transaction from the table
// element's bounding rect.

type TableInfo = {
  pos: number; // pos *of* the table node (so view.nodeDOM works).
  node: PMNode;
  rowIdx: number;
  cellIdx: number;
};

function findTableAtSelection(state: import("prosemirror-state").EditorState): TableInfo | null {
  const $from = state.selection.$from;
  let cellDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "table_cell") {
      cellDepth = d;
      break;
    }
  }
  if (cellDepth === -1) return null;
  const tableDepth = cellDepth - 2;
  return {
    pos: $from.before(tableDepth),
    node: $from.node(tableDepth),
    rowIdx: $from.index(tableDepth),
    cellIdx: $from.index(cellDepth - 1),
  };
}

function applyAlignToColumn(
  view: EditorView,
  info: TableInfo,
  align: "left" | "center" | "right" | null,
): void {
  const tr = view.state.tr;
  let pos = info.pos + 1; // inside table
  info.node.forEach((row) => {
    let cellPos = pos + 1; // inside row
    row.forEach((cell, _o, idx) => {
      if (idx === info.cellIdx) {
        tr.setNodeMarkup(cellPos, null, { ...cell.attrs, align });
      }
      cellPos += cell.nodeSize;
    });
    pos += row.nodeSize;
  });
  view.dispatch(tr);
  view.focus();
}

function deleteTable(view: EditorView, info: TableInfo): void {
  const schema = view.state.schema;
  const tr = view.state.tr;
  const start = info.pos;
  const end = start + info.node.nodeSize;
  const para = schema.nodes.paragraph.create();
  tr.replaceWith(start, end, para);
  tr.setSelection(TextSelection.create(tr.doc, start + 1));
  view.dispatch(tr);
  view.focus();
}

function resizeTable(
  view: EditorView,
  info: TableInfo,
  rows: number,
  cols: number,
): void {
  if (rows < 1 || cols < 1) return;
  const schema = view.state.schema;
  const old = info.node;
  const oldRows: PMNode[] = [];
  old.forEach((r) => oldRows.push(r));

  const newRows: PMNode[] = [];
  for (let r = 0; r < rows; r++) {
    const oldRow = oldRows[r];
    const oldCells: PMNode[] = [];
    if (oldRow) oldRow.forEach((c) => oldCells.push(c));
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) {
      const oldCell = oldCells[c];
      const isHeader = r === 0;
      // Reuse alignment from the corresponding column in the old
      // header row (if any) so resizing preserves user intent.
      const headerRowOld = oldRows[0];
      const align =
        headerRowOld && c < headerRowOld.childCount
          ? (headerRowOld.child(c).attrs.align as string | null)
          : null;
      const content = oldCell ? oldCell.content : null;
      cells.push(
        schema.nodes.table_cell.create(
          { header: isHeader, align },
          content,
        ),
      );
    }
    newRows.push(schema.nodes.table_row.create(null, cells));
  }
  const newTable = schema.nodes.table.create(null, newRows);
  const tr = view.state.tr;
  const start = info.pos;
  const end = start + old.nodeSize;
  tr.replaceWith(start, end, newTable);
  // Place cursor inside the first body cell (or first cell if rows=1).
  const firstBodyCell =
    start + 1 + newRows[0]!.nodeSize + (rows > 1 ? 2 : -newRows[0]!.nodeSize + 2);
  // ^ if rows>1: tableStart+1 (table) + headerSize + 1 (row open) + 1 (cell open)
  //   if rows=1: tableStart+1 (table) + 1 (row open) + 1 (cell open)
  const safePos = Math.min(firstBodyCell, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, safePos));
  view.dispatch(tr);
  view.focus();
}

function svgIcon(paths: string, viewBox = "0 0 24 24"): SVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.innerHTML = paths;
  return svg;
}

function buildToolbar(view: EditorView, getInfo: () => TableInfo | null): {
  root: HTMLElement;
  popup: HTMLElement;
} {
  const root = document.createElement("div");
  root.className = "inimark-editor-context-menu inimark-glass table-toolbar";

  const iconRow = document.createElement("div");
  iconRow.className = "inimark-editor-context-icon-row";

  const grid = document.createElement("button");
  grid.type = "button";
  grid.className = "inimark-editor-context-icon-btn";
  grid.title = "Resize";
  grid.appendChild(
    svgIcon(
      `<rect x='4' y='4' width='6' height='6' fill='currentColor'/>
       <rect x='14' y='4' width='6' height='6' fill='currentColor'/>
       <rect x='4' y='14' width='6' height='6' fill='currentColor'/>
       <rect x='14' y='14' width='6' height='6' fill='currentColor'/>`,
    ),
  );

  const sep = document.createElement("span");
  sep.className = "table-toolbar__sep";
  sep.setAttribute("aria-hidden", "true");

  const mkAlign = (a: "left" | "center" | "right", lines: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "inimark-editor-context-icon-btn";
    b.title = `Align ${a}`;
    b.dataset.align = a;
    b.appendChild(svgIcon(lines));
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const info = getInfo();
      if (!info) return;
      const headerCell = info.node.child(0).child(info.cellIdx);
      const cur = headerCell.attrs.align as string | null;
      applyAlignToColumn(view, info, cur === a ? null : a);
    });
    return b;
  };
  const alignL = mkAlign(
    "left",
    `<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>
     <line x1='4' y1='12' x2='14' y2='12' stroke='currentColor' stroke-width='2'/>
     <line x1='4' y1='18' x2='18' y2='18' stroke='currentColor' stroke-width='2'/>`,
  );
  const alignC = mkAlign(
    "center",
    `<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>
     <line x1='7' y1='12' x2='17' y2='12' stroke='currentColor' stroke-width='2'/>
     <line x1='5' y1='18' x2='19' y2='18' stroke='currentColor' stroke-width='2'/>`,
  );
  const alignR = mkAlign(
    "right",
    `<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>
     <line x1='10' y1='12' x2='20' y2='12' stroke='currentColor' stroke-width='2'/>
     <line x1='6' y1='18' x2='20' y2='18' stroke='currentColor' stroke-width='2'/>`,
  );

  iconRow.append(grid, sep, alignL, alignC, alignR);
  root.append(iconRow);

  // Resize popup — snapshot TableInfo while open so focus moves to the
  // popup inputs don't invalidate the target table mid-action.
  let popupSnapshot: TableInfo | null = null;
  const resizePopup = buildSizeGridPopup({
    className: "table-resize-popup",
    initialR: 3,
    initialC: 3,
    onCommit: (rows, cols) => {
      const target = popupSnapshot ?? getInfo();
      if (target) resizeTable(view, target, rows, cols);
      popupSnapshot = null;
      resizePopup.close();
    },
    onDismiss: () => {
      popupSnapshot = null;
    },
  });
  const isPopupOpen = () => resizePopup.root.style.display === "block";

  const closePopup = () => {
    popupSnapshot = null;
    resizePopup.close();
  };

  const openPopup = (liveInfo: TableInfo) => {
    popupSnapshot = liveInfo;
    let R = 0;
    let C = 0;
    liveInfo.node.forEach((row) => {
      R++;
      C = Math.max(C, row.childCount);
    });
    const r = grid.getBoundingClientRect();
    resizePopup.openAt({
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      rows: R,
      cols: C,
    });
  };

  grid.addEventListener("mousedown", (e) => e.preventDefault());
  grid.addEventListener("click", () => {
    const liveInfo = getInfo();
    if (!liveInfo) return;
    if (isPopupOpen()) {
      closePopup();
      return;
    }
    openPopup(liveInfo);
  });

  return { root, popup: resizePopup.root, closePopup };
}

function buildRowColMenu(view: EditorView, getInfo: () => TableInfo | null): {
  root: HTMLElement;
  popup: HTMLElement;
  closePopup: () => void;
  positionPopup: () => void;
} {
  const root = document.createElement("div");
  root.className = "inimark-editor-context-menu inimark-glass table-rc-toolbar";

  const iconRow = document.createElement("div");
  iconRow.className = "inimark-editor-context-icon-row";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "inimark-editor-context-icon-btn";
  trigger.title = "Rows & columns";
  trigger.appendChild(
    svgIcon(
      `<rect x='5' y='5' width='14' height='4' rx='1' fill='currentColor'/>
       <rect x='5' y='11' width='14' height='4' rx='1' fill='currentColor'/>
       <rect x='5' y='17' width='14' height='2' rx='1' fill='currentColor'/>`,
    ),
  );

  const popup = document.createElement("div");
  popup.className = "inimark-editor-context-submenu inimark-glass table-rc-popup";
  popup.style.display = "none";
  popup.addEventListener("mousedown", (e) => e.preventDefault());

  const mkDivider = () => {
    const divider = document.createElement("div");
    divider.className = "inimark-editor-context-divider";
    return divider;
  };

  const mkItem = (
    label: string,
    action: () => void,
    options: { danger?: boolean; shortcut?: readonly string[] } = {},
  ) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "inimark-editor-context-item table-rc-item";
    if (options.danger) btn.classList.add("is-danger");
    const labelEl = document.createElement("span");
    labelEl.className = "inimark-editor-context-item-label";
    labelEl.textContent = label;
    btn.append(labelEl);
    if (options.shortcut?.length) {
      const shortcutEl = document.createElement("span");
      shortcutEl.className = "inimark-editor-context-item-shortcut";
      shortcutEl.textContent = formatTableShortcutLabel(options.shortcut);
      btn.append(shortcutEl);
    }
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      action();
      closePopup();
    });
    return btn;
  };

  popup.append(
    mkItem("上方插入行", () => {
      const info = getInfo();
      if (info) insertTableRowAt(view, info, "above");
    }),
    mkItem("下方插入行", () => {
      const info = getInfo();
      if (info) insertTableRowAt(view, info, "below");
    }, { shortcut: TABLE_SHORTCUTS.insertRowBelow }),
    mkItem("左侧插入列", () => {
      const info = getInfo();
      if (info) insertTableColumnAt(view, info, "left");
    }),
    mkItem("右侧插入列", () => {
      const info = getInfo();
      if (info) insertTableColumnAt(view, info, "right");
    }),
    mkDivider(),
    mkItem("上移该行", () => {
      const info = getInfo();
      if (info) runTableCommand(view, moveTableRow(-1));
    }, { shortcut: TABLE_SHORTCUTS.moveRowUp }),
    mkItem("下移该行", () => {
      const info = getInfo();
      if (info) runTableCommand(view, moveTableRow(1));
    }, { shortcut: TABLE_SHORTCUTS.moveRowDown }),
    mkItem("左移该列", () => {
      const info = getInfo();
      if (info) runTableCommand(view, moveTableColumn(-1));
    }, { shortcut: TABLE_SHORTCUTS.moveColumnLeft }),
    mkItem("右移该列", () => {
      const info = getInfo();
      if (info) runTableCommand(view, moveTableColumn(1));
    }, { shortcut: TABLE_SHORTCUTS.moveColumnRight }),
    mkDivider(),
    mkItem("删除行", () => {
      const info = getInfo();
      if (info) deleteTableRowAt(view, info);
    }, { danger: true, shortcut: TABLE_SHORTCUTS.deleteRow }),
    mkItem("删除列", () => {
      const info = getInfo();
      if (info) deleteTableColumnAt(view, info);
    }, { danger: true }),
    mkDivider(),
    mkItem("复制表格", () => {
      const info = getInfo();
      if (info) copyTableAt(view, info);
    }),
    mkItem("格式化表格源码", () => {
      const info = getInfo();
      if (info) formatTableAt(view, info);
    }),
    mkDivider(),
    mkItem("删除表格", () => {
      const info = getInfo();
      if (info) deleteTable(view, info);
    }, { danger: true }),
  );

  iconRow.append(trigger);
  root.append(iconRow);

  const isOpen = () => popup.style.display === "block";

  const dismissOnPointer = (event: Event) => {
    if (!isOpen()) return;
    const target = event.target as Node;
    if (popup.contains(target) || root.contains(target)) return;
    closePopup();
  };

  const closePopup = () => {
    popup.style.display = "none";
    document.removeEventListener("mousedown", dismissOnPointer, true);
  };

  const positionPopup = () => {
    if (!isOpen()) return;
    positionBelowAnchor(popup, root.getBoundingClientRect(), { alignRight: true });
  };

  trigger.addEventListener("mousedown", (e) => e.preventDefault());
  trigger.addEventListener("click", () => {
    if (isOpen()) {
      closePopup();
      return;
    }
    popup.style.display = "block";
    positionPopup();
    document.addEventListener("mousedown", dismissOnPointer, true);
  });

  return { root, popup, closePopup, positionPopup };
}

const VIEWPORT_GAP = 4;
const TOOLBAR_GAP = 8;

function clampInViewport(
  width: number,
  height: number,
  left: number,
  top: number,
): { left: number; top: number } {
  let x = left;
  let y = top;
  if (x + width > window.innerWidth - VIEWPORT_GAP) {
    x = window.innerWidth - width - VIEWPORT_GAP;
  }
  if (y + height > window.innerHeight - VIEWPORT_GAP) {
    y = window.innerHeight - height - VIEWPORT_GAP;
  }
  if (x < VIEWPORT_GAP) x = VIEWPORT_GAP;
  if (y < VIEWPORT_GAP) y = VIEWPORT_GAP;
  return { left: x, top: y };
}

function applyViewportPosition(
  el: HTMLElement,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const clamped = clampInViewport(width, height, left, top);
  el.style.transform = "none";
  el.style.left = `${clamped.left}px`;
  el.style.top = `${clamped.top}px`;
}

/** Prefer opening above `anchor`; flip below when there isn't enough room. */
function positionAboveAnchor(
  el: HTMLElement,
  anchor: DOMRect,
  options: { alignRight?: boolean } = {},
): void {
  el.style.display = "flex";
  const { width, height } = el.getBoundingClientRect();
  let left = options.alignRight ? anchor.right - width : anchor.left;
  let top = anchor.top - height - TOOLBAR_GAP;
  if (top < VIEWPORT_GAP) {
    top = anchor.bottom + TOOLBAR_GAP;
  }
  applyViewportPosition(el, left, top, width, height);
}

/** Prefer opening below `anchor`; flip above when there isn't enough room. */
function positionBelowAnchor(
  el: HTMLElement,
  anchor: DOMRect,
  options: { alignRight?: boolean } = {},
): void {
  el.style.display = "block";
  const { width, height } = el.getBoundingClientRect();
  let left = options.alignRight ? anchor.right - width : anchor.left;
  let top = anchor.bottom + TOOLBAR_GAP;
  if (top + height > window.innerHeight - VIEWPORT_GAP) {
    const above = anchor.top - height - TOOLBAR_GAP;
    if (above >= VIEWPORT_GAP) top = above;
  }
  applyViewportPosition(el, left, top, width, height);
}

function positionAboveTable(el: HTMLElement, tableRect: DOMRect): void {
  positionAboveAnchor(el, tableRect);
}

function positionTableCornerMenu(el: HTMLElement, tableRect: DOMRect): void {
  positionAboveAnchor(el, tableRect, { alignRight: true });
}

function tableToolbarPlugin(): Plugin {
  return new Plugin({
    view(view) {
      let info: TableInfo | null = null;
      // Lazy: toolbar DOM is only built and appended when this view is
      // both focused and on a table. Unfocused views (every case-card
      // in the harness with a table seed) never create toolbar DOM.
      let toolbar: {
        root: HTMLElement;
        popup: HTMLElement;
        closePopup: () => void;
        rowCol: {
          root: HTMLElement;
          popup: HTMLElement;
          closePopup: () => void;
          positionPopup: () => void;
        };
      } | null = null;

      const ensureMounted = () => {
        if (!toolbar) {
          const main = buildToolbar(view, () => info);
          const rowCol = buildRowColMenu(view, () => info);
          toolbar = { ...main, rowCol };
        }
        if (!toolbar.root.isConnected) {
          document.body.appendChild(toolbar.root);
          document.body.appendChild(toolbar.popup);
          document.body.appendChild(toolbar.rowCol.root);
          document.body.appendChild(toolbar.rowCol.popup);
        }
        return toolbar;
      };
      const unmount = () => {
        toolbar?.closePopup();
        toolbar?.rowCol.closePopup();
        if (toolbar?.root.isConnected) {
          toolbar.root.remove();
          toolbar.popup.remove();
          toolbar.rowCol.root.remove();
          toolbar.rowCol.popup.remove();
        }
      };

      const update = () => {
        info = findTableAtSelection(view.state);
        if (!info || !view.hasFocus()) {
          unmount();
          return;
        }
        const dom = view.nodeDOM(info.pos) as HTMLElement | null;
        if (!dom) {
          unmount();
          return;
        }
        const tb = ensureMounted();
        const rect = dom.getBoundingClientRect();
        positionAboveTable(tb.root, rect);
        positionTableCornerMenu(tb.rowCol.root, rect);
        tb.rowCol.positionPopup();
        // Reflect current column's align in the button states.
        const cur = info.node.child(0).child(info.cellIdx).attrs.align as string | null;
        tb.root.querySelectorAll<HTMLElement>("[data-align]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.align === cur);
        });
      };

      const onScroll = () => update();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      view.dom.addEventListener("focusin", update);
      view.dom.addEventListener("focusout", update);

      return {
        update() {
          update();
        },
        destroy() {
          window.removeEventListener("scroll", onScroll, true);
          window.removeEventListener("resize", onScroll);
          view.dom.removeEventListener("focusin", update);
          view.dom.removeEventListener("focusout", update);
          unmount();
        },
      };
    },
  });
}

function tabCellNav(dir: 1 | -1) {
  return (state: import("prosemirror-state").EditorState,
    dispatch?: (tr: import("prosemirror-state").Transaction) => void): boolean => {
    const $from = state.selection.$from;
    let cellDepth = -1;
    for (let d = $from.depth; d >= 0; d--) {
      if ($from.node(d).type.name === "table_cell") {
        cellDepth = d;
        break;
      }
    }
    if (cellDepth === -1) return false;
    const rowDepth = cellDepth - 1;
    const tableDepth = cellDepth - 2;
    const cellIdx = $from.index(rowDepth);
    const rowIdx = $from.index(tableDepth);
    const tableNode = $from.node(tableDepth);
    const row = $from.node(rowDepth);

    let nextRow = rowIdx;
    let nextCell = cellIdx + dir;
    if (nextCell < 0) {
      nextRow = rowIdx - 1;
      if (nextRow < 0) return true; // first cell — consume, no-op
      nextCell = tableNode.child(nextRow).childCount - 1;
    } else if (nextCell >= row.childCount) {
      nextRow = rowIdx + 1;
      if (nextRow >= tableNode.childCount) return true; // last cell — consume, no-op
      nextCell = 0;
    }
    if (dispatch) {
      const tableStart = $from.before(tableDepth);
      let pos = tableStart + 1; // inside table
      for (let r = 0; r < nextRow; r++) pos += tableNode.child(r).nodeSize;
      pos += 1; // inside row
      const targetRow = tableNode.child(nextRow);
      for (let c = 0; c < nextCell; c++) pos += targetRow.child(c).nodeSize;
      pos += 1; // inside cell
      dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, pos)),
      );
    }
    return true;
  };
}

function renderCellInline(cell: PMNode): string {
  // Minimal cell-content serializer — covers method-B marks (delim chars
  // already live in textContent) and avoids the circular import with
  // serializer.ts. Inline atom nodes inside cells (image, etc.) are
  // skipped for the pilot; phase 2 can route them through the full
  // serializer if/when atoms in tables become a real use case.
  let out = "";
  cell.content.forEach((child) => {
    if (child.isText) out += child.text ?? "";
  });
  // Pipes inside cells are GFM-escaped as `\|`.
  return out.replace(/\|/g, "\\|");
}

function cellCursorPos(
  tableStart: number,
  tableNode: PMNode,
  rowIdx: number,
  cellIdx: number,
): number {
  let pos = tableStart + 1;
  for (let r = 0; r < rowIdx; r++) pos += tableNode.child(r).nodeSize;
  const row = tableNode.child(rowIdx);
  pos += 1;
  for (let c = 0; c < cellIdx; c++) pos += row.child(c).nodeSize;
  return pos + 1;
}

const SIZE_GRID_MAX = 10;

function insertTableRowAt(
  view: EditorView,
  info: TableInfo,
  where: "above" | "below",
): void {
  const schema = view.state.schema;
  const { rowIdx, cellIdx, pos, node: tableNode } = info;
  const targetRowIdx = where === "above" ? rowIdx : rowIdx + 1;
  const colCount = tableNode.child(rowIdx).childCount;
  const headerRow = tableNode.child(0);
  const newCells: PMNode[] = [];
  for (let c = 0; c < colCount; c++) {
    const align = (headerRow.child(c)?.attrs.align as string | null) ?? null;
    newCells.push(
      schema.nodes.table_cell.create(
        { header: targetRowIdx === 0, align },
        [],
      ),
    );
  }
  const newRow = schema.nodes.table_row.create(null, newCells);
  let insertAt = pos + 1;
  for (let r = 0; r < targetRowIdx; r++) insertAt += tableNode.child(r).nodeSize;
  const tr = view.state.tr.insert(insertAt, newRow);
  let cursorPos = insertAt + 1;
  for (let c = 0; c < cellIdx; c++) cursorPos += newRow.child(c).nodeSize;
  cursorPos += 1;
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  view.dispatch(tr);
  view.focus?.();
}

function deleteTableRowAt(view: EditorView, info: TableInfo): void {
  const { rowIdx, cellIdx, pos, node: tableNode } = info;
  if (tableNode.childCount <= 1) return;
  let rowStart = pos + 1;
  for (let r = 0; r < rowIdx; r++) rowStart += tableNode.child(r).nodeSize;
  const row = tableNode.child(rowIdx);
  const tr = view.state.tr.delete(rowStart, rowStart + row.nodeSize);
  const newTable = tr.doc.nodeAt(pos)!;
  const targetRowIdx = Math.min(rowIdx, newTable.childCount - 1);
  const targetRow = newTable.child(targetRowIdx);
  const targetCol = Math.min(cellIdx, targetRow.childCount - 1);
  tr.setSelection(
    TextSelection.create(tr.doc, cellCursorPos(pos, newTable, targetRowIdx, targetCol)),
  );
  view.dispatch(tr);
  view.focus?.();
}

function insertTableColumnAt(
  view: EditorView,
  info: TableInfo,
  where: "left" | "right",
): void {
  const schema = view.state.schema;
  const { rowIdx, cellIdx, pos, node: tableNode } = info;
  const targetColIdx = where === "left" ? cellIdx : cellIdx + 1;
  const headerRow = tableNode.child(0);
  const newRows: PMNode[] = [];
  tableNode.forEach((row, r) => {
    const cells: PMNode[] = [];
    row.forEach((cell) => cells.push(cell));
    const align =
      r === 0
        ? null
        : ((headerRow.child(Math.min(cellIdx, headerRow.childCount - 1))?.attrs
            .align as string | null) ?? null);
    cells.splice(
      targetColIdx,
      0,
      schema.nodes.table_cell.create({ header: r === 0, align }, []),
    );
    newRows.push(schema.nodes.table_row.create(null, cells));
  });
  const newTable = schema.nodes.table.create(null, newRows);
  const tr = view.state.tr.replaceWith(pos, pos + tableNode.nodeSize, newTable);
  tr.setSelection(
    TextSelection.create(tr.doc, cellCursorPos(pos, newTable, rowIdx, targetColIdx)),
  );
  view.dispatch(tr);
  view.focus?.();
}

function deleteTableColumnAt(view: EditorView, info: TableInfo): void {
  const { rowIdx, cellIdx, pos, node: tableNode } = info;
  const colCount = tableNode.child(0).childCount;
  if (colCount <= 1) return;
  const schema = view.state.schema;
  const newRows: PMNode[] = [];
  tableNode.forEach((row) => {
    const cells: PMNode[] = [];
    row.forEach((cell, idx) => {
      if (idx !== cellIdx) cells.push(cell);
    });
    newRows.push(schema.nodes.table_row.create(null, cells));
  });
  const newTable = schema.nodes.table.create(null, newRows);
  const tr = view.state.tr.replaceWith(pos, pos + tableNode.nodeSize, newTable);
  const targetCol = Math.min(cellIdx, newTable.child(0).childCount - 1);
  tr.setSelection(
    TextSelection.create(tr.doc, cellCursorPos(pos, newTable, rowIdx, targetCol)),
  );
  view.dispatch(tr);
  view.focus?.();
}

function runTableCommand(view: EditorView, command: Command): void {
  command(view.state, view.dispatch.bind(view), view);
  view.focus?.();
}

type SizeGridPopup = {
  root: HTMLElement;
  openAt: (anchor: {
    top: number;
    left: number;
    bottom?: number;
    right?: number;
    rows?: number;
    cols?: number;
  }) => void;
  close: () => void;
  destroy: () => void;
};

function buildSizeGridPopup(options: {
  className: string;
  initialR: number;
  initialC: number;
  onCommit: (rows: number, cols: number) => void;
  onDismiss: () => void;
}): SizeGridPopup {
  const root = document.createElement("div");
  root.className = `inimark-editor-context-menu inimark-glass ${options.className}`;

  const gridEl = document.createElement("div");
  gridEl.className = "table-resize-grid";
  const cells: HTMLElement[][] = [];
  for (let r = 0; r < SIZE_GRID_MAX; r++) {
    const row: HTMLElement[] = [];
    for (let c = 0; c < SIZE_GRID_MAX; c++) {
      const cell = document.createElement("div");
      cell.className = "table-resize-cell";
      cell.dataset.r = String(r + 1);
      cell.dataset.c = String(c + 1);
      gridEl.appendChild(cell);
      row.push(cell);
    }
    cells.push(row);
  }

  const inputs = document.createElement("div");
  inputs.className = "table-resize-inputs";
  const rIn = document.createElement("input");
  rIn.type = "number";
  rIn.min = "1";
  rIn.max = "20";
  const xLabel = document.createElement("span");
  xLabel.textContent = "×";
  const cIn = document.createElement("input");
  cIn.type = "number";
  cIn.min = "1";
  cIn.max = "20";
  inputs.append(rIn, xLabel, cIn);
  root.append(gridEl, inputs);

  const setHighlight = (R: number, C: number) => {
    for (let r = 0; r < SIZE_GRID_MAX; r++) {
      for (let c = 0; c < SIZE_GRID_MAX; c++) {
        cells[r]![c]!.classList.toggle("hover", r < R && c < C);
      }
    }
    rIn.value = String(R);
    cIn.value = String(C);
  };

  gridEl.addEventListener("mousemove", (e) => {
    const t = (e.target as HTMLElement).closest(".table-resize-cell") as HTMLElement | null;
    if (!t) return;
    setHighlight(Number(t.dataset.r), Number(t.dataset.c));
  });

  const commit = (rows: number, cols: number) => {
    const R = Math.max(1, Math.min(20, rows));
    const C = Math.max(1, Math.min(20, cols));
    options.onCommit(R, C);
  };

  gridEl.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(".table-resize-cell") as HTMLElement | null;
    if (!t) return;
    commit(Number(t.dataset.r), Number(t.dataset.c));
  });

  const commitInputs = () => {
    commit(Number(rIn.value) || 1, Number(cIn.value) || 1);
  };
  for (const input of [rIn, cIn]) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitInputs();
      }
    });
  }

  root.addEventListener("mousedown", (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT") e.preventDefault();
  });

  let dismissOnPointer: ((event: Event) => void) | null = null;
  let dismissOnFocusIn: ((event: FocusEvent) => void) | null = null;

  const close = () => {
    root.style.display = "none";
    if (dismissOnPointer) {
      document.removeEventListener("mousedown", dismissOnPointer, true);
      dismissOnPointer = null;
    }
    if (dismissOnFocusIn) {
      document.removeEventListener("focusin", dismissOnFocusIn, true);
      dismissOnFocusIn = null;
    }
  };

  const openAt = (anchor: {
    top: number;
    left: number;
    bottom?: number;
    right?: number;
    rows?: number;
    cols?: number;
  }) => {
    close();
    setHighlight(
      Math.min(anchor.rows ?? options.initialR, SIZE_GRID_MAX),
      Math.min(anchor.cols ?? options.initialC, SIZE_GRID_MAX),
    );
    root.style.display = "block";
    const anchorRect = new DOMRect(
      anchor.left,
      anchor.top,
      Math.max(1, (anchor.right ?? anchor.left + 1) - anchor.left),
      Math.max(1, (anchor.bottom ?? anchor.top) - anchor.top),
    );
    // Measure after layout so the numeric inputs row is included in height.
    void root.offsetHeight;
    positionBelowAnchor(root, anchorRect);
    dismissOnPointer = (event: Event) => {
      const target = event.target as Node;
      if (root.contains(target)) return;
      close();
      options.onDismiss();
    };
    dismissOnFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (root.contains(target)) return;
      close();
      options.onDismiss();
    };
    document.addEventListener("mousedown", dismissOnPointer, true);
    document.addEventListener("focusin", dismissOnFocusIn, true);
  };

  const destroy = () => {
    close();
    root.remove();
  };

  return { root, openAt, close, destroy };
}

const DEFAULT_INSERT_ROWS = 4;
const DEFAULT_INSERT_COLS = 3;

type TableInsertDialog = {
  overlay: HTMLElement;
  onKeyDown: (event: KeyboardEvent) => void;
};

let activeInsertDialog: TableInsertDialog | null = null;

function dismissTableInsertDialog(): void {
  if (!activeInsertDialog) return;
  document.removeEventListener("keydown", activeInsertDialog.onKeyDown, true);
  activeInsertDialog.overlay.remove();
  activeInsertDialog = null;
}

function clampTableSize(value: number, fallback: number): number {
  return Math.max(1, Math.min(20, Number.isFinite(value) ? value : fallback));
}

/** Open a modal to enter row/column counts before inserting a new table. */
export function showTableInsertPicker(view: EditorView): void {
  dismissTableInsertDialog();

  const overlay = document.createElement("div");
  overlay.className = "table-insert-dialog";

  const panel = document.createElement("div");
  panel.className = "table-insert-dialog__panel inimark-glass";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.className = "table-insert-dialog__title";
  title.textContent = "插入表格";

  const form = document.createElement("div");
  form.className = "table-insert-dialog__form";

  const mkField = (label: string, value: number) => {
    const field = document.createElement("label");
    field.className = "table-insert-dialog__field";
    const name = document.createElement("span");
    name.className = "table-insert-dialog__label";
    name.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "20";
    input.value = String(value);
    input.className = "table-insert-dialog__input";
    field.append(name, input);
    return { field, input };
  };

  const rowsField = mkField("行", DEFAULT_INSERT_ROWS);
  const colsField = mkField("列", DEFAULT_INSERT_COLS);
  form.append(rowsField.field, colsField.field);

  const actions = document.createElement("div");
  actions.className = "table-insert-dialog__actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "table-insert-dialog__btn";
  cancelBtn.textContent = "取消";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "table-insert-dialog__btn table-insert-dialog__btn--primary";
  confirmBtn.textContent = "确定";

  actions.append(cancelBtn, confirmBtn);
  panel.append(title, form, actions);
  overlay.append(panel);

  const commit = () => {
    const rows = clampTableSize(Number(rowsField.input.value), DEFAULT_INSERT_ROWS);
    const cols = clampTableSize(Number(colsField.input.value), DEFAULT_INSERT_COLS);
    dismissTableInsertDialog();
    insertTableAtSelection(view.state.schema, rows, cols)(
      view.state,
      view.dispatch.bind(view),
      view,
    );
    view.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissTableInsertDialog();
      return;
    }
    if (event.key === "Enter" && event.target !== cancelBtn) {
      event.preventDefault();
      commit();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dismissTableInsertDialog();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  cancelBtn.addEventListener("click", () => dismissTableInsertDialog());
  confirmBtn.addEventListener("click", () => commit());
  document.addEventListener("keydown", onKeyDown, true);

  document.body.append(overlay);
  activeInsertDialog = { overlay, onKeyDown };
  rowsField.input.focus();
  rowsField.input.select();
}

function insertTableAtSelection(schema: Schema, rows = 3, cols = 3): Command {
  return (state, dispatch) => {
    const makeRow = (header: boolean) => {
      const cells = [];
      for (let c = 0; c < cols; c++) {
        cells.push(schema.nodes.table_cell.create({ header, align: null }));
      }
      return schema.nodes.table_row.create(null, cells);
    };
    const rowNodes = [makeRow(true)];
    for (let r = 1; r < rows; r++) rowNodes.push(makeRow(false));
    const table = schema.nodes.table.create(null, rowNodes);
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(table);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function moveTableRow(direction: -1 | 1): Command {
  return (state, dispatch) => {
    const info = findTableAtSelection(state);
    if (!info) return false;
    const { rowIdx, cellIdx, pos, node: tableNode } = info;
    const targetIdx = rowIdx + direction;
    if (targetIdx < 0 || targetIdx >= tableNode.childCount) return false;
    if (dispatch) {
      const rows: PMNode[] = [];
      tableNode.forEach((row) => rows.push(row));
      const swapped = rows[rowIdx];
      rows[rowIdx] = rows[targetIdx]!;
      rows[targetIdx] = swapped!;
      const schema = state.schema;
      const newTable = schema.nodes.table.create(null, rows);
      const tr = state.tr.replaceWith(pos, pos + tableNode.nodeSize, newTable);
      tr.setSelection(
        TextSelection.create(tr.doc, cellCursorPos(pos, newTable, targetIdx, cellIdx)),
      );
      dispatch(tr);
    }
    return true;
  };
}

function moveTableColumn(direction: -1 | 1): Command {
  return (state, dispatch) => {
    const info = findTableAtSelection(state);
    if (!info) return false;
    const { rowIdx, cellIdx, pos, node: tableNode } = info;
    const colCount = tableNode.child(0).childCount;
    const targetIdx = cellIdx + direction;
    if (targetIdx < 0 || targetIdx >= colCount) return false;
    const schema = state.schema;
    const newRows: PMNode[] = [];
    tableNode.forEach((row) => {
      const cells: PMNode[] = [];
      row.forEach((cell) => cells.push(cell));
      const swapped = cells[cellIdx];
      cells[cellIdx] = cells[targetIdx]!;
      cells[targetIdx] = swapped!;
      newRows.push(schema.nodes.table_row.create(null, cells));
    });
    if (dispatch) {
      const newTable = schema.nodes.table.create(null, newRows);
      const tr = state.tr.replaceWith(pos, pos + tableNode.nodeSize, newTable);
      tr.setSelection(
        TextSelection.create(tr.doc, cellCursorPos(pos, newTable, rowIdx, targetIdx)),
      );
      dispatch(tr);
    }
    return true;
  };
}

export const table: FeatureSpec = {
  name: "table",

  nodes: {
    table: {
      group: "block",
      content: "table_row+",
      defining: true,
      isolating: true,
      parseDOM: [{ tag: "table" }],
      toDOM: () => ["table", ["tbody", 0]],
    },
    table_row: {
      content: "table_cell+",
      parseDOM: [{ tag: "tr" }],
      toDOM: () => ["tr", 0],
    },
    table_cell: {
      content: "inline*",
      attrs: {
        header: { default: false },
        align: { default: null },
      },
      isolating: true,
      parseDOM: [
        {
          tag: "th",
          getAttrs: (el) => ({
            header: true,
            align: parseAlignFromStyle((el as HTMLElement).getAttribute("style")),
          }),
        },
        {
          tag: "td",
          getAttrs: (el) => ({
            header: false,
            align: parseAlignFromStyle((el as HTMLElement).getAttribute("style")),
          }),
        },
      ],
      toDOM: (node) => {
        const tag = node.attrs.header ? "th" : "td";
        const align = node.attrs.align as string | null;
        const attrs = align ? { style: `text-align:${align}` } : {};
        return [tag, attrs, 0];
      },
    },
  },

  mdItPlugins: [(md) => md.enable("table")],

  plugins: () => [tableToolbarPlugin()],

  keymap: (schema: Schema) => ({
    "Alt-Mod-t": (_state, _dispatch, view) => {
      if (view) {
        showTableInsertPicker(view);
        return true;
      }
      return false;
    },
    "Alt-ArrowUp": moveTableRow(-1),
    "Alt-ArrowDown": moveTableRow(1),
    "Alt-ArrowLeft": moveTableColumn(-1),
    "Alt-ArrowRight": moveTableColumn(1),
    "Mod-Ctrl-ArrowUp": moveTableRow(-1),
    "Mod-Ctrl-ArrowDown": moveTableRow(1),
    "Mod-Ctrl-ArrowLeft": moveTableColumn(-1),
    "Mod-Ctrl-ArrowRight": moveTableColumn(1),
    "Alt-Mod-ArrowUp": moveTableRow(-1),
    "Alt-Mod-ArrowDown": moveTableRow(1),
    "Alt-Mod-ArrowLeft": moveTableColumn(-1),
    "Alt-Mod-ArrowRight": moveTableColumn(1),

    // Cell navigation. Tab / Shift-Tab move the cursor row-major; at the
    // boundary (last/first cell) the keystroke is consumed but the
    // selection is unchanged — that matches Typora and avoids letting
    // browser focus escape the table.
    Tab: tabCellNav(1),
    "Shift-Tab": tabCellNav(-1),

    // Cmd/Ctrl-Enter inside a cell: insert an empty row below the
    // current one. New cells inherit the column's `align` from the
    // header row.
    "Mod-Enter": (state, _dispatch, view) => {
      const info = findTableAtSelection(state);
      if (!info || !view) return false;
      insertTableRowAt(view, info, "below");
      return true;
    },

    // Cmd/Ctrl-Shift-Backspace inside a cell: delete the current row.
    // No-op (but consumed) when the table has a single row left.
    "Mod-Shift-Backspace": (state, _dispatch, view) => {
      const info = findTableAtSelection(state);
      if (!info) return false;
      if (info.node.childCount <= 1) return true;
      if (view) deleteTableRowAt(view, info);
      return true;
    },

    // Live trigger: a paragraph whose text is exactly `|c1|c2|...|`
    // (≥ 2 cells, leading + trailing pipes) commits to a table on Enter.
    // Cells split on `|`; first and last segments (empty by construction)
    // are dropped; middle segments — including empty ones — become cells
    // verbatim (trimmed).
    Enter: (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $from = sel.$from;
      if ($from.parent.type.name !== "paragraph") return false;
      const text = $from.parent.textContent;
      if (!/^\|.+\|$/.test(text)) return false;
      const parts = text.split("|");
      // Leading + trailing `|` always produce empty first/last entries.
      const cells = parts.slice(1, -1).map((c) => c.trim());
      if (cells.length < 2) return false;

      if (dispatch) {
        const headerRow = schema.nodes.table_row.create(
          null,
          cells.map((c) =>
            schema.nodes.table_cell.create(
              { header: true, align: null },
              c ? [schema.text(c)] : [],
            ),
          ),
        );
        const bodyRow = schema.nodes.table_row.create(
          null,
          cells.map(() =>
            schema.nodes.table_cell.create(
              { header: false, align: null },
              [],
            ),
          ),
        );
        const tableNode = schema.nodes.table.create(null, [headerRow, bodyRow]);

        const paraStart = $from.before();
        const paraEnd = $from.after();
        const tr = state.tr;
        tr.replaceWith(paraStart, paraEnd, tableNode);
        // Cursor inside first body cell. Position: paraStart (= table
        // start) + 1 (table open) + headerRow.nodeSize + 1 (body row open)
        // + 1 (first cell open).
        const firstBodyCell = paraStart + 1 + headerRow.nodeSize + 2;
        tr.setSelection(TextSelection.create(tr.doc, firstBodyCell));
        dispatch(tr);
      }
      return true;
    },
  }),

  parserTokens: {
    table_open: (state, _tok, schema) => {
      state.openNode(schema.nodes.table);
    },
    table_close: (state) => {
      state.closeNode();
    },
    // thead/tbody are wrappers in md-it but our schema is flat — skip them.
    thead_open: () => { },
    thead_close: () => { },
    tbody_open: () => { },
    tbody_close: () => { },
    tr_open: (state, _tok, schema) => {
      state.openNode(schema.nodes.table_row);
    },
    tr_close: (state) => {
      state.closeNode();
    },
    th_open: (state, tok, schema) => {
      const align = parseAlignFromStyle(tok.attrGet("style"));
      state.openNode(schema.nodes.table_cell, { header: true, align });
    },
    th_close: (state) => {
      state.closeNode();
    },
    td_open: (state, tok, schema) => {
      const align = parseAlignFromStyle(tok.attrGet("style"));
      state.openNode(schema.nodes.table_cell, { header: false, align });
    },
    td_close: (state) => {
      state.closeNode();
    },
  },

  blockHandlers: {
    table: (state, node) => {
      for (const [idx, line] of tableNodeToMarkdown(node).split("\n").entries()) {
        if (idx > 0) {
          state.out += "\n";
          if (state.delim) state.out += state.delim;
        }
        state.write(line);
      }
      state.closeBlock(node);
    },
  },

};
