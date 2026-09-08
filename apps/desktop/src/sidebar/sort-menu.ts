import { t } from "../i18n/index.ts";
import type { MenuController, MenuItemOptions } from "../ui/widgets/menu.ts";

export type SortOption<M extends string> = {
  mode: M;
  labelKey: string;
};

export type BookmarkGroupSortMode = "order" | "name-asc" | "name-desc";
export type BookmarkItemSortMode =
  | "name-asc"
  | "name-desc"
  | "added-desc"
  | "added-asc";

export const BOOKMARKS_GROUP_SORT_KEY = "inimark-bookmarks-group-sort";
export const BOOKMARKS_ITEM_SORT_KEY = "inimark-bookmarks-item-sort";

export const BOOKMARK_GROUP_SORT_OPTIONS: Array<SortOption<BookmarkGroupSortMode>> = [
  { mode: "order", labelKey: "sidebar.bookmarks.sort.groupOrder" },
  { mode: "name-asc", labelKey: "sidebar.sort.nameAsc" },
  { mode: "name-desc", labelKey: "sidebar.sort.nameDesc" },
];

export const BOOKMARK_ITEM_SORT_OPTIONS: Array<SortOption<BookmarkItemSortMode>> = [
  { mode: "name-asc", labelKey: "sidebar.sort.nameAsc" },
  { mode: "name-desc", labelKey: "sidebar.sort.nameDesc" },
  { mode: "added-desc", labelKey: "sidebar.bookmarks.sort.addedDesc" },
  { mode: "added-asc", labelKey: "sidebar.bookmarks.sort.addedAsc" },
];

export function loadSortMode<M extends string>(
  storageKey: string,
  options: Array<SortOption<M>>,
  fallback: M,
): M {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && options.some((opt) => opt.mode === saved)) {
      return saved as M;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveSortMode(storageKey: string, mode: string): void {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    /* ignore */
  }
}

export function sortOptionLabel<M extends string>(
  options: Array<SortOption<M>>,
  mode: M,
  fallbackKey = "sidebar.toolbar.sort",
): string {
  const option = options.find((opt) => opt.mode === mode);
  return option ? t(option.labelKey) : t(fallbackKey);
}

export function checkedSortMenuItems<M extends string>(
  options: Array<SortOption<M>>,
  current: M,
  onSelect: (mode: M) => void,
): MenuItemOptions[] {
  return options.map((option) => ({
    label: t(option.labelKey),
    checked: current === option.mode,
    onClick() {
      onSelect(option.mode);
    },
  }));
}

/** Fill a flat checked sort menu, inserting dividers before the given option indexes. */
export function fillCheckedSortMenu<M extends string>(
  menu: MenuController,
  options: Array<SortOption<M>>,
  current: M,
  onSelect: (mode: M) => void,
  dividersAt: number[] = [],
): void {
  menu.clear();
  menu.setPath("");
  options.forEach((option, index) => {
    if (dividersAt.includes(index)) menu.addDivider();
    menu.addItem({
      label: t(option.labelKey),
      checked: current === option.mode,
      onClick() {
        onSelect(option.mode);
      },
    });
  });
}

export function positionMenuBelowAnchor(
  anchor: HTMLElement,
  menuEl: HTMLElement,
  minWidth = 184,
): void {
  const rect = anchor.getBoundingClientRect();
  const menuWidth = Math.max(minWidth, menuEl.offsetWidth || minWidth);
  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - menuWidth - 8,
  );
  menuEl.style.top = `${rect.bottom + 4}px`;
  menuEl.style.left = `${left}px`;
}

export function compareByName(a: string, b: string, descending = false): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return descending ? -cmp : cmp;
}
