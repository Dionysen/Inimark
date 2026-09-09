import type { WikiLinkBridge, WikiNoteHit } from "../wiki-link-bridge.ts";

export const WIKI_AUTOCOMPLETE_RECENT_COUNT = 5;
export const WIKI_AUTOCOMPLETE_MAX_FILTERED = 50;
export const WIKI_AUTOCOMPLETE_ROW_HEIGHT = 30;
export const WIKI_AUTOCOMPLETE_HEADING_HEIGHT = 22;
const OVERSCAN = 4;

type DisplayRow =
  | { kind: "heading"; label: string }
  | { kind: "note"; hit: WikiNoteHit; selectableIndex: number };

function rowHeight(row: DisplayRow): number {
  return row.kind === "heading"
    ? WIKI_AUTOCOMPLETE_HEADING_HEIGHT
    : WIKI_AUTOCOMPLETE_ROW_HEIGHT;
}

export function buildDisplayRows(
  matches: WikiNoteHit[],
  recentCount: number,
  filtered: boolean,
): DisplayRow[] {
  if (filtered) {
    return matches.map((hit, i) => ({
      kind: "note",
      hit,
      selectableIndex: i,
    }));
  }

  const rows: DisplayRow[] = [];
  if (recentCount > 0) {
    rows.push({ kind: "heading", label: "最近" });
    for (let i = 0; i < recentCount; i++) {
      const hit = matches[i];
      if (!hit) break;
      rows.push({ kind: "note", hit, selectableIndex: i });
    }
  }
  if (matches.length > recentCount) {
    rows.push({ kind: "heading", label: "全部" });
    for (let i = recentCount; i < matches.length; i++) {
      const hit = matches[i];
      if (!hit) break;
      rows.push({ kind: "note", hit, selectableIndex: i });
    }
  }
  return rows;
}

function totalHeight(rows: DisplayRow[]): number {
  let height = 0;
  for (const row of rows) height += rowHeight(row);
  return height;
}

function offsetOfRow(rows: DisplayRow[], index: number): number {
  let y = 0;
  for (let i = 0; i < index; i++) y += rowHeight(rows[i]!);
  return y;
}

function offsetOfSelectable(rows: DisplayRow[], selected: number): number | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "note" && row.selectableIndex === selected) {
      return offsetOfRow(rows, i);
    }
  }
  return null;
}

function createNoteRow(hit: WikiNoteHit, index: number): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "inimark-menu-item wiki-link-autocomplete__row";
  row.setAttribute("role", "menuitem");
  row.dataset.index = String(index);

  const content = document.createElement("span");
  content.className = "inimark-menu-item__content";

  const basename = hit.name.split("/").pop() || hit.name;
  const nameRow = document.createElement("span");
  nameRow.className = "inimark-menu-item__name-row";
  const nameEl = document.createElement("span");
  nameEl.className = "inimark-menu-item__name";
  nameEl.textContent = basename;
  nameRow.append(nameEl);
  content.append(nameRow);

  if (hit.name !== basename) {
    const meta = document.createElement("span");
    meta.className = "inimark-menu-item__meta";
    meta.textContent = hit.name;
    content.append(meta);
  }

  row.append(content);
  return row;
}

function renderDisplayRow(row: DisplayRow): HTMLElement {
  if (row.kind === "heading") {
    const heading = document.createElement("div");
    heading.className = "inimark-menu__heading wiki-link-autocomplete__heading";
    heading.textContent = row.label;
    return heading;
  }
  const btn = createNoteRow(row.hit, row.selectableIndex);
  return btn;
}

export function resolveWikiAutocompleteMatches(
  bridge: WikiLinkBridge,
  partial: string,
): { matches: WikiNoteHit[]; recentCount: number } {
  const q = partial.trim();
  if (q) {
    return {
      matches: bridge.searchNotes(q, WIKI_AUTOCOMPLETE_MAX_FILTERED),
      recentCount: 0,
    };
  }
  const recent = bridge.recentNotes?.(WIKI_AUTOCOMPLETE_RECENT_COUNT) ?? [];
  const recentNames = new Set(recent.map((r) => r.name));
  const rest = bridge
    .searchNotes("", undefined)
    .filter((note) => !recentNames.has(note.name));
  return { matches: [...recent, ...rest], recentCount: recent.length };
}

export class WikiAutocompletePopup {
  readonly el: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly spacer: HTMLDivElement;
  private readonly windowEl: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private readonly onPick: (index: number) => void;

  private rows: DisplayRow[] = [];
  private selected = 0;
  private scrollListener: (() => void) | null = null;

