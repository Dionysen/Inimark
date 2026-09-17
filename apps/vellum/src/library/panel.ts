import {
  formatStoreError,
  pwClose,
  pwCreateArticle,
  pwGetArticle,
  pwListArticles,
  pwListCategories,
  pwListFolders,
  pwOpen,
  pwUpdateArticle,
  type ArticleMeta,
  type Category,
  type Folder,
  type OpenLibraryResult,
  type SchemaStatus,
} from "@dionysen/purewriter-store";
import { createIconButton, createPanelToolbar } from "@dionysen/ui";
import {
  clearLastLibrary,
  getLastLibraryId,
  getLibraryById,
  listLibraries,
  upsertLibrary,
  type LibraryRecord,
} from "../libraries/store.ts";
import {
  newFileIcon,
  saveIcon,
  sidebarToggleIcon,
} from "../ui/product-icons.ts";
import { mountLibraryDock, type LibraryDock } from "./dock.ts";

export interface LibraryPanel {
  el: HTMLElement;
  /** Persist the open article’s editor content. No-op when nothing is open or writes are blocked. */
  save(): Promise<void>;
  setSidebarOpen(open: boolean): void;
  destroy(): void;
}

export interface LibraryPanelOptions {
  /** `id` is null when the library is closed / no chapter is open. */
  onArticleOpen: (title: string, content: string, id: string | null) => void;
  onStatus: (message: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getEditorContent: () => string;
  getOpenArticleId: () => string | null;
}

const BOOK_KEY = "vellum-purewriter-book-id";
/** Sentinel for articles with no Category (uncategorized volume). */
const UNCATEGORIZED = "__uncategorized__";

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

/**
 * Pure Writer library chrome: floating library dock, book switcher,
 * panel toolbar (new/save), and volumes → chapters.
 */
export function mountLibraryPanel(
  host: HTMLElement,
  options: LibraryPanelOptions,
): LibraryPanel {
  const el = document.createElement("aside");
  el.className = "vellum-library";

  // Same chrome row as Inimark: titlebar-height topbar with collapse near the divider.
  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "deep");

  const collapseBtn = createIconButton({
    label: options.t("common.collapseSidebar"),
    title: options.t("common.collapseSidebar"),
    html: sidebarToggleIcon(true),
    onClick: options.onToggleSidebar,
  });
  collapseBtn.className =
    "inimark-sidebar-toggle-btn inimark-sidebar-collapse-btn";
  markNoDrag(collapseBtn);
  topbar.append(collapseBtn);

  const body = document.createElement("div");
  body.className = "vellum-library-body";

  const bookWrap = document.createElement("div");
  bookWrap.className = "vellum-library-book-wrap";

  const bookBtn = document.createElement("button");
  bookBtn.type = "button";
  bookBtn.className = "vellum-library-book-btn";
  bookBtn.disabled = true;
  bookBtn.textContent = options.t("library.noBook");

  const bookMenu = document.createElement("div");
  bookMenu.className = "vellum-library-book-menu";
  bookMenu.hidden = true;

  bookWrap.append(bookBtn, bookMenu);

  const toolbar = createPanelToolbar([
    {
      label: options.t("library.newChapter"),
      title: options.t("library.newChapter"),
      icon: newFileIcon,
      disabled: true,
      onClick() {
        void createChapter();
      },
    },
    {
      label: options.t("library.save"),
      title: options.t("library.save"),
      icon: saveIcon,
      disabled: true,
      onClick() {
        void save();
      },
    },
  ]);
  const newBtn = toolbar.buttons[0]!;
  const saveBtn = toolbar.buttons[1]!;

  const scroll = document.createElement("div");
  scroll.className = "vellum-library-scroll inimark-scrollbar";

  const banner = document.createElement("div");
  banner.className = "vellum-library-banner";
  banner.hidden = true;

  const treeEl = document.createElement("div");
  treeEl.className = "vellum-library-tree";

