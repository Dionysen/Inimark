import "../styles/bookmark-dialog.css";
import { t } from "../i18n/index.ts";
import {
  getLibraryBookmarks,
  groupDisplayName,
  setBookmarkGroupCollapsed,
  type BookmarkItem,
  type LibraryBookmarks,
} from "../bookmarks/store.ts";
import { fileNameFromPath } from "../platform/env.ts";

const CHEVRON = `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FILE_ICON = `<svg viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2v6h6"/></svg>`;

export interface BookmarksPanelHandlers {
  onOpenItem(item: BookmarkItem): void;
  onItemContextMenu(event: MouseEvent, item: BookmarkItem): void;
  onGroupContextMenu?(event: MouseEvent, groupId: string): void;
}

export interface BookmarksPanelController {
  el: HTMLElement;
  render(libraryId: string | null, activePath: string | null): void;
  destroy(): void;
}

export function createBookmarksPanel(
  handlers: BookmarksPanelHandlers,
): BookmarksPanelController {
  const el = document.createElement("div");
  el.className = "inimark-bookmarks-host inimark-scrollbar";
  el.setAttribute("role", "navigation");
  el.setAttribute("aria-label", t("sidebar.tabs.bookmarks"));

  function renderEmpty(): void {
    el.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "inimark-sidebar-empty";
    empty.textContent = t("sidebar.empty.noBookmarks");
    el.append(empty);
  }

  function renderList(
    libraryId: string,
    data: LibraryBookmarks,
    activePath: string | null,
  ): void {
    el.replaceChildren();
    const defaultLabel = t("sidebar.bookmarks.defaultGroup");

    for (const group of data.groups) {
      const items = data.items
        .filter((item) => item.groupId === group.id)
        .sort((a, b) =>
          fileNameFromPath(a.path).localeCompare(
            fileNameFromPath(b.path),
            undefined,
            { sensitivity: "base" },
          ),
        );

      // Hide empty custom groups; always show default when any bookmarks exist.
      if (items.length === 0 && data.items.length > 0) continue;
      if (items.length === 0) continue;

      const collapsed = data.collapsedGroupIds.includes(group.id);
      const section = document.createElement("section");
      section.className = "inimark-bookmarks-group";
      section.dataset.groupId = group.id;

      const header = document.createElement("button");
      header.type = "button";
      header.className = "inimark-bookmarks-group-header";
      header.setAttribute("aria-expanded", String(!collapsed));

      const chevron = document.createElement("span");
      chevron.className = `inimark-bookmarks-group-chevron${collapsed ? "" : " is-expanded"}`;
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = CHEVRON;

      const title = document.createElement("span");
      title.className = "inimark-bookmarks-group-title";
      title.textContent = groupDisplayName(group, defaultLabel);

      const count = document.createElement("span");
      count.className = "inimark-bookmarks-group-count";
      count.textContent = String(items.length);

      header.append(chevron, title, count);
      header.addEventListener("click", () => {
        setBookmarkGroupCollapsed(libraryId, group.id, !collapsed);
        render(libraryId, activePath);
      });
      header.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handlers.onGroupContextMenu?.(event, group.id);
      });

      section.append(header);

      if (!collapsed) {
        const list = document.createElement("div");
        list.className = "inimark-bookmarks-items";
        for (const item of items) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "inimark-bookmarks-item";
          row.dataset.path = item.path;
          row.title = item.path;
          if (item.path === activePath) row.classList.add("is-active");

          const kind = document.createElement("span");
          kind.className = "inimark-bookmarks-item-kind";
          kind.setAttribute("aria-hidden", "true");
          kind.innerHTML = FILE_ICON;

          const label = document.createElement("span");
          label.className = "inimark-bookmarks-item-label";
          label.textContent = fileNameFromPath(item.path);

          const parent = item.path.includes("/")
            ? item.path.slice(0, item.path.lastIndexOf("/"))
            : "";
          row.append(kind, label);
          if (parent) {
            const meta = document.createElement("span");
            meta.className = "inimark-bookmarks-item-meta";
            meta.textContent = parent;
            row.append(meta);
          }

          row.addEventListener("click", () => handlers.onOpenItem(item));
          row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handlers.onItemContextMenu(event, item);
          });
          list.append(row);
        }
        section.append(list);
      }

      el.append(section);
    }

    if (el.childElementCount === 0) renderEmpty();
  }

  function render(libraryId: string | null, activePath: string | null): void {
    el.setAttribute("aria-label", t("sidebar.tabs.bookmarks"));
    if (!libraryId) {
      renderEmpty();
      return;
    }
    const data = getLibraryBookmarks(libraryId);
    if (data.items.length === 0) {
      renderEmpty();
      return;
    }
    renderList(libraryId, data, activePath);
  }

  return {
    el,
    render,
    destroy() {
      el.replaceChildren();
      el.remove();
    },
  };
}
