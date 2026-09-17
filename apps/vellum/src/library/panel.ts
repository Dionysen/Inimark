import {
  formatStoreError,
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

export interface LibraryPanel {
  el: HTMLElement;
  /** Persist the open article’s editor content. No-op when nothing is open or writes are blocked. */
  save(): Promise<void>;
  destroy(): void;
}

export interface LibraryPanelOptions {
  onArticleOpen: (title: string, content: string, id: string) => void;
  onStatus: (message: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getEditorContent: () => string;
  getOpenArticleId: () => string | null;
}

const PATH_KEY = "vellum-purewriter-path";
const BOOK_KEY = "vellum-purewriter-book-id";
/** Sentinel for articles with no Category (uncategorized volume). */
const UNCATEGORIZED = "__uncategorized__";

/**
 * Pure Writer library chrome: open a validated library root, switch books (Folder),
 * and browse volumes (Category) → chapters (Article).
 */
export function mountLibraryPanel(
  host: HTMLElement,
  options: LibraryPanelOptions,
): LibraryPanel {
  const el = document.createElement("aside");
  el.className = "vellum-library inimark-scrollbar";

  const header = document.createElement("div");
  header.className = "vellum-library-header";

  const bookBtn = document.createElement("button");
  bookBtn.type = "button";
  bookBtn.className = "vellum-library-book-btn";
  bookBtn.disabled = true;
  bookBtn.textContent = options.t("library.noBook");

  const bookMenu = document.createElement("div");
  bookMenu.className = "vellum-library-book-menu";
  bookMenu.hidden = true;

  const actions = document.createElement("div");
  actions.className = "vellum-library-actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "vellum-library-btn";
  openBtn.textContent = options.t("library.openLibrary");

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "vellum-library-btn";
  newBtn.textContent = options.t("library.newChapter");
  newBtn.disabled = true;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "vellum-library-btn";
  saveBtn.textContent = options.t("library.save");
  saveBtn.disabled = true;

  actions.append(openBtn, newBtn, saveBtn);
  header.append(bookBtn, bookMenu, actions);

  const banner = document.createElement("div");
  banner.className = "vellum-library-banner";
  banner.hidden = true;

  const treeEl = document.createElement("div");
  treeEl.className = "vellum-library-tree";

  el.append(header, banner, treeEl);
  host.append(el);

  let opened: OpenLibraryResult | null = null;
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

  const renderBanner = (schema: SchemaStatus) => {
    if (schema.writesAllowed) {
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
    openBtn.disabled = true;
    options.onStatus(options.t("library.opening"));
    closeBookMenu();
    try {
      opened = await pwOpen(path);
      localStorage.setItem(PATH_KEY, opened.root);
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
      opened = null;
      books = [];
      volumes = [];
      chapters = [];
      selectedBookId = null;
      updateBookButton();
      renderBookMenu();
      renderTree();
      newBtn.disabled = true;
      saveBtn.disabled = true;
      options.onStatus(formatStoreError(e));
    } finally {
      openBtn.disabled = false;
    }
  };

  const pickAndOpenLibrary = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: options.t("library.pickTitle"),
        defaultPath: localStorage.getItem(PATH_KEY) ?? undefined,
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

  bookBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (bookBtn.disabled) return;
    const nextOpen = bookMenu.hidden;
    bookMenu.hidden = !nextOpen;
    bookBtn.classList.toggle("is-open", nextOpen);
    if (nextOpen) renderBookMenu();
  });

  document.addEventListener("click", closeBookMenu);

  openBtn.addEventListener("click", () => void pickAndOpenLibrary());

  newBtn.addEventListener("click", () => {
    void (async () => {
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
    })();
  });

  saveBtn.addEventListener("click", () => void save());

  updateBookButton();
  renderTree();

  // Restore last library on launch.
  const rememberedPath = localStorage.getItem(PATH_KEY);
  if (rememberedPath) {
    void openLibraryAt(rememberedPath);
  }

  return {
    el,
    save,
    destroy: () => {
      document.removeEventListener("click", closeBookMenu);
      el.remove();
    },
  };
}