  scroll.append(bookWrap, toolbar.el, banner, treeEl);
  body.append(scroll);
  el.append(topbar, body);
  host.append(el);

  let opened: OpenLibraryResult | null = null;
  let activeLibrary: LibraryRecord | null = null;
  let books: Folder[] = [];
  let selectedBookId: string | null = null;
  let volumes: Category[] = [];
  let chapters: ArticleMeta[] = [];
  let openArticleId: string | null = null;
  /** Volume under which New creates a chapter; null = uncategorized. */
  let selectedVolumeId: string | null = null;
  const collapsedVolumes = new Set<string>();

  const closeBookMenu = () => {
    bookMenu.hidden = true;
    bookBtn.classList.remove("is-open");
  };

  const renderBanner = (schema: SchemaStatus | null) => {
    if (!schema || schema.writesAllowed) {
      banner.hidden = true;
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.textContent = options.t("library.schemaMismatch", {
      found: `${schema.fingerprint.userVersion}:${schema.fingerprint.identityHash}`,
    });
  };

  const currentBook = (): Folder | null =>
    books.find((b) => b.id === selectedBookId) ?? null;

  const updateBookButton = () => {
    const book = currentBook();
    if (!opened) {
      bookBtn.disabled = true;
      bookBtn.textContent = options.t("library.noBook");
      bookBtn.title = "";
      return;
    }
    bookBtn.disabled = books.length === 0;
    bookBtn.textContent = book?.name ?? options.t("library.noBook");
    bookBtn.title = book ? `${book.name} (${book.id})` : "";
  };

  const renderBookMenu = () => {
    bookMenu.replaceChildren();
    for (const book of books) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "vellum-library-book-menu-item";
      if (book.id === selectedBookId) item.classList.add("is-active");
      item.textContent = book.name;
      item.title = book.id;
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeBookMenu();
        void selectBook(book.id);
      });
      bookMenu.append(item);
    }
  };

  const chaptersForVolume = (volumeKey: string): ArticleMeta[] => {
    if (volumeKey === UNCATEGORIZED) {
      return chapters.filter((c) => !c.categoryId);
    }
    return chapters.filter((c) => c.categoryId === volumeKey);
  };

  const renderTree = () => {
    treeEl.replaceChildren();
    if (!opened || !selectedBookId) {
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.openHint");
      treeEl.append(empty);
      return;
    }

    const section = document.createElement("div");
    section.className = "vellum-library-section-label";
    section.textContent = options.t("library.volumesAndChapters", {
      count: chapters.length,
    });
    treeEl.append(section);

    const volumeEntries: { key: string; name: string }[] = volumes.map((v) => ({
      key: v.id,
      name: v.name,
    }));
    const uncategorized = chaptersForVolume(UNCATEGORIZED);
    if (uncategorized.length > 0 || volumes.length === 0) {
      volumeEntries.push({
        key: UNCATEGORIZED,
        name: options.t("library.uncategorized"),
      });
    }

    if (volumeEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.noChapters");
      treeEl.append(empty);
      return;
    }

    for (const vol of volumeEntries) {
      const volChapters = chaptersForVolume(vol.key);
      const collapsed = collapsedVolumes.has(vol.key);

      const group = document.createElement("div");
      group.className = "vellum-library-volume";
      if (
        (vol.key === UNCATEGORIZED && selectedVolumeId === null) ||
        vol.key === selectedVolumeId
      ) {
        group.classList.add("is-selected");
      }

      const head = document.createElement("button");
      head.type = "button";
      head.className = "vellum-library-volume-head";
      head.setAttribute("aria-expanded", collapsed ? "false" : "true");

      const chevron = document.createElement("span");
      chevron.className = "vellum-library-volume-chevron";
      chevron.textContent = collapsed ? "▸" : "▾";

      const label = document.createElement("span");
      label.className = "vellum-library-volume-name";
      label.textContent = vol.name;

      const count = document.createElement("span");
      count.className = "vellum-library-volume-count";
      count.textContent = String(volChapters.length);

      head.append(chevron, label, count);
      chevron.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (collapsedVolumes.has(vol.key)) collapsedVolumes.delete(vol.key);
        else collapsedVolumes.add(vol.key);
        renderTree();
      });
      head.addEventListener("click", () => {
        selectedVolumeId = vol.key === UNCATEGORIZED ? null : vol.key;
        collapsedVolumes.delete(vol.key);
        renderTree();
      });
      group.append(head);

      if (!collapsed) {
        const list = document.createElement("div");
        list.className = "vellum-library-chapters";
        if (volChapters.length === 0) {
          const empty = document.createElement("div");
          empty.className = "vellum-library-empty vellum-library-empty--nested";
          empty.textContent = options.t("library.noChaptersInVolume");
          list.append(empty);
        } else {
          for (const chapter of volChapters) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "vellum-library-item vellum-library-chapter";
            if (chapter.id === openArticleId) btn.classList.add("is-active");
            btn.textContent = chapter.title || options.t("app.untitled");
            btn.title = chapter.id;
            btn.addEventListener("click", () => {
              selectedVolumeId =
                vol.key === UNCATEGORIZED ? null : vol.key;
              void openChapter(chapter.id);
            });
            list.append(btn);
          }
        }
        group.append(list);
      }

      treeEl.append(group);
    }
  };

  const resetContent = () => {
    opened = null;
    books = [];
    volumes = [];
    chapters = [];
    selectedBookId = null;
    selectedVolumeId = null;
    openArticleId = null;
    renderBanner(null);
    updateBookButton();
    renderBookMenu();
    renderTree();
    newBtn.disabled = true;
    saveBtn.disabled = true;
  };

  const selectBook = async (bookId: string) => {
    selectedBookId = bookId;
    localStorage.setItem(BOOK_KEY, bookId);
    selectedVolumeId = null;
    openArticleId = null;
    updateBookButton();
    renderBookMenu();
    volumes = await pwListCategories(bookId, false);
    chapters = await pwListArticles(bookId, null, false);
    collapsedVolumes.clear();
    renderTree();
    newBtn.disabled = !opened?.schema.writesAllowed;
    saveBtn.disabled = true;
    options.onStatus(
      options.t("library.bookOpened", {
        name: currentBook()?.name ?? bookId,
        count: chapters.length,
      }),
    );
  };

  const openChapter = async (id: string) => {
    const art = await pwGetArticle(id);
    openArticleId = art.id;
    selectedVolumeId = art.categoryId;
    renderTree();
    options.onArticleOpen(art.title, art.content, art.id);
    saveBtn.disabled = !opened?.schema.writesAllowed;
  };

  const pickInitialBook = (list: Folder[]): string | null => {
    const remembered = localStorage.getItem(BOOK_KEY);
    if (remembered && list.some((f) => f.id === remembered && f.deleted === 0)) {
      return remembered;
    }
    const preferred = list.find((f) => f.id === "Default" && f.deleted === 0);
    if (preferred) return preferred.id;
    const nonTrash = list.find((f) => f.id !== "PW_Trash" && f.deleted === 0);
    return nonTrash?.id ?? list[0]?.id ?? null;
  };

  const openLibraryAt = async (root: string) => {
    const path = root.trim();
    if (!path) {
      options.onStatus(options.t("library.needPath"));
      return;
    }
    options.onStatus(options.t("library.opening"));
    closeBookMenu();
    try {
      opened = await pwOpen(path);
      activeLibrary = upsertLibrary(opened.root);
      dock.setActive(activeLibrary);
      dock.refreshList();
      renderBanner(opened.schema);
      openArticleId = null;
      selectedVolumeId = null;
      books = await pwListFolders(false);
      selectedBookId = pickInitialBook(books);
      updateBookButton();
      renderBookMenu();
      if (selectedBookId) {
        await selectBook(selectedBookId);
      } else {
        volumes = [];
        chapters = [];
        renderTree();
        newBtn.disabled = true;
        saveBtn.disabled = true;
        options.onStatus(
          opened.schema.writesAllowed
            ? options.t("library.openedEmpty")
            : options.t("library.openedReadonly"),
        );
      }
      if (selectedBookId && !opened.schema.writesAllowed) {
        options.onStatus(options.t("library.openedReadonly"));
      }
    } catch (e) {
      activeLibrary = null;
      dock.setActive(null);
      resetContent();
      options.onStatus(formatStoreError(e));
    }
  };

  const pickAndOpenLibrary = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: options.t("library.pickTitle"),
        defaultPath: activeLibrary?.rootPath ?? listLibraries()[0]?.rootPath,
      });
      if (selected === null) return;
      const root = typeof selected === "string" ? selected : selected;
      await openLibraryAt(root);
    } catch (e) {
      options.onStatus(
        e instanceof Error ? e.message : formatStoreError(e),
      );
    }
  };

  const switchLibrary = async (id: string) => {
    if (id === activeLibrary?.id) return;
    const record = getLibraryById(id);
    if (!record) {
      options.onStatus(options.t("library.missingRecord"));
      dock.refreshList();
      return;
    }
    await openLibraryAt(record.rootPath);
  };

  const closeLibrary = async () => {
    closeBookMenu();
    try {
      await pwClose();
    } catch {
      // ignore — library may already be closed
    }
    activeLibrary = null;
    clearLastLibrary();
    dock.setActive(null);
    dock.refreshList();
    resetContent();
    options.onArticleOpen("", "", null);
    options.onStatus(options.t("library.closed"));
  };

  const save = async () => {
    const id = options.getOpenArticleId();
    if (!id || !opened?.schema.writesAllowed) return;
    try {
      await pwUpdateArticle(id, { content: options.getEditorContent() });
      options.onStatus(options.t("library.saved"));
      if (selectedBookId) {
        chapters = await pwListArticles(selectedBookId, null, false);
        renderTree();
      }
    } catch (e) {
      options.onStatus(formatStoreError(e));
    }
  };

  const createChapter = async () => {
    if (!selectedBookId || !opened?.schema.writesAllowed) return;
    try {
      const art = await pwCreateArticle({
        title: options.t("app.untitled"),
        content: "",
        folderId: selectedBookId,
        categoryId: selectedVolumeId,
      });
      chapters = await pwListArticles(selectedBookId, null, false);
      if (selectedVolumeId) collapsedVolumes.delete(selectedVolumeId);
      else collapsedVolumes.delete(UNCATEGORIZED);
      await openChapter(art.id);
    } catch (e) {
      options.onStatus(formatStoreError(e));
    }
  };

  const dock: LibraryDock = mountLibraryDock(el, {
    t: options.t,
    onOpenSettings: options.onOpenSettings,
    onAddLibrary: () => void pickAndOpenLibrary(),
    onSwitchLibrary: (id) => void switchLibrary(id),
    onCloseLibrary: () => void closeLibrary(),
  });

  bookBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (bookBtn.disabled) return;
    const nextOpen = bookMenu.hidden;
    bookMenu.hidden = !nextOpen;
    bookBtn.classList.toggle("is-open", nextOpen);
    if (nextOpen) renderBookMenu();
  });

  document.addEventListener("click", closeBookMenu);

  updateBookButton();
  renderTree();

  // Restore last library on launch.
  const lastId = getLastLibraryId();
  const last = lastId ? getLibraryById(lastId) : listLibraries()[0] ?? null;
  if (last) {
    void openLibraryAt(last.rootPath);
  }

  return {
    el,
    save,
    setSidebarOpen(open) {
      collapseBtn.innerHTML = sidebarToggleIcon(open);
      const label = open
        ? options.t("common.collapseSidebar")
        : options.t("common.expandSidebar");
      collapseBtn.title = label;
      collapseBtn.setAttribute("aria-label", label);
    },
    destroy: () => {
      document.removeEventListener("click", closeBookMenu);
      toolbar.destroy();
      dock.destroy();
      el.remove();
    },
  };
}
