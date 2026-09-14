import { onLocaleChange, t } from "../i18n/index.ts";
import { fileNameFromPath, parentDirFromPath } from "../platform/env.ts";
import {
  collapseAllIcon,
  createMenu,
  createPanelToolbar,
  expandAllIcon,
  searchTabIcon,
  sortIcon,
  treeFileIcon,
} from "../ui/widgets/index.ts";
import { createSearchField } from "../ui/widgets/search-field.ts";
import {
  tagIndex,
  type TagEntry,
  type TagSortMode,
} from "../tags/index.ts";
import "../styles/tags-panel.css";

const SORT_KEY = "inimark-tags-sort";
const CHEVRON = `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SORT_OPTIONS: Array<{ mode: TagSortMode; labelKey: string }> = [
  { mode: "name-asc", labelKey: "tags.sort.nameAsc" },
  { mode: "name-desc", labelKey: "tags.sort.nameDesc" },
  { mode: "count-desc", labelKey: "tags.sort.countDesc" },
  { mode: "count-asc", labelKey: "tags.sort.countAsc" },
];

export interface TagsPanelController {
  el: HTMLElement;
  setActiveFile(path: string | null): void;
  refresh(): void;
  onOpenFile(handler: (path: string) => void): void;
  destroy(): void;
}

function loadSortMode(): TagSortMode {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (
      saved === "name-asc" ||
      saved === "name-desc" ||
      saved === "count-asc" ||
      saved === "count-desc"
    ) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return "name-asc";
}

function noteLabel(path: string): string {
  return fileNameFromPath(path).replace(/\.(md|markdown|mdown)$/i, "");
}

/**
 * Tags sidebar panel: tag → notes tree with sort, expand/collapse, and filter.
 */
export function mountTagsPanel(host: HTMLElement): TagsPanelController {
  host.classList.add("inimark-sidebar-panel", "inimark-tags-panel");
  host.replaceChildren();

  let sortMode = loadSortMode();
  let activePath: string | null = null;
  let searchOpen = false;
  let query = "";
  const expanded = new Set<string>();
  let onOpen: (path: string) => void = () => {};
  let renderTimer: ReturnType<typeof setTimeout> | null = null;
  let renderRaf = 0;
  let renderDirty = false;

  function isPanelVisible(): boolean {
    return !host.hidden;
  }

  /** Coalesce index updates; skip work while the tab is hidden. */
  function scheduleRerender(): void {
    renderDirty = true;
    if (!isPanelVisible()) return;
    if (renderTimer != null) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      if (renderRaf) cancelAnimationFrame(renderRaf);
      renderRaf = requestAnimationFrame(() => {
        renderRaf = 0;
        if (!renderDirty) return;
        if (!isPanelVisible()) return;
        renderDirty = false;
        rerender();
      });
    }, 50);
  }

  function rerenderNow(): void {
    if (renderTimer != null) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }
    if (renderRaf) {
      cancelAnimationFrame(renderRaf);
      renderRaf = 0;
    }
    renderDirty = false;
    rerender();
  }

  const sortMenu = createMenu();
  sortMenu.el.classList.add("inimark-tags-sort-menu");
  sortMenu.setPath("");

  const toolbar = createPanelToolbar([
    {
      label: t("tags.toolbar.sort"),
      title: t("tags.toolbar.sort"),
      icon: sortIcon,
      onClick(event) {
        event.stopPropagation();
        toggleSortMenu();
      },
    },
    {
      label: t("tags.toolbar.collapseAll"),
      title: t("tags.toolbar.collapseAll"),
      icon: collapseAllIcon,
      onClick() {
        closeSortMenu();
        if (hasAnyExpanded()) collapseAll();
        else expandAll();
      },
    },
    {
      label: t("tags.toolbar.search"),
      title: t("tags.toolbar.search"),
      icon: searchTabIcon,
      onClick() {
        closeSortMenu();
        searchOpen = !searchOpen;
        if (!searchOpen) {
          query = "";
          searchField.setValue("");
        }
        syncSearchChrome();
        rerender();
        if (searchOpen) searchField.focus();
      },
    },
  ]);

  const sortBtn = toolbar.buttons[0]!;
  const expandCollapseBtn = toolbar.buttons[1]!;
  const searchToggleBtn = toolbar.buttons[2]!;
  sortBtn.setAttribute("aria-haspopup", "menu");
  sortBtn.setAttribute("aria-expanded", "false");
  searchToggleBtn.setAttribute("aria-pressed", "false");

  const searchWrap = document.createElement("div");
  searchWrap.className = "inimark-tags-search";
  searchWrap.hidden = true;
  const searchField = createSearchField({
    placeholder: t("tags.searchPlaceholder"),
    onInput(value) {
      query = value.trim().toLowerCase();
      rerender();
    },
  });
  searchWrap.append(searchField.el);

  const listHost = document.createElement("div");
  listHost.className = "inimark-tags-host inimark-scrollbar";
  listHost.setAttribute("role", "navigation");
  listHost.setAttribute("aria-label", t("tags.tab"));

  host.append(toolbar.el, searchWrap, listHost);
  document.body.append(sortMenu.el);
  sortMenu.setDismissAnchors([sortBtn]);

  function closeSortMenu(): void {
    sortMenu.setOpen(false);
    sortBtn.setAttribute("aria-expanded", "false");
  }

  function positionSortMenu(): void {
    const rect = sortBtn.getBoundingClientRect();
    const menuWidth = Math.max(160, sortMenu.el.offsetWidth || 160);
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - menuWidth / 2),
      window.innerWidth - menuWidth - 8,
    );
    sortMenu.el.style.top = `${rect.bottom + 4}px`;
    sortMenu.el.style.left = `${left}px`;
    sortMenu.el.style.width = `${menuWidth}px`;
  }

  function renderSortMenu(): void {
    sortMenu.clear();
    sortMenu.setPath("");
    for (const option of SORT_OPTIONS) {
      sortMenu.addItem({
        label: t(option.labelKey),
        checked: sortMode === option.mode,
        onClick() {
          sortMode = option.mode;
          try {
            localStorage.setItem(SORT_KEY, sortMode);
          } catch {
            /* ignore */
          }
          closeSortMenu();
          rerender();
        },
      });
    }
  }

  function toggleSortMenu(): void {
    if (sortMenu.isOpen()) {
      closeSortMenu();
      return;
    }
    renderSortMenu();
    sortMenu.setOpen(true);
    sortBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => positionSortMenu());
  }

  function syncSearchChrome(): void {
    searchWrap.hidden = !searchOpen;
    searchToggleBtn.setAttribute("aria-pressed", String(searchOpen));
    searchToggleBtn.classList.toggle("is-active", searchOpen);
  }

  function syncExpandButton(entries: TagEntry[]): void {
    const expandable = entries.filter((e) => e.files.length > 0);
    const anyExpanded = expandable.some((e) => expanded.has(e.name));
    const label = anyExpanded
      ? t("tags.toolbar.collapseAll")
      : t("tags.toolbar.expandAll");
    expandCollapseBtn.title = label;
    expandCollapseBtn.setAttribute("aria-label", label);
    expandCollapseBtn.innerHTML = anyExpanded ? collapseAllIcon() : expandAllIcon();
  }

  function hasAnyExpanded(): boolean {
    const entries = visibleEntries();
    return entries.some((e) => e.files.length > 0 && expanded.has(e.name));
  }

  function collapseAll(): void {
    expanded.clear();
    rerender();
  }

  function expandAll(): void {
    for (const entry of tagIndex.listTags(sortMode)) {
      if (entry.files.length > 0) expanded.add(entry.name);
    }
    rerender();
  }

  function visibleEntries(): TagEntry[] {
    const all = tagIndex.listTags(sortMode);
    if (!query) return all;
    const result: TagEntry[] = [];
    for (const entry of all) {
      const tagMatch = entry.name.toLowerCase().includes(query);
      const matchedFiles = tagMatch
        ? entry.files
        : entry.files.filter((path) => {
            const label = noteLabel(path).toLowerCase();
            return label.includes(query) || path.toLowerCase().includes(query);
          });
      if (matchedFiles.length === 0) continue;
      result.push({
        name: entry.name,
        count: entry.count,
        files: matchedFiles,
      });
    }
    return result;
  }

  function rerender(): void {
    const entries = visibleEntries();
    syncExpandButton(entries);

    const frag = document.createDocumentFragment();

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-sidebar-empty";
      empty.textContent = query
        ? t("tags.emptyFilter")
        : t("tags.empty");
      frag.append(empty);
      const hint = document.createElement("p");
      hint.className = "inimark-sidebar-empty-hint";
      hint.textContent = query ? "" : t("tags.emptyHint");
      if (hint.textContent) frag.append(hint);
      listHost.replaceChildren(frag);
      return;
    }

    for (const entry of entries) {
      const section = document.createElement("div");
      section.className = "inimark-tags-group";

      // Searching expands matches so hits stay visible.
      const isCollapsed = !query && !expanded.has(entry.name);
      const header = document.createElement("button");
      header.type = "button";
      header.className = "inimark-tags-group-header";
      header.setAttribute("aria-expanded", String(!isCollapsed));

      const chevron = document.createElement("span");
      chevron.className = `inimark-tags-group-chevron${isCollapsed ? "" : " is-expanded"}`;
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = CHEVRON;

      const title = document.createElement("span");
      title.className = "inimark-tags-group-title";
      title.textContent = entry.name;

      const count = document.createElement("span");
      count.className = "inimark-tags-group-count";
      count.textContent = String(entry.count);

      header.append(chevron, title, count);
      header.addEventListener("click", () => {
        if (query) return;
        if (expanded.has(entry.name)) expanded.delete(entry.name);
        else expanded.add(entry.name);
        rerenderNow();
      });
      section.append(header);

      if (!isCollapsed) {
        const list = document.createElement("div");
        list.className = "inimark-tags-items";
        for (const path of entry.files) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "inimark-tags-item";
          row.title = path;
          if (activePath === path) row.classList.add("is-active");

          const kind = document.createElement("span");
          kind.className = "inimark-tags-item-kind";
          kind.setAttribute("aria-hidden", "true");
          kind.innerHTML = treeFileIcon();

          const label = document.createElement("span");
          label.className = "inimark-tags-item-label";
          label.textContent = noteLabel(path);

          // Same as bookmarks: parent folder path on the right (omit vault-root files).
          const parent = parentDirFromPath(path);
          row.append(kind, label);
          if (parent) {
            const meta = document.createElement("span");
            meta.className = "inimark-tags-item-meta";
            meta.textContent = parent;
            row.append(meta);
          }

          row.addEventListener("click", () => onOpen(path));
          list.append(row);
        }
        section.append(list);
      }

      frag.append(section);
    }

    listHost.replaceChildren(frag);
  }

  const unsubscribeIndex = tagIndex.subscribe(() => scheduleRerender());
  const visibilityObserver = new MutationObserver(() => {
    if (isPanelVisible() && renderDirty) scheduleRerender();
  });
  visibilityObserver.observe(host, { attributes: true, attributeFilter: ["hidden"] });

  const unsubscribeLocale = onLocaleChange(() => {
    sortBtn.title = t("tags.toolbar.sort");
    sortBtn.setAttribute("aria-label", t("tags.toolbar.sort"));
    searchToggleBtn.title = t("tags.toolbar.search");
    searchToggleBtn.setAttribute("aria-label", t("tags.toolbar.search"));
    searchField.input.placeholder = t("tags.searchPlaceholder");
    searchField.input.setAttribute("aria-label", t("tags.searchPlaceholder"));
    listHost.setAttribute("aria-label", t("tags.tab"));
    if (sortMenu.isOpen()) renderSortMenu();
    rerenderNow();
  });

  syncSearchChrome();
  rerenderNow();

  return {
    el: host,
    setActiveFile(path) {
      if (activePath === path) return;
      activePath = path;
      if (!isPanelVisible()) {
        renderDirty = true;
        return;
      }
      // Cheap path: toggle active class without rebuilding the tree.
      for (const row of listHost.querySelectorAll<HTMLElement>(".inimark-tags-item")) {
        const label = row.querySelector(".inimark-tags-item-label");
        const rowPath = label?.getAttribute("title");
        row.classList.toggle("is-active", rowPath === path);
      }
    },
    refresh() {
      rerenderNow();
    },
    onOpenFile(handler) {
      onOpen = handler;
    },
    destroy() {
      unsubscribeIndex();
      unsubscribeLocale();
      visibilityObserver.disconnect();
      if (renderTimer != null) clearTimeout(renderTimer);
      if (renderRaf) cancelAnimationFrame(renderRaf);
      closeSortMenu();
      sortMenu.destroy();
      toolbar.destroy();
      searchField.destroy();
      host.replaceChildren();
    },
  };
}
