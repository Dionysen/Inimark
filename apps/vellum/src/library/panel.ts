import {
  formatStoreError,
  pwClose,
  pwCreateArticle,
  pwGetArticle,
  pwListArticles,
  pwListCategories,
  pwListFolders,
  pwOpen,
  pwReorderArticles,
  pwReorderCategories,
  pwPurgeArticle,
  pwTrashArticle,
  pwUpdateArticle,
  pwUpdateCategory,
  pwUpdateFolder,
  pwDeleteCategory,
  type ArticleMeta,
  type Category,
  type Folder,
  type OpenLibraryResult,
  type SchemaStatus,
} from "@dionysen/purewriter-store";
import {
  createIconButton,
  createMenu,
  createPanelToolbar,
  createTreeBranch,
  createTreeChildren,
  createTreeHost,
  createTreeItem,
  menuIcons,
  promptConfirm,
  updateTooltip,
} from "@dionysen/ui";
import {
  clearLastLibrary,
  getLastLibraryId,
  getLibraryById,
  listLibraries,
  upsertLibrary,
  type LibraryRecord,
} from "../libraries/store.ts";
import { bookIcon, collapseAllIcon, expandAllIcon, locateChapterIcon, newFileIcon, sidebarToggleIcon } from "../ui/product-icons.ts";
import { fillChapterTreeLabel } from "./chapter-row.ts";
import { bookTagText, promptBookEdit } from "./book-edit.ts";
import { scrollTopToCenter } from "./reveal.ts";
import { mountLibraryDock, type LibraryDock } from "./dock.ts";
import { bindRenameField } from "./rename-field.ts";
import { bindPointerReorder, insertionIndex, moveIndex, seamLineY, seamSlot } from "./reorder.ts";
import {
  createWorkspaceState,
  loadWorkspaceState,
  rememberArticleView,
  saveWorkspaceState,
  type ArticleViewState,
} from "./workspace-state.ts";

export interface LibraryPanel {
  el: HTMLElement;
  /** Persist the open article’s editor content. No-op when nothing is open or writes are blocked. */
  save(options?: { quiet?: boolean }): Promise<void>;
  /** Create a chapter in the focused volume, or the volume used by New. */
  newChapter(): Promise<void>;
  closeChapter(): Promise<void>;
  /** Rename the focused volume, or the open / focused chapter. Works from the editor (F2). */
  renameSelection(): void;
  /** Start an inline rename of the chapter open in the editor. Expands its volume if needed. */
  renameOpenChapter(): void;
  /** True when the open chapter can be renamed. */
  canRenameOpenChapter(): boolean;
  /** Delete the focused volume or chapter. Only while the library tree is focused. */
  deleteSelection(): Promise<void>;
  /** Copy the focused or open chapter so Paste can create another. */
  copySelection(): Promise<void>;
  /** Create a chapter from the last copy, in the focused volume. */
  pasteClipboard(): Promise<void>;
  /** Remember the current document's editing location for reopen and sync. */
  saveArticleViewState(id: string, view: Omit<ArticleViewState, "updatedAt">): void;
  /** Finish queued workspace-state writes before a backup or shutdown. */
  flushWorkspaceState(): Promise<void>;
  setSidebarOpen(open: boolean): void;
  destroy(): void;
}

