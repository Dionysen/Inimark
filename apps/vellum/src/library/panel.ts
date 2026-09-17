import {
  formatStoreError,
  pwCreateArticle,
  pwGetArticle,
  pwListArticles,
  pwListFolders,
  pwOpen,
  pwUpdateArticle,
  type ArticleMeta,
  type Folder,
  type OpenLibraryResult,
  type SchemaStatus,
} from "@dionysen/purewriter-store";

export interface LibraryPanel {
  el: HTMLElement;
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

/**
 * Minimal Pure Writer library chrome: open path, folder/article lists, schema banner.
 */
export function mountLibraryPanel(
  host: HTMLElement,
  options: LibraryPanelOptions,
): LibraryPanel {
  const el = document.createElement("aside");
  el.className = "vellum-library inimark-scrollbar";

  const toolbar = document.createElement("div");
  toolbar.className = "vellum-library-toolbar";

  const pathInput = document.createElement("input");
  pathInput.className = "vellum-library-path";
  pathInput.type = "text";
  pathInput.placeholder = options.t("library.pathPlaceholder");
  pathInput.spellcheck = false;
  pathInput.value = localStorage.getItem(PATH_KEY) ?? "";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "vellum-library-btn";
  openBtn.textContent = options.t("library.open");

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "vellum-library-btn";
  newBtn.textContent = options.t("library.newArticle");
  newBtn.disabled = true;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "vellum-library-btn";
  saveBtn.textContent = options.t("library.save");
  saveBtn.disabled = true;

  toolbar.append(pathInput, openBtn, newBtn, saveBtn);

  const banner = document.createElement("div");
  banner.className = "vellum-library-banner";
  banner.hidden = true;

  const foldersEl = document.createElement("div");
  foldersEl.className = "vellum-library-folders";

  const articlesEl = document.createElement("div");
  articlesEl.className = "vellum-library-articles";

  el.append(toolbar, banner, foldersEl, articlesEl);
  host.append(el);

  let opened: OpenLibraryResult | null = null;
  let folders: Folder[] = [];
  let selectedFolderId: string | null = null;
  let articles: ArticleMeta[] = [];
  let openArticleId: string | null = null;

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

  const renderFolders = () => {
    foldersEl.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "vellum-library-section-label";
    heading.textContent = options.t("library.folders");
    foldersEl.append(heading);
    for (const folder of folders) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vellum-library-item";
      if (folder.id === selectedFolderId) btn.classList.add("is-active");
      btn.textContent = folder.name;
      btn.title = folder.id;
      btn.addEventListener("click", () => {
        void selectFolder(folder.id);
      });
      foldersEl.append(btn);
    }
  };

  const renderArticles = () => {
    articlesEl.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "vellum-library-section-label";
    heading.textContent = options.t("library.articles", {
      count: articles.length,
    });
    articlesEl.append(heading);
    if (articles.length === 0) {
      const empty = document.createElement("div");
      empty.className = "vellum-library-empty";
      empty.textContent = options.t("library.noArticles");
      articlesEl.append(empty);
      return;
    }
    for (const art of articles) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vellum-library-item vellum-library-article";
      if (art.id === openArticleId) btn.classList.add("is-active");
      btn.textContent = art.title || options.t("app.untitled");
      btn.title = art.id;
      btn.addEventListener("click", () => {
        void openArticle(art.id);
      });
      articlesEl.append(btn);
    }
  };

  const selectFolder = async (folderId: string) => {
    selectedFolderId = folderId;
    renderFolders();
    articles = await pwListArticles(folderId, null, false);
    renderArticles();
  };

  const openArticle = async (id: string) => {
    const art = await pwGetArticle(id);
    openArticleId = art.id;
    renderArticles();
    options.onArticleOpen(art.title, art.content, art.id);
    saveBtn.disabled = !opened?.schema.writesAllowed;
  };

  const pickInitialFolder = (list: Folder[]): string | null => {
    const preferred = list.find((f) => f.id === "Default" && f.deleted === 0);
    if (preferred) return preferred.id;
    const nonTrash = list.find((f) => f.id !== "PW_Trash" && f.deleted === 0);
    return nonTrash?.id ?? list[0]?.id ?? null;
  };

  const openLibrary = async () => {
    const root = pathInput.value.trim();
    if (!root) {
      options.onStatus(options.t("library.needPath"));
      return;
    }
    openBtn.disabled = true;
    options.onStatus(options.t("library.opening"));
    try {
      localStorage.setItem(PATH_KEY, root);
      opened = await pwOpen(root);
      renderBanner(opened.schema);
      newBtn.disabled = !opened.schema.writesAllowed;
      saveBtn.disabled = true;
      openArticleId = null;
      folders = await pwListFolders(false);
      selectedFolderId = pickInitialFolder(folders);
      renderFolders();
      if (selectedFolderId) {
        await selectFolder(selectedFolderId);
      } else {
        articles = [];
        renderArticles();
      }
      const n = articles.length;
      options.onStatus(
        opened.schema.writesAllowed
          ? options.t("library.openedWithCount", { count: n })
          : options.t("library.openedReadonly"),
      );
    } catch (e) {
      opened = null;
      folders = [];
      articles = [];
      renderFolders();
      renderArticles();
      newBtn.disabled = true;
      saveBtn.disabled = true;
      options.onStatus(formatStoreError(e));
    } finally {
      openBtn.disabled = false;
    }
  };

  openBtn.addEventListener("click", () => void openLibrary());
  pathInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") void openLibrary();
  });

  newBtn.addEventListener("click", () => {
    void (async () => {
      if (!selectedFolderId || !opened?.schema.writesAllowed) return;
      try {
        const art = await pwCreateArticle({
          title: options.t("app.untitled"),
          content: "",
          folderId: selectedFolderId,
        });
        await selectFolder(selectedFolderId);
        await openArticle(art.id);
      } catch (e) {
        options.onStatus(formatStoreError(e));
      }
    })();
  });

  saveBtn.addEventListener("click", () => {
    void (async () => {
      const id = options.getOpenArticleId();
      if (!id || !opened?.schema.writesAllowed) return;
      try {
        await pwUpdateArticle(id, { content: options.getEditorContent() });
        options.onStatus(options.t("library.saved"));
        if (selectedFolderId) await selectFolder(selectedFolderId);
      } catch (e) {
        options.onStatus(formatStoreError(e));
      }
    })();
  });

  // Empty initial labels
  renderFolders();
  renderArticles();

  return {
    el,
    destroy: () => {
      el.remove();
    },
  };
}
