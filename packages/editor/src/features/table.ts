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

// Precompute the inline serialization of a cell — needed twice (column
// width measurement, then actual emission). We render via the same
// inline serializer the rest of the doc uses, but into a sandbox so
// pmPos/markers from the outer state don't leak.
// ---------------- toolbar plugin ----------------
//
// Floating toolbar shown when the cursor is inside a table. Carries:
//   * resize trigger (田字格 icon) → opens a popup with a hover-grid
//     and numeric R × C inputs to resize the table.
//   * 3 align buttons → set `align` on every cell in the cursor's
//     current column.
//   * trash → delete the whole table (replaced by an empty paragraph).
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
  root.className = "table-toolbar inimark-glass";

  const grid = document.createElement("button");
  grid.type = "button";
  grid.className = "table-tb-btn";
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
  sep.className = "table-tb-sep";

  const mkAlign = (a: "left" | "center" | "right", lines: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "table-tb-btn";
    b.title = `Align ${a}`;
    b.dataset.align = a;
    b.appendChild(svgIcon(lines));
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const info = getInfo();
      if (info) applyAlignToColumn(view, info, a);
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

  const spacer = document.createElement("span");
  spacer.className = "table-tb-spacer";

  const trash = document.createElement("button");
  trash.type = "button";
  trash.className = "table-tb-btn table-tb-trash";
  trash.title = "Delete table";
  trash.appendChild(
    svgIcon(
      `<path d='M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12'
        stroke='currentColor' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`,
    ),
  );
  trash.addEventListener("mousedown", (e) => e.preventDefault());
  trash.addEventListener("click", () => {
    const info = getInfo();
    if (info) deleteTable(view, info);
  });

  root.append(grid, sep, alignL, alignC, alignR, spacer, trash);

  // Resize popup — built once, toggled on grid click. Hover the grid
  // to highlight up to (R, C); the numeric inputs reflect the hover
  // and can be edited directly. Click the grid (or press Enter on the
  // inputs) to commit.
  //
  // Snapshot the current TableInfo when the popup opens: while the
  // popup is up, the user may interact with the popup (focusing
  // inputs, clicking grid cells) which can cause `getInfo()` to flip
  // to null mid-action. The snapshot keeps the target table stable.
  let popupSnapshot: TableInfo | null = null;
  const popup = document.createElement("div");
  popup.className = "table-resize-popup inimark-glass";
  popup.style.display = "none";
  // Block focus loss when clicking the popup background — preserves
  // editor selection so the snapshot stays valid. Inputs are exempt;
  // they need to receive focus to be typed in.
  popup.addEventListener("mousedown", (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT") e.preventDefault();
  });

  const gridEl = document.createElement("div");
  gridEl.className = "table-resize-grid";
  const MAX_R = 10;
  const MAX_C = 10;
  const cells: HTMLElement[][] = [];
  for (let r = 0; r < MAX_R; r++) {
    const row: HTMLElement[] = [];
    for (let c = 0; c < MAX_C; c++) {
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

  const setHighlight = (R: number, C: number) => {
    for (let r = 0; r < MAX_R; r++)
      for (let c = 0; c < MAX_C; c++) {
        cells[r]![c]!.classList.toggle("hover", r < R && c < C);
      }
    rIn.value = String(R);
    cIn.value = String(C);
  };
  gridEl.addEventListener("mousemove", (e) => {
    const t = (e.target as HTMLElement).closest(".table-resize-cell") as HTMLElement | null;
    if (!t) return;
    setHighlight(Number(t.dataset.r), Number(t.dataset.c));
  });

  popup.append(gridEl, inputs);

  const isPopupOpen = () => popup.style.display === "block";

  const dismissOnPointer = (event: Event) => {
    if (!isPopupOpen()) return;
    const target = event.target as Node;
    if (popup.contains(target) || grid.contains(target)) return;
    closePopup();
  };

  const dismissOnFocusIn = (event: FocusEvent) => {
    if (!isPopupOpen()) return;
    const target = event.target as Node;
    if (popup.contains(target) || grid.contains(target)) return;
    closePopup();
  };

  const closePopup = () => {
    popup.style.display = "none";
    popupSnapshot = null;
    document.removeEventListener("mousedown", dismissOnPointer, true);
    document.removeEventListener("focusin", dismissOnFocusIn, true);
  };

  const openPopup = (liveInfo: TableInfo) => {
    popupSnapshot = liveInfo;
    let R = 0;
    let C = 0;
    liveInfo.node.forEach((row) => {
      R++;
      C = Math.max(C, row.childCount);
    });
    setHighlight(Math.min(R, MAX_R), Math.min(C, MAX_C));
    const r = grid.getBoundingClientRect();
    popup.style.top = `${r.bottom + 4}px`;
    popup.style.left = `${r.left}px`;
    popup.style.display = "block";
    document.addEventListener("mousedown", dismissOnPointer, true);
    document.addEventListener("focusin", dismissOnFocusIn, true);
  };

  gridEl.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(".table-resize-cell") as HTMLElement | null;
    if (!t) return;
    const target = popupSnapshot ?? getInfo();
    if (!target) return;
    resizeTable(view, target, Number(t.dataset.r), Number(t.dataset.c));
    closePopup();
  });
  const commitInputs = () => {
    const target = popupSnapshot ?? getInfo();
    if (!target) return;
    const R = Math.max(1, Math.min(20, Number(rIn.value) || 1));
    const C = Math.max(1, Math.min(20, Number(cIn.value) || 1));
    resizeTable(view, target, R, C);
    closePopup();
  };
  rIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInputs();
    }
  });
  cIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInputs();
    }
  });

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

  return { root, popup, closePopup };
}