export interface LibraryPanelOptions {
  /** `id` is null when the library is closed / no chapter is open. */
  onArticleOpen: (
    title: string,
    content: string,
    id: string | null,
    viewState?: ArticleViewState,
  ) => void | Promise<void>;
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
/** Pure Writer’s trash folder. Articles here are hidden from every book. */
const TRASH_FOLDER = "PW_Trash";

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

/**
 * Pure Writer library chrome: floating library dock, book switcher,
 * panel toolbar, and volumes → chapters via shared `@dionysen/ui` tree.
 */
export function mountLibraryPanel(
  host: HTMLElement,
  options: LibraryPanelOptions,
): LibraryPanel {
  const el = document.createElement("aside");
  el.className = "vellum-library";

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

  const bookName = document.createElement("span");
  bookName.className = "vellum-library-book-name";
  bookName.textContent = options.t("library.noBook");

  const bookMeta = document.createElement("span");
  bookMeta.className = "vellum-library-book-meta";
  bookMeta.hidden = true;

  bookBtn.append(bookName, bookMeta);

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
      label: options.t("library.collapseAll"),
      title: options.t("library.collapseAll"),
      icon: collapseAllIcon,
      disabled: true,
      onClick() {
        toggleAllVolumes();
      },
    },
    {
      label: options.t("library.locateChapter"),
      title: options.t("library.locateChapter"),
      icon: locateChapterIcon,
      disabled: true,
      onClick() {
        void revealOpenChapter();
      },
    },
  ]);
  const newBtn = toolbar.buttons[0]!;
  const foldBtn = toolbar.buttons[1]!;
  const locateBtn = toolbar.buttons[2]!;

  const banner = document.createElement("div");
  banner.className = "vellum-library-banner";
  banner.hidden = true;

  const treeHost = createTreeHost(options.t("library.treeAria"));
  treeHost.classList.add("vellum-library-tree");
  markNoDrag(treeHost);

  body.append(bookWrap, toolbar.el, banner, treeHost);
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
  /** Last real book, so Restore can leave the trash book. */
  let returnBookId: string | null = null;
  /** Collapsed volume keys (absent = expanded). */
  const collapsedVolumes = new Set<string>();
  let workspaceState = createWorkspaceState();
  let workspaceWrite = Promise.resolve();
  /** In-memory chapter clipboard for library copy / paste. */
  let chapterClip: { title: string; content: string } | null = null;

  const chapterMenu = createMenu();
  chapterMenu.el.classList.add("inimark-context-menu");
  chapterMenu.setPath("");
  document.body.append(chapterMenu.el);

  const canWrite = () => Boolean(opened?.schema.writesAllowed);

  const persistWorkspaceState = (): Promise<void> => {
    if (!canWrite()) return workspaceWrite;
    const snapshot = structuredClone(workspaceState);
    workspaceWrite = workspaceWrite
      .catch(() => undefined)
      .then(() => saveWorkspaceState(snapshot))
      .catch(() => undefined);
    return workspaceWrite;
  };

  const rememberCollapsedVolumes = (): void => {
    if (!selectedBookId) return;
    workspaceState.collapsedVolumeIdsByBook[selectedBookId] = [...collapsedVolumes];
  };

  let reorderGhost: HTMLElement | null = null;
  let reorderLine: HTMLElement | null = null;

  const hideReorderLine = () => {
    reorderLine?.remove();
    reorderLine = null;
  };

  const hideReorderGhost = () => {
    reorderGhost?.remove();
    reorderGhost = null;
    hideReorderLine();
    treeHost.classList.remove("is-reordering", "is-volume-drag");
    document.body.classList.remove("is-library-dragging");
  };

  /** Rows of one reorder list, in visual order. */
  const rowSpans = (rows: HTMLElement[]) =>
    rows.map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, width: box.width };
    });

  /**
   * Draw the insertion line on the seam under the pointer.
   * Returns the `moveIndex` destination, or null when the pointer is on a row body
   * or on the dragged row's own seams.
   */
  const placeSeam = (rows: HTMLElement[], pointerY: number, from: number): number | null => {
    const spans = rowSpans(rows);
    const slot = seamSlot(spans, pointerY);
    const to = slot == null ? null : insertionIndex(from, slot, rows.length);
    const lineY = slot == null ? null : seamLineY(spans, slot);
    if (slot == null || to == null || lineY == null || spans.length === 0) {
      hideReorderLine();
      return null;
    }
    if (!reorderLine) {
      reorderLine = document.createElement("div");
      reorderLine.className = "vellum-reorder-line";
      document.body.append(reorderLine);
    }
    const anchor = spans[Math.min(slot, spans.length - 1)]!;
    reorderLine.style.left = `${anchor.left}px`;
    reorderLine.style.width = `${anchor.width}px`;
    reorderLine.style.top = `${lineY - 1}px`;
    return to;
  };

  const volumeRows = () =>
    [...treeHost.querySelectorAll<HTMLElement>(".vellum-tree-volume")].filter(
      (row) => row.dataset.volumeId && row.dataset.volumeId !== UNCATEGORIZED,
    );

  const chapterRows = (volumeKey: string) =>
    [...treeHost.querySelectorAll<HTMLElement>(".vellum-tree-chapter")].filter(
      (row) => row.dataset.volumeKey === volumeKey,
    );

  const showReorderGhost = (label: string, x: number, y: number) => {
    if (!reorderGhost) {
      reorderGhost = document.createElement("div");
      reorderGhost.className = "vellum-reorder-ghost";
      document.body.append(reorderGhost);
    }
    reorderGhost.textContent = label;
    reorderGhost.style.left = `${x + 12}px`;
    reorderGhost.style.top = `${y + 8}px`;
  };

  const beginInlineRename = (
    titleEl: HTMLElement,
    current: string,
    commitName: (next: string) => Promise<void>,
  ) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "vellum-chapter-rename";
    input.value = current;
    titleEl.replaceWith(input);
    bindRenameField(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      if (!commit || !next || next === current) {
        renderTree();
        return;
      }
      void commitName(next)
        .then(() => renderTree())
        .catch((e) => {
          options.onStatus(e instanceof Error ? e.message : formatStoreError(e));
          renderTree();
        });
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));
  };

  const beginChapterRename = (chapter: ArticleMeta, titleEl: HTMLElement) => {
    beginInlineRename(titleEl, chapter.title, async (next) => {
      await pwUpdateArticle(chapter.id, { title: next });
      const found = chapters.find((item) => item.id === chapter.id);
      if (found) found.title = next;
      if (openArticleId === chapter.id) {
        options.onArticleOpen(next, options.getEditorContent(), chapter.id);
      }
    });
  };

  const beginVolumeRename = (volumeId: string, name: string, titleEl: HTMLElement) => {
    beginInlineRename(titleEl, name, async (next) => {
      await pwUpdateCategory(volumeId, { name: next });
      const found = volumes.find((item) => item.id === volumeId);
      if (found) found.name = next;
    });
  };

  const reportError = (error: unknown) => {
    options.onStatus(error instanceof Error ? error.message : formatStoreError(error));
  };

  const viewingTrash = () => selectedBookId === TRASH_FOLDER;

  const deleteChapter = async (chapter: ArticleMeta) => {
    const title = chapter.title || options.t("app.untitled");
    const ok = await promptConfirm({
      title: options.t("library.moveToTrashTitle"),
      message: options.t("library.confirmDeleteChapter", { title }),
      confirmLabel: options.t("library.moveToTrash"),
      cancelLabel: options.t("common.cancel"),
    });
    if (!ok) return;
    await pwTrashArticle(chapter.id);
    chapters = chapters.filter((item) => item.id !== chapter.id);
    if (openArticleId === chapter.id) {
      openArticleId = null;
      options.onArticleOpen("", "", null);
    }
    updateBookMeta();
    renderTree();
  };

  const purgeChapter = async (chapter: ArticleMeta) => {
    const title = chapter.title || options.t("app.untitled");
    const ok = await promptConfirm({
      title: options.t("library.purgeTitle"),
      message: options.t("library.confirmPurge", { title }),
      confirmLabel: options.t("library.purge"),
      cancelLabel: options.t("common.cancel"),
      danger: true,
    });
    if (!ok) return;
    await pwPurgeArticle(chapter.id);
    chapters = chapters.filter((item) => item.id !== chapter.id);
    if (openArticleId === chapter.id) {
      openArticleId = null;
      options.onArticleOpen("", "", null);
    }
    updateBookMeta();
    renderTree();
  };

  const emptyTrash = async () => {
    const items = await pwListArticles(TRASH_FOLDER, null, false);
    if (items.length === 0) {
      options.onStatus(options.t("library.trashEmpty"));
      return;
    }
    const ok = await promptConfirm({
      title: options.t("library.emptyTrashTitle"),
      message: options.t("library.confirmEmptyTrash", { count: items.length }),
      confirmLabel: options.t("library.emptyTrash"),
      cancelLabel: options.t("common.cancel"),
      danger: true,
    });
    if (!ok) return;
    const ids = items.map((item) => item.id);
    try {
      for (const id of ids) await pwPurgeArticle(id);
    } finally {
      if (viewingTrash()) {
        chapters = await pwListArticles(TRASH_FOLDER, null, false);
        if (openArticleId && !chapters.some((item) => item.id === openArticleId)) {
          openArticleId = null;
          options.onArticleOpen("", "", null);
        }
        updateBookMeta();
        renderTree();
      }
    }
  };

  /** Put a trashed article back into the book that was open before Trash. */
  const restoreChapter = async (chapter: ArticleMeta) => {
    const targetId =
      returnBookId ??
      books.find((book) => book.id !== TRASH_FOLDER && book.deleted === 0)?.id ??
      null;
    if (!targetId) {
      options.onStatus(options.t("library.restoreNeedsBook"));
      return;
    }
    const targetVolumes = await pwListCategories(targetId, false);
    const categoryStillHere =
      chapter.categoryId != null && targetVolumes.some((item) => item.id === chapter.categoryId);
    await pwUpdateArticle(chapter.id, {
      folderId: targetId,
      categoryId: categoryStillHere ? chapter.categoryId : null,
    });
    chapters = chapters.filter((item) => item.id !== chapter.id);
    if (openArticleId === chapter.id) {
      openArticleId = null;
      options.onArticleOpen("", "", null);
    }
    options.onStatus(
      options.t("library.restored", {
        title: chapter.title || options.t("app.untitled"),
      }),
    );
    updateBookMeta();
    renderTree();
  };

  /** Context-menu rows close the menu before running the action. */
  const addContextItem = (item: Parameters<typeof chapterMenu.addItem>[0]) => {
    chapterMenu.addItem({
      ...item,
      onClick() {
        chapterMenu.setOpen(false);
        item.onClick?.();
      },
    });
  };

  const openChapterMenu = (event: MouseEvent, chapter: ArticleMeta) => {
    if (!canWrite()) return;
    chapterMenu.clear();
    chapterMenu.setPath("");
    addContextItem({
      label: options.t("library.rename"),
      icon: menuIcons.rename,
      onClick() {
        const titleEl = treeHost.querySelector<HTMLElement>(
          `[data-chapter-id="${chapter.id}"] .vellum-chapter-title`,
        );
        if (titleEl) beginChapterRename(chapter, titleEl);
      },
    });
    addContextItem({
      label: options.t("library.moveToTrash"),
      icon: menuIcons.trash,
      onClick() {
        void deleteChapter(chapter).catch(reportError);
      },
    });
    openRowMenu(event);
  };

  const openTrashChapterMenu = (event: MouseEvent, chapter: ArticleMeta) => {
    if (!canWrite()) return;
    chapterMenu.clear();
    chapterMenu.setPath("");
    addContextItem({
      label: options.t("library.restore"),
      icon: menuIcons.back,
      onClick() {
        void restoreChapter(chapter).catch(reportError);
      },
    });
    addContextItem({
      label: options.t("library.purge"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        void purgeChapter(chapter).catch(reportError);
      },
    });
    openRowMenu(event);
  };

  const openTrashMenu = (event: MouseEvent) => {
    if (!canWrite()) return;
    chapterMenu.clear();
    chapterMenu.setPath("");
    addContextItem({
      label: options.t("library.emptyTrash"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        void emptyTrash().catch(reportError);
      },
    });
    openRowMenu(event);
  };

  const deleteVolume = async (volumeId: string, name: string) => {
    if (!window.confirm(options.t("library.confirmDeleteVolume", { title: name }))) return;
    await pwDeleteCategory(volumeId);
    volumes = volumes.filter((item) => item.id !== volumeId);
    for (const chapter of chapters) {
      if (chapter.categoryId === volumeId) chapter.categoryId = null;
    }
    collapsedVolumes.delete(volumeId);
    if (selectedVolumeId === volumeId) selectedVolumeId = null;
    updateBookMeta();
    renderTree();
  };

  const openRowMenu = (event: MouseEvent) => {
    chapterMenu.el.style.position = "fixed";
    chapterMenu.el.style.left = `${event.clientX}px`;
    chapterMenu.el.style.top = `${event.clientY}px`;
    chapterMenu.setOpen(true);
  };

  const openVolumeMenu = (event: MouseEvent, volumeId: string, name: string) => {
    if (!canWrite()) return;
    chapterMenu.clear();
    chapterMenu.setPath("");
    addContextItem({
      label: options.t("library.addChapter"),
      icon: newFileIcon(),
      onClick() {
        selectedVolumeId = volumeId;
        void createChapter(volumeId);
      },
    });
    addContextItem({
      label: options.t("library.rename"),
      icon: menuIcons.rename,
      onClick() {
        const titleEl = treeHost.querySelector<HTMLElement>(
          `[data-volume-id="${volumeId}"] .inimark-tree-label`,
        );
        if (titleEl) beginVolumeRename(volumeId, name, titleEl);
      },
    });
    addContextItem({
      label: options.t("library.deleteVolume"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        void deleteVolume(volumeId, name).catch((e) => {
          options.onStatus(e instanceof Error ? e.message : formatStoreError(e));
        });
      },
    });
    openRowMenu(event);
  };

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

  const bookLabel = (book: Folder) => {
    const name = book.name.trim();
    if (
      book.id === TRASH_FOLDER &&
      (name === "" || name === "Trash" || name === "PW_Trash" || name === "废纸篓" || name === "回收站")
    ) {
      return options.t("library.trash");
    }
    return name || book.name;
  };

  const updateBookButton = () => {
    const book = currentBook();
    if (!opened) {
      bookBtn.disabled = true;
      bookName.textContent = options.t("library.noBook");
      bookBtn.title = "";
      bookMeta.hidden = true;
      bookMeta.textContent = "";
      return;
    }
    bookBtn.disabled = books.length === 0;
    const label = book ? bookLabel(book) : options.t("library.noBook");
    bookName.textContent = label;
    bookBtn.title = book && book.id !== TRASH_FOLDER ? `${label} (${book.id})` : label;
  };

  /** Volume/chapter counts shown inside the book switcher (right-aligned). */
  const updateBookMeta = () => {
    if (!opened || !selectedBookId) {
      bookMeta.hidden = true;
      bookMeta.textContent = "";
      return;
    }
    bookMeta.hidden = false;
    bookMeta.textContent = viewingTrash()
      ? options.t("library.chapterSummary", { count: chapters.length })
      : options.t("library.volumeChapterSummary", {
          volumes: volumes.length,
          chapters: chapters.length,
        });
  };

  const editBook = async (book: Folder) => {
    if (!canWrite()) return;
    const draft = await promptBookEdit({
      title: options.t("library.editBookTitle"),
      nameLabel: options.t("library.bookName"),
      tagsLabel: options.t("library.bookTags"),
      tagsPlaceholder: options.t("library.bookTagsHint"),
      name: bookLabel(book),
      tags: bookTagText(book.tags),
      saveLabel: options.t("common.save"),
      cancelLabel: options.t("common.cancel"),
      nameRequired: options.t("library.bookNameRequired"),
    });
    if (!draft) return;
    const updated = await pwUpdateFolder(book.id, {
      name: draft.name,
      tags: draft.tags || null,
    });
    const index = books.findIndex((item) => item.id === book.id);
    if (index >= 0) books[index] = updated;
    updateBookButton();
    renderBookMenu();
  };

  const bookMenuItem = (book: Folder) => {
    const item = document.createElement("div");
    item.className = "vellum-library-book-menu-item";
    if (book.id === selectedBookId) item.classList.add("is-active");

    const main = document.createElement("button");
    main.type = "button";
    main.className = "vellum-library-book-menu-main";
    main.innerHTML = bookIcon();
    const name = document.createElement("span");
    name.className = "vellum-library-book-menu-name";
    name.textContent = bookLabel(book);
    main.append(name);
    const tag = bookTagText(book.tags);
    if (tag) {
      const tagEl = document.createElement("span");
      tagEl.className = "vellum-library-book-menu-tag";
      tagEl.textContent = tag;
      main.append(tagEl);
    }
    main.title = book.id === TRASH_FOLDER ? bookLabel(book) : book.id;
    main.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeBookMenu();
      void selectBook(book.id);
    });
    item.append(main);

    if (canWrite()) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "vellum-library-book-menu-edit";
      edit.innerHTML = menuIcons.rename;
      edit.title = options.t("library.editBook");
      edit.setAttribute("aria-label", options.t("library.editBook"));
      edit.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void editBook(book).catch(reportError);
      });
      item.append(edit);
    }
    return item;
  };

  const renderBookMenu = () => {
    bookMenu.replaceChildren();
    const scroll = document.createElement("div");
    scroll.className = "vellum-library-book-menu-scroll";
    for (const book of books) {
      if (book.id === TRASH_FOLDER) continue;
      scroll.append(bookMenuItem(book));
    }
    bookMenu.append(scroll);
    const trashBook = books.find((book) => book.id === TRASH_FOLDER);
    if (trashBook) {
      const item = bookMenuItem(trashBook);
      item.classList.add("is-trash");
      item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openTrashMenu(event);
      });
      bookMenu.append(item);
    }
  };

  const chaptersForVolume = (volumeKey: string): ArticleMeta[] => {
    if (viewingTrash()) {
      return volumeKey === UNCATEGORIZED ? chapters : [];
    }
    if (volumeKey === UNCATEGORIZED) {
      return chapters.filter((c) => !c.categoryId);
    }
    return chapters.filter((c) => c.categoryId === volumeKey);
  };

  const volumeEntries = (): { key: string; name: string }[] => {
    if (viewingTrash()) {
      return chapters.length === 0
        ? []
        : [{ key: UNCATEGORIZED, name: options.t("library.uncategorized") }];
    }
    const entries: { key: string; name: string }[] = volumes.map((v) => ({
      key: v.id,
      name: v.name,
    }));
    const uncategorized = chaptersForVolume(UNCATEGORIZED);
    if (uncategorized.length > 0 || volumes.length === 0) {
      entries.push({
        key: UNCATEGORIZED,
        name: options.t("library.uncategorized"),
      });
    }
    return entries;
  };

  /** Collapse every volume when any is open; otherwise expand them all. */
  const toggleAllVolumes = () => {
    const entries = volumeEntries();
    if (!opened || !selectedBookId || entries.length === 0) return;
    const anyExpanded = entries.some((entry) => !collapsedVolumes.has(entry.key));
    if (anyExpanded) {
      for (const entry of entries) collapsedVolumes.add(entry.key);
    } else {
      collapsedVolumes.clear();
    }
    rememberCollapsedVolumes();
    void persistWorkspaceState();
    renderTree();
  };

  const syncFoldButton = () => {
    const entries = opened && selectedBookId ? volumeEntries() : [];
    const anyExpanded = entries.some((entry) => !collapsedVolumes.has(entry.key));
    const label = options.t(anyExpanded ? "library.collapseAll" : "library.expandAll");
    foldBtn.disabled = entries.length === 0;
    foldBtn.setAttribute("aria-label", label);
    updateTooltip(foldBtn, label);
    foldBtn.innerHTML = anyExpanded ? collapseAllIcon() : expandAllIcon();
    locateBtn.disabled = !(options.getOpenArticleId() ?? openArticleId);
  };

  const renderTree = () => {
    syncFoldButton();
    treeHost.replaceChildren();

    if (!opened) {
      updateBookMeta();
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.openHint");
      treeHost.append(empty);
      return;
    }

    if (!selectedBookId) {
      updateBookMeta();
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.openHint");
      treeHost.append(empty);
      return;
    }

    const entries = volumeEntries();
    updateBookMeta();

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.noChapters");
      treeHost.append(empty);
      return;
    }

    for (const vol of entries) {
      const volChapters = chaptersForVolume(vol.key);
      const expanded = !collapsedVolumes.has(vol.key);

      const branch = createTreeBranch();
      const row = createTreeItem({
        kind: "directory",
        label: vol.name,
        path: `volume:${vol.key}`,
        depth: 0,
        expanded,
        // Volume rows never use selection highlight — only chapters do.
        selected: false,
        showIcons: false,
        onClick() {
          selectedVolumeId = vol.key === UNCATEGORIZED ? null : vol.key;
          if (collapsedVolumes.has(vol.key)) collapsedVolumes.delete(vol.key);
          else collapsedVolumes.add(vol.key);
          rememberCollapsedVolumes();
          void persistWorkspaceState();
          renderTree();
        },
      });
      row.classList.add("vellum-tree-volume");
      row.dataset.volumeId = vol.key;
      if (canWrite() && vol.key !== UNCATEGORIZED) {
        row.classList.add("is-reorderable");
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openVolumeMenu(event, vol.key, vol.name);
        });
        bindPointerReorder({
          row,
          onStart() {
            treeHost.classList.add("is-reordering", "is-volume-drag");
            document.body.classList.add("is-library-dragging");
          },
          onMove(event) {
            showReorderGhost(vol.name, event.clientX, event.clientY);
            const rows = volumeRows();
            placeSeam(
              rows,
              event.clientY,
              rows.findIndex((item) => item.dataset.volumeId === vol.key),
            );
          },
          onEnd(event, moved) {
            const rows = volumeRows();
            const from = rows.findIndex((item) => item.dataset.volumeId === vol.key);
            const to = moved ? placeSeam(rows, event.clientY, from) : null;
            hideReorderGhost();
            if (to == null) return;
            const ids = rows.map((item) => item.dataset.volumeId!);
            const next = moveIndex(ids, from, to);
            const byId = new Map(volumes.map((item) => [item.id, item]));
            volumes = next.map((id) => byId.get(id)!);
            renderTree();
            void pwReorderCategories(next).catch((e) => {
              options.onStatus(e instanceof Error ? e.message : formatStoreError(e));
            });
          },
        });
      }

      const count = document.createElement("span");
      count.className = "vellum-tree-count";
      count.textContent = String(volChapters.length);
      row.append(count);
      branch.append(row);

      if (expanded) {
        const children = createTreeChildren(0);
        children.classList.add("vellum-tree-chapters");
        if (volChapters.length === 0) {
          const empty = document.createElement("div");
          empty.className = "vellum-library-empty vellum-library-empty--nested";
          empty.textContent = options.t("library.noChaptersInVolume");
          children.append(empty);
        } else {
          for (const chapter of volChapters) {
            const chapterBranch = createTreeBranch();
            const title = chapter.title || options.t("app.untitled");
            const chapterRow = createTreeItem({
              kind: "file",
              label: title,
              path: `chapter:${chapter.id}`,
              depth: 0,
              active: chapter.id === openArticleId,
              showIcons: false,
              onClick() {
                selectedVolumeId =
                  vol.key === UNCATEGORIZED ? null : vol.key;
                void openChapter(chapter.id);
              },
            });
            chapterRow.classList.add("vellum-tree-chapter");
            chapterRow.dataset.chapterId = chapter.id;
            chapterRow.dataset.volumeKey = vol.key;
            if (canWrite()) {
              chapterRow.classList.add("is-reorderable");
              chapterRow.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
                viewingTrash() ? openTrashChapterMenu(event, chapter) : openChapterMenu(event, chapter);
              });
              bindPointerReorder({
                row: chapterRow,
                onStart() {
                  treeHost.classList.add("is-reordering");
                  document.body.classList.add("is-library-dragging");
                },
                onMove(event) {
                  showReorderGhost(title, event.clientX, event.clientY);
                  const rows = chapterRows(vol.key);
                  placeSeam(
                    rows,
                    event.clientY,
                    rows.findIndex((item) => item.dataset.chapterId === chapter.id),
                  );
                },
                onEnd(event, moved) {
                  const rows = chapterRows(vol.key);
                  const from = rows.findIndex((item) => item.dataset.chapterId === chapter.id);
                  const to = moved ? placeSeam(rows, event.clientY, from) : null;
                  hideReorderGhost();
                  if (to == null) return;
                  const ids = rows.map((item) => item.dataset.chapterId!);
                  const next = moveIndex(ids, from, to);
                  const byId = new Map(chapters.map((item) => [item.id, item]));
                  const rest = chapters.filter((item) => !ids.includes(item.id));
                  chapters = [...rest, ...next.map((id) => byId.get(id)!)];
                  renderTree();
                  void pwReorderArticles(next).catch((e) => {
                    options.onStatus(
                      e instanceof Error ? e.message : formatStoreError(e),
                    );
                  });
                },
              });
            }
            const label = chapterRow.querySelector(".inimark-tree-label");
            if (label instanceof HTMLElement) {
              fillChapterTreeLabel(label, {
                title,
                summary: chapter.summary,
                createTime: chapter.createTime,
                updateTime: chapter.updateTime,
                wordCountLabel: options.t("library.wordCount", {
                  count: chapter.count ?? 0,
                }),
              });
            }
            chapterBranch.append(chapterRow);
            children.append(chapterBranch);
          }
        }
        branch.append(children);
      }

      treeHost.append(branch);
    }
  };

  const resetContent = () => {
    opened = null;
    books = [];
    volumes = [];
    chapters = [];
    selectedBookId = null;
    returnBookId = null;
    selectedVolumeId = null;
    openArticleId = null;
    renderBanner(null);
    updateBookButton();
    renderBookMenu();
    renderTree();
    newBtn.disabled = true;
  };

  const selectBook = async (bookId: string, keepArticle = false) => {
    if (bookId !== TRASH_FOLDER) returnBookId = bookId;
    selectedBookId = bookId;
    localStorage.setItem(BOOK_KEY, bookId);
    selectedVolumeId = null;
    if (!keepArticle) openArticleId = null;
    workspaceState.selectedBookId = bookId;
    if (!keepArticle) workspaceState.openArticleId = null;
    updateBookButton();
    renderBookMenu();
    volumes = await pwListCategories(bookId, false);
    chapters = await pwListArticles(bookId, null, false);
    collapsedVolumes.clear();
    for (const volumeId of workspaceState.collapsedVolumeIdsByBook[bookId] ?? []) {
      collapsedVolumes.add(volumeId);
    }
    rememberCollapsedVolumes();
    void persistWorkspaceState();
    renderTree();
    newBtn.disabled = !opened?.schema.writesAllowed || bookId === TRASH_FOLDER;
  };

  const openChapter = async (id: string) => {
    const art = await pwGetArticle(id);
    openArticleId = art.id;
    workspaceState.openArticleId = art.id;
    if (art.folderId !== TRASH_FOLDER) selectedVolumeId = art.categoryId;
    renderTree();
    void persistWorkspaceState();
    options.onArticleOpen(art.title, art.content, art.id, workspaceState.articleViews[art.id]);
  };

  /** Expand the open chapter’s volume and scroll that row into view. */
  const revealOpenChapter = async () => {
    const id = options.getOpenArticleId() ?? openArticleId;
    if (!id || !opened) return;
    try {
      if (!chapters.some((item) => item.id === id)) {
        const art = await pwGetArticle(id);
        openArticleId = id;
        if (art.folderId !== selectedBookId) await selectBook(art.folderId, true);
      }
      const chapter = chapters.find((item) => item.id === id);
      if (!chapter) return;
      const volumeKey =
        viewingTrash() ||
        !chapter.categoryId ||
        !volumes.some((volume) => volume.id === chapter.categoryId)
          ? UNCATEGORIZED
          : chapter.categoryId;
      collapsedVolumes.delete(volumeKey);
      renderTree();
      queueMicrotask(() => {
        const row = treeHost.querySelector<HTMLElement>(
          `[data-chapter-id="${CSS.escape(id)}"]`,
        );
        if (!row) return;
        const frame = el.getBoundingClientRect();
        const box = row.getBoundingClientRect();
        treeHost.scrollTo({
          top: scrollTopToCenter(treeHost.scrollTop, frame.top, frame.height, box.top, box.height),
          behavior: "smooth",
        });
      });
    } catch (error) {
      reportError(error);
    }
  };

  const pickInitialBook = (list: Folder[]): string | null => {
    const synced = workspaceState.selectedBookId;
    if (synced && list.some((f) => f.id === synced && f.deleted === 0)) {
      return synced;
    }
    const remembered = localStorage.getItem(BOOK_KEY);
    if (remembered && list.some((f) => f.id === remembered && f.deleted === 0)) {
      return remembered;
    }
    const preferred = list.find((f) => f.id === "Default" && f.deleted === 0);
    if (preferred) return preferred.id;
    const nonTrash = list.find((f) => f.id !== TRASH_FOLDER && f.deleted === 0);
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
      await options.onArticleOpen("", "", null);
      await workspaceWrite;
      opened = await pwOpen(path);
      workspaceState = await loadWorkspaceState().catch(() => createWorkspaceState());
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
        const rememberedArticleId = workspaceState.openArticleId;
        await selectBook(selectedBookId);
        if (rememberedArticleId && chapters.some((chapter) => chapter.id === rememberedArticleId)) {
          await openChapter(rememberedArticleId);
        }
      } else {
        volumes = [];
        chapters = [];
        renderTree();
        newBtn.disabled = true;
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

  const save = async (opts?: { quiet?: boolean }) => {
    const id = options.getOpenArticleId();
    if (!id || !opened?.schema.writesAllowed) return;
    try {
      await pwUpdateArticle(id, { content: options.getEditorContent() });
      if (!opts?.quiet) options.onStatus(options.t("library.saved"));
    } catch (e) {
      options.onStatus(formatStoreError(e));
    }
  };

  /** Row inside the library tree that currently has focus, if any. */
  const focusedTreeRow = (): HTMLElement | null => {
    const active = document.activeElement;
    if (!(active instanceof Element)) return null;
    const row = active.closest<HTMLElement>(".vellum-tree-chapter, .vellum-tree-volume");
    if (!row || !treeHost.contains(row)) return null;
    return row;
  };

  const chapterById = (id: string | null | undefined): ArticleMeta | null =>
    id ? chapters.find((item) => item.id === id) ?? null : null;

  /** Focused chapter row, otherwise the chapter open in the editor. */
  const targetChapter = (): ArticleMeta | null => {
    const row = focusedTreeRow();
    if (row?.dataset.chapterId) return chapterById(row.dataset.chapterId);
    return chapterById(openArticleId);
  };

  /** Volume a new or pasted chapter should land in. */
  const contextVolumeId = (): string | null => {
    const row = focusedTreeRow();
    const fromRow = row?.dataset.volumeId ?? row?.dataset.volumeKey;
    if (fromRow && fromRow !== UNCATEGORIZED) return fromRow;
    const chapter = targetChapter();
    if (chapter) return chapter.categoryId;
    return selectedVolumeId;
  };

  const closeChapter = async () => {
    // The shell flushes pending edits before clearing the writing surface.
    await options.onArticleOpen("", "", null);
    openArticleId = null;
    workspaceState.openArticleId = null;
    void persistWorkspaceState();
    renderTree();
  };

  const newChapter = () => createChapter(contextVolumeId());

  const renameSelection = () => {
    if (!canWrite()) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement &&
      active.classList.contains("vellum-chapter-rename")
    ) {
      return;
    }
    const row = focusedTreeRow();
    if (
      row?.classList.contains("vellum-tree-volume") &&
      row.dataset.volumeId &&
      row.dataset.volumeId !== UNCATEGORIZED
    ) {
      const volume = volumes.find((item) => item.id === row.dataset.volumeId);
      const titleEl = row.querySelector<HTMLElement>(".inimark-tree-label");
      if (volume && titleEl) beginVolumeRename(volume.id, volume.name, titleEl);
      return;
    }
    const chapter = targetChapter();
    if (!chapter) return;
    const titleEl = treeHost.querySelector<HTMLElement>(
      `[data-chapter-id="${CSS.escape(chapter.id)}"] .vellum-chapter-title`,
    );
    if (titleEl) beginChapterRename(chapter, titleEl);
  };

  const renameOpenChapter = () => {
    if (!canWrite()) return;
    const chapter = chapterById(openArticleId);
    if (!chapter) return;
    const volumeKey = chapter.categoryId || UNCATEGORIZED;
    if (collapsedVolumes.has(volumeKey)) {
      collapsedVolumes.delete(volumeKey);
      renderTree();
    }
    const titleEl = treeHost.querySelector<HTMLElement>(
      `[data-chapter-id="${CSS.escape(chapter.id)}"] .vellum-chapter-title`,
    );
    if (titleEl) beginChapterRename(chapter, titleEl);
  };

  const deleteSelection = async () => {
    if (!canWrite()) return;
    const row = focusedTreeRow();
    if (
      row?.classList.contains("vellum-tree-volume") &&
      row.dataset.volumeId &&
      row.dataset.volumeId !== UNCATEGORIZED
    ) {
      const volume = volumes.find((item) => item.id === row.dataset.volumeId);
      if (volume) await deleteVolume(volume.id, volume.name);
      return;
    }
    const chapter = targetChapter();
    if (!chapter) return;
    if (viewingTrash()) await purgeChapter(chapter);
    else await deleteChapter(chapter);
  };

  const copySelection = async () => {
    const chapter = targetChapter();
    if (!chapter) {
      options.onStatus(options.t("library.nothingToCopy"));
      return;
    }
    const content =
      openArticleId === chapter.id
        ? options.getEditorContent()
        : (await pwGetArticle(chapter.id)).content;
    chapterClip = { title: chapter.title, content };
    options.onStatus(options.t("library.copied", { title: chapter.title || options.t("app.untitled") }));
  };

  const pasteClipboard = async () => {
    if (!chapterClip || !selectedBookId || viewingTrash() || !canWrite()) {
      if (!chapterClip) options.onStatus(options.t("library.nothingToPaste"));
      return;
    }
    const volumeId = contextVolumeId();
    try {
      const art = await pwCreateArticle({
        title: chapterClip.title || options.t("app.untitled"),
        content: chapterClip.content,
        folderId: selectedBookId,
        categoryId: volumeId,
      });
      chapters = await pwListArticles(selectedBookId, null, false);
      selectedVolumeId = volumeId;
      if (volumeId) collapsedVolumes.delete(volumeId);
      else collapsedVolumes.delete(UNCATEGORIZED);
      await openChapter(art.id);
      options.onStatus(options.t("library.pasted"));
    } catch (e) {
      options.onStatus(formatStoreError(e));
    }
  };

  const createChapter = async (volumeId: string | null = selectedVolumeId) => {
    if (!selectedBookId || viewingTrash() || !opened?.schema.writesAllowed) return;
    try {
      const art = await pwCreateArticle({
        title: options.t("app.untitled"),
        content: "",
        folderId: selectedBookId,
        categoryId: volumeId,
      });
      chapters = await pwListArticles(selectedBookId, null, false);
      selectedVolumeId = volumeId;
      if (volumeId) collapsedVolumes.delete(volumeId);
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

  const lastId = getLastLibraryId();
  const last = lastId ? getLibraryById(lastId) : listLibraries()[0] ?? null;
  if (last) {
    void openLibraryAt(last.rootPath);
  }

  return {
    el,
    save,
    newChapter,
    closeChapter,
    renameSelection,
    renameOpenChapter,
    canRenameOpenChapter: () => canWrite() && chapterById(openArticleId) != null,
    deleteSelection,
    copySelection,
    pasteClipboard,
    saveArticleViewState(id, view) {
      rememberArticleView(workspaceState, id, view);
      void persistWorkspaceState();
    },
    flushWorkspaceState: () => workspaceWrite,
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
      chapterMenu.destroy();
      hideReorderGhost();
      toolbar.destroy();
      dock.destroy();
      el.remove();
    },
  };
}