  constructor(onPick: (index: number) => void) {
    this.onPick = onPick;

    this.el = document.createElement("div");
    this.el.className =
      "inimark-menu inimark-glass wiki-link-autocomplete is-open";
    this.el.setAttribute("contenteditable", "false");
    this.el.setAttribute("role", "menu");
    this.el.addEventListener("mousedown", (event) => event.preventDefault());

    this.viewport = document.createElement("div");
    this.viewport.className =
      "wiki-link-autocomplete__viewport inimark-scrollbar";

    this.spacer = document.createElement("div");
    this.spacer.className = "wiki-link-autocomplete__spacer";

    this.windowEl = document.createElement("div");
    this.windowEl.className = "wiki-link-autocomplete__window";
    this.spacer.append(this.windowEl);
    this.viewport.append(this.spacer);

    this.emptyEl = document.createElement("div");
    this.emptyEl.className = "inimark-menu__empty";
    this.emptyEl.hidden = true;

    this.el.append(this.viewport, this.emptyEl);

    this.scrollListener = () => this.paintVirtualRows();
    this.viewport.addEventListener("scroll", this.scrollListener, { passive: true });

    this.el.addEventListener("mousedown", (event) => {
      const item = (event.target as HTMLElement | null)?.closest(
        ".inimark-menu-item",
      ) as HTMLElement | null;
      if (!item) return;
      const idx = Number(item.dataset.index);
      if (Number.isNaN(idx)) return;
      event.preventDefault();
      this.onPick(idx);
    });
  }

  setItems(matches: WikiNoteHit[], recentCount: number, partial: string): void {
    const filtered = partial.trim().length > 0;
    this.rows = buildDisplayRows(matches, recentCount, filtered);
    this.renderEmpty(partial, matches.length > 0);
    this.updateSpacer();
    this.paintVirtualRows();
    this.updateSelectionHighlight();
  }

  setSelected(index: number): void {
    this.selected = index;
    this.updateSelectionHighlight();
    this.scrollSelectedIntoView();
  }

  destroy(): void {
    if (this.scrollListener) {
      this.viewport.removeEventListener("scroll", this.scrollListener);
      this.scrollListener = null;
    }
    this.el.remove();
  }

  private renderEmpty(partial: string, hasMatches: boolean): void {
    if (hasMatches) {
      this.emptyEl.hidden = true;
      this.viewport.hidden = false;
      return;
    }
    this.viewport.hidden = true;
    this.emptyEl.hidden = false;
    this.emptyEl.textContent = partial
      ? `Create “${partial}”`
      : "No notes found";
  }

  private updateSpacer(): void {
    this.spacer.style.height = `${totalHeight(this.rows)}px`;
  }

  private paintVirtualRows(): void {
    if (this.rows.length === 0) {
      this.windowEl.replaceChildren();
      return;
    }

    const scrollTop = this.viewport.scrollTop;
    const viewHeight = this.viewport.clientHeight || 1;
    const endOffset = scrollTop + viewHeight + OVERSCAN * WIKI_AUTOCOMPLETE_ROW_HEIGHT;

    let y = 0;
    let start = 0;
    for (let i = 0; i < this.rows.length; i++) {
      const h = rowHeight(this.rows[i]!);
      if (y + h > scrollTop - OVERSCAN * WIKI_AUTOCOMPLETE_ROW_HEIGHT) {
        start = i;
        break;
      }
      y += h;
    }

    this.windowEl.style.transform = `translateY(${y}px)`;
    this.windowEl.replaceChildren();

    for (let i = start; i < this.rows.length; i++) {
      const row = this.rows[i]!;
      const h = rowHeight(row);
      if (y > endOffset) break;

      const el = renderDisplayRow(row);
      if (row.kind === "note" && row.selectableIndex === this.selected) {
        el.classList.add("is-active");
      }
      if (row.kind === "heading") {
        el.style.height = `${h}px`;
      }
      this.windowEl.append(el);
      y += h;
    }
  }

  private updateSelectionHighlight(): void {
    const buttons = this.el.querySelectorAll<HTMLButtonElement>(".inimark-menu-item");
    for (const btn of buttons) {
      const idx = Number(btn.dataset.index);
      btn.classList.toggle("is-active", idx === this.selected);
    }
  }

  private scrollSelectedIntoView(): void {
    const top = offsetOfSelectable(this.rows, this.selected);
    if (top == null) return;

    const bottom = top + WIKI_AUTOCOMPLETE_ROW_HEIGHT;
    const { scrollTop, clientHeight } = this.viewport;
    if (top < scrollTop) {
      this.viewport.scrollTop = top;
    } else if (bottom > scrollTop + clientHeight) {
      this.viewport.scrollTop = bottom - clientHeight;
    }
    this.paintVirtualRows();
  }
}
