import type {
  LibraryToVaultOptions,
  PureWriterArticle,
  PureWriterCategory,
  PureWriterFolder,
  PureWriterLibrary,
  VaultContent,
  VaultMapOptions,
  VaultNote,
} from "./types.ts";
import {
  buildSummary,
  formatOrderKey,
  hashHex,
  joinNotePath,
  normalizeVaultPath,
  splitNotePath,
} from "./paths.ts";

export const DEFAULT_FOLDER_ID = "Default";
export const TRASH_FOLDER_ID = "PW_Trash";
export const ROOM_USER_VERSION = 27;
export const ROOM_IDENTITY_HASH = "af22c7c534a04acc4530d670ac9e43c4";

function emptyLibrary(): PureWriterLibrary {
  return {
    folders: [],
    categories: [],
    articles: [],
    settings: [],
    userVersion: ROOM_USER_VERSION,
    roomIdentityHash: ROOM_IDENTITY_HASH,
  };
}

function defaultFolder(now: number, id: string, name: string, rank: number): PureWriterFolder {
  return {
    id,
    name,
    createdTime: now,
    description: null,
    rank,
    deleted: 0,
    deletedTime: 0,
    selectedArticleId: null,
    selectedArticleId1: null,
    selectedOutlineId: null,
    extension: "txt",
    updateTime: now,
    rankUpdateTime: now,
    autoChapter: 0,
    autoChapterUpdateTime: 0,
    autoChapterResetForCategory: 0,
    autoChapterResetForCategoryUpdateTime: 0,
    autoChapterReplaceBadPrefix: 0,
    autoChapterReplaceBadPrefixUpdateTime: 0,
    tags: null,
    tagsUpdateTime: 0,
    rankMode: null,
    rankModeUpdateTime: 0,
  };
}

function defaultCategory(
  now: number,
  id: string,
  folderId: string,
  name: string,
  rank: number,
): PureWriterCategory {
  return {
    id,
    folderId,
    name,
    createdTime: now,
    collapsed: 0,
    rank,
    description: null,
    rankUpdateTime: now,
    folderIdUpdateTime: now,
    updateTime: now,
    deleted: 0,
    deletedTime: 0,
    orderKey: formatOrderKey(rank),
    structureUpdateTime: now,
  };
}

/**
 * Map Inimark vault notes into a Pure Writer library.
 *
 * Top-level directories become folders; deeper directories become a single
 * category path (`a/b`). Root-level notes go into the default folder.
 */
export function vaultToLibrary(
  vault: VaultContent,
  options: VaultMapOptions = {},
): PureWriterLibrary {
  const now = options.nowMs ?? Date.now();
  const defaultFolderId = options.defaultFolderId ?? DEFAULT_FOLDER_ID;
  const defaultFolderName = options.defaultFolderName ?? "Default";
  const library = emptyLibrary();

  const folderByName = new Map<string, PureWriterFolder>();
  const categoryByKey = new Map<string, PureWriterCategory>();
  const articleRanks = new Map<string, number>();

  const ensureFolder = (name: string, preferredId?: string): PureWriterFolder => {
    const existing = folderByName.get(name);
    if (existing) return existing;
    const id =
      preferredId ??
      (name === defaultFolderName ? defaultFolderId : hashHex(`folder:${name}`, 24));
    const folder = defaultFolder(now, id, name, folderByName.size);
    folderByName.set(name, folder);
    library.folders.push(folder);
    return folder;
  };

  // Always materialize the default folder so Pure Writer has a home notebook.
  ensureFolder(defaultFolderName, defaultFolderId);

  const sortedNotes = [...vault.notes].sort((a, b) =>
    normalizeVaultPath(a.path).localeCompare(normalizeVaultPath(b.path), "en"),
  );

  for (const note of sortedNotes) {
    const split = splitNotePath(note.path);
    const folderName = split.folderName ?? defaultFolderName;
    const folder = ensureFolder(
      folderName,
      folderName === defaultFolderName ? defaultFolderId : undefined,
    );

    let categoryId: string | null = null;
    if (split.categoryName) {
      const key = `${folder.id}\0${split.categoryName}`;
      let category = categoryByKey.get(key);
      if (!category) {
        const id = hashHex(`category:${folder.id}:${split.categoryName}`, 24);
        const rank = (categoryByKey.size + 1) * 10000;
        category = defaultCategory(now, id, folder.id, split.categoryName, rank);
        categoryByKey.set(key, category);
        library.categories.push(category);
      }
      categoryId = category.id;
    }

    const rankBucket = categoryId ?? folder.id;
    const nextRank = (articleRanks.get(rankBucket) ?? 0) + 1;
    articleRanks.set(rankBucket, nextRank);

    const createTime = note.birthtimeMs ?? note.mtimeMs ?? now;
    const updateTime = note.mtimeMs ?? now;
    const article: PureWriterArticle = {
      id: hashHex(`article:${normalizeVaultPath(note.path)}`, 24),
      title: split.title,
      content: note.content,
      summary: buildSummary(note.content),
      count: [...note.content].length,
      extension: split.extension,
      preview: 0,
      preview1: 0,
      updateTime,
      createTime,
      folderId: folder.id,
      categoryId,
      editorId: 0,
      rank: nextRank,
      titleUpdateTime: updateTime,
      rankUpdateTime: updateTime,
      folderIdUpdateTime: updateTime,
      categoryIdUpdateTime: updateTime,
      extensionUpdateTime: updateTime,
      deleted: 0,
      deletedTime: 0,
      autoChapter: 0,
      autoChapterUpdateTime: 0,
      orderKey: formatOrderKey(nextRank),
      structureUpdateTime: updateTime,
    };
    library.articles.push(article);
  }

  library.folders.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return library;
}

/**
 * Map a Pure Writer library back to Inimark vault notes.
 * Paths use folder/category display names (not internal ids).
 */
export function libraryToVault(
  library: PureWriterLibrary,
  options: LibraryToVaultOptions = {},
): VaultContent {
  const includeDeleted = options.includeDeleted === true;
  const includeTrash = options.includeTrash === true;

  const folderById = new Map(library.folders.map((f) => [f.id, f]));
  const categoryById = new Map(library.categories.map((c) => [c.id, c]));

  const notes: VaultNote[] = [];

  const articles = [...library.articles].sort((a, b) => {
    if (a.folderId !== b.folderId) return a.folderId.localeCompare(b.folderId);
    const ac = a.categoryId ?? "";
    const bc = b.categoryId ?? "";
    if (ac !== bc) return ac.localeCompare(bc);
    return a.rank - b.rank || a.title.localeCompare(b.title);
  });

  for (const article of articles) {
    if (!includeDeleted && article.deleted) continue;

    const folder = folderById.get(article.folderId);
    if (!folder) continue;
    if (!includeDeleted && folder.deleted) continue;
    if (!includeTrash && folder.id === TRASH_FOLDER_ID) continue;

    let categoryName: string | null = null;
    if (article.categoryId) {
      const category = categoryById.get(article.categoryId);
      if (!category) continue;
      if (!includeDeleted && category.deleted) continue;
      categoryName = category.name;
    }

    notes.push({
      path: joinNotePath({
        folderName: folder.name,
        categoryName,
        title: article.title,
        extension: article.extension,
      }),
      content: article.content,
      mtimeMs: article.updateTime,
      birthtimeMs: article.createTime,
    });
  }

  return { notes };
}
