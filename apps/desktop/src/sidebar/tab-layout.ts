import { t } from "../i18n/index.ts";
import {
  bookmarksTabIcon,
  filesTabIcon,
  graphTabIcon,
  outlineTabIcon,
  searchTabIcon,
} from "../ui/widgets/index.ts";

export const ALL_SIDEBAR_TABS = [
  "files",
  "search",
  "bookmarks",
  "outline",
  "graph",
] as const;

export type SidebarTabId = (typeof ALL_SIDEBAR_TABS)[number];

export const DEFAULT_LEFT_SIDEBAR_TABS: SidebarTabId[] = [
  "files",
  "search",
  "bookmarks",
];

export const DEFAULT_RIGHT_SIDEBAR_TABS: SidebarTabId[] = ["outline", "graph"];

export interface SidebarTabLayout {
  left: SidebarTabId[];
  right: SidebarTabId[];
}

const TAB_SET = new Set<string>(ALL_SIDEBAR_TABS);

export function isSidebarTabId(value: unknown): value is SidebarTabId {
  return typeof value === "string" && TAB_SET.has(value);
}

export function sidebarTabIcon(id: SidebarTabId): string {
  switch (id) {
    case "files":
      return filesTabIcon();
    case "search":
      return searchTabIcon();
    case "bookmarks":
      return bookmarksTabIcon();
    case "outline":
      return outlineTabIcon();
    case "graph":
      return graphTabIcon();
  }
}

export function sidebarTabLabel(id: SidebarTabId): string {
  switch (id) {
    case "files":
      return t("sidebar.tabs.files");
    case "search":
      return t("sidebar.tabs.search");
    case "bookmarks":
      return t("sidebar.tabs.bookmarks");
    case "outline":
      return t("outline.tab");
    case "graph":
      return t("graph.tab");
  }
}

/** Ensure every tab appears exactly once across left + right. */
export function normalizeSidebarTabLayout(
  left: unknown,
  right: unknown,
): SidebarTabLayout {
  const seen = new Set<SidebarTabId>();
  const nextLeft: SidebarTabId[] = [];
  const nextRight: SidebarTabId[] = [];

  const take = (raw: unknown, target: SidebarTabId[]) => {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      if (!isSidebarTabId(item) || seen.has(item)) continue;
      seen.add(item);
      target.push(item);
    }
  };

  take(left, nextLeft);
  take(right, nextRight);

  for (const id of ALL_SIDEBAR_TABS) {
    if (seen.has(id)) continue;
    if (DEFAULT_LEFT_SIDEBAR_TABS.includes(id)) nextLeft.push(id);
    else nextRight.push(id);
  }

  return { left: nextLeft, right: nextRight };
}