function tableToolbarPlugin(): Plugin {
  return new Plugin({
    view(view) {
      let info: TableInfo | null = null;
      // Lazy: toolbar DOM is only built and appended when this view is
      // both focused and on a table. Unfocused views (every case-card
      // in the harness with a table seed) never create toolbar DOM.
      let toolbar: { root: HTMLElement; popup: HTMLElement; closePopup: () => void } | null =
        null;

      const ensureMounted = () => {
        if (!toolbar) {
          toolbar = buildToolbar(view, () => info);
        }
        if (!toolbar.root.isConnected) {
          document.body.appendChild(toolbar.root);
          document.body.appendChild(toolbar.popup);
        }
        return toolbar;
      };
      const unmount = () => {
        toolbar?.closePopup();
        if (toolbar?.root.isConnected) {
          toolbar.root.remove();
          toolbar.popup.remove();
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
        tb.root.style.display = "flex";
        tb.root.style.top = `${rect.top - 32}px`;
        tb.root.style.left = `${rect.left}px`;
        // Reflect current column's align in the button states.
        const cell = info.node.child(info.rowIdx).child(info.cellIdx);
        const cur = cell.attrs.align as string | null;
        tb.root.querySelectorAll<HTMLElement>("[data-align]").forEach((b) => {
          b.classList.toggle("active", b.dataset.align === cur);
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
    "Alt-Mod-t": insertTableAtSelection(schema),
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
    "Mod-Enter": (state, dispatch) => {
      const $from = state.selection.$from;
      let cellDepth = -1;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "table_cell") {
          cellDepth = d;
          break;
        }
      }
      if (cellDepth === -1) return false;
      const tableDepth = cellDepth - 2;
      const tableNode = $from.node(tableDepth);
      const rowIdx = $from.index(tableDepth);
      const cellIdx = $from.index(cellDepth - 1);
      const colCount = tableNode.child(rowIdx).childCount;
      if (dispatch) {
        const headerRow = tableNode.child(0);
        const newCells: PMNode[] = [];
        for (let c = 0; c < colCount; c++) {
          const align = (headerRow.child(c)?.attrs.align as string | null) ?? null;
          newCells.push(
            schema.nodes.table_cell.create({ header: false, align }, []),
          );
        }
        const newRow = schema.nodes.table_row.create(null, newCells);
        const tableStart = $from.before(tableDepth);
        let insertAt = tableStart + 1;
        for (let r = 0; r <= rowIdx; r++) insertAt += tableNode.child(r).nodeSize;
        const tr = state.tr.insert(insertAt, newRow);
        // Cursor inside the new row at the same column index.
        let cursorPos = insertAt + 1; // inside row
        for (let c = 0; c < cellIdx; c++) cursorPos += newRow.child(c).nodeSize;
        cursorPos += 1; // inside cell
        tr.setSelection(TextSelection.create(tr.doc, cursorPos));
        dispatch(tr);
      }
      return true;
    },

    // Cmd/Ctrl-Shift-Backspace inside a cell: delete the current row.
    // No-op (but consumed) when the table has a single row left.
    "Mod-Shift-Backspace": (state, dispatch) => {
      const $from = state.selection.$from;
      let cellDepth = -1;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "table_cell") {
          cellDepth = d;
          break;
        }
      }
      if (cellDepth === -1) return false;
      const tableDepth = cellDepth - 2;
      const tableNode = $from.node(tableDepth);
      const rowIdx = $from.index(tableDepth);
      const cellIdx = $from.index(cellDepth - 1);
      if (tableNode.childCount <= 1) return true; // consume, no-op
      if (dispatch) {
        const tableStart = $from.before(tableDepth);
        let rowStart = tableStart + 1;
        for (let r = 0; r < rowIdx; r++) rowStart += tableNode.child(r).nodeSize;
        const row = tableNode.child(rowIdx);
        const tr = state.tr.delete(rowStart, rowStart + row.nodeSize);
        // Cursor → adjacent row, same column. Prefer next row (same
        // index in the post-delete table); fall back to previous when
        // we deleted the last row.
        const newTable = tr.doc.nodeAt(tableStart)!;
        const targetRowIdx = Math.min(rowIdx, newTable.childCount - 1);
        let cursorPos = tableStart + 1;
        for (let r = 0; r < targetRowIdx; r++)
          cursorPos += newTable.child(r).nodeSize;
        cursorPos += 1; // inside row
        const targetRow = newTable.child(targetRowIdx);
        const targetCol = Math.min(cellIdx, targetRow.childCount - 1);
        for (let c = 0; c < targetCol; c++) cursorPos += targetRow.child(c).nodeSize;
        cursorPos += 1; // inside cell
        tr.setSelection(TextSelection.create(tr.doc, cursorPos));
        dispatch(tr);
      }
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
      // Render every cell first so we can measure column widths and
      // emit nicely padded source on save. Two-pass (measure → emit).
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
      for (const r of rows)
        for (let i = 0; i < colCount; i++)
          widths[i] = Math.max(widths[i]!, (r[i] ?? "").length);

      const formatRow = (cells: string[]): string => {
        const padded = cells.map((c, i) => " " + c.padEnd(widths[i]!) + " ");
        return "|" + padded.join("|") + "|";
      };
      const dividerRow = (): string => {
        const dividers = aligns.map((a, i) => " " + alignDelim(a, widths[i]!) + " ");
        return "|" + dividers.join("|") + "|";
      };

      // Header row → divider → body rows.
      state.write(formatRow(rows[0] ?? []));
      state.out += "\n";
      if (state.delim) state.out += state.delim;
      state.out += dividerRow();
      for (let i = 1; i < rows.length; i++) {
        state.out += "\n";
        if (state.delim) state.out += state.delim;
        state.out += formatRow(rows[i]!);
      }
      state.closeBlock(node);
    },
  },

};
