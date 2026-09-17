/** Vault-relative path using forward slashes. */
export type VaultRelativePath = string;

/**
 * One note file in an Inimark vault.
 * Paths are vault-relative (`Folder/Cat/Note.md`).
 */
export interface VaultNote {
  path: VaultRelativePath;
  content: string;
  /** Last modification time in epoch milliseconds, when known. */
  mtimeMs?: number;
  /** Creation time in epoch milliseconds, when known. */
  birthtimeMs?: number;
}

/**
 * Vault content boundary for this module: notes only.
 * Pure Writer stores folders / categories / articles as text notes;
 * binary assets and `.inimark` metadata are out of scope.
 */
export interface VaultContent {
  notes: VaultNote[];
}

/** Pure Writer folder (top-level notebook). */
export interface PureWriterFolder {
  id: string;
  name: string;
  createdTime: number;
  description: string | null;
  rank: number;
  deleted: number;
  deletedTime: number;
  selectedArticleId: string | null;
  selectedArticleId1: string | null;
  selectedOutlineId: string | null;
  extension: string | null;
  updateTime: number;
  rankUpdateTime: number;
  autoChapter: number;
  autoChapterUpdateTime: number;
  autoChapterResetForCategory: number;
  autoChapterResetForCategoryUpdateTime: number;
  autoChapterReplaceBadPrefix: number;
  autoChapterReplaceBadPrefixUpdateTime: number;
  tags: string | null;
  tagsUpdateTime: number;
  rankMode: string | null;
  rankModeUpdateTime: number;
}

/** Pure Writer category (section under a folder). */
export interface PureWriterCategory {
  id: string;
  folderId: string;
  name: string;
  createdTime: number;
  collapsed: number;
  rank: number;
  description: string | null;
  rankUpdateTime: number;
  folderIdUpdateTime: number;
  updateTime: number;
  deleted: number;
  deletedTime: number;
  orderKey: string | null;
  structureUpdateTime: number;
}

/** Pure Writer article (one note body). */
export interface PureWriterArticle {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  count: number | null;
  extension: string;
  preview: number;
  preview1: number;
  updateTime: number;
  createTime: number;
  folderId: string;
  categoryId: string | null;
  editorId: number;
  rank: number;
  titleUpdateTime: number;
  rankUpdateTime: number;
  folderIdUpdateTime: number;
  categoryIdUpdateTime: number;
  extensionUpdateTime: number;
  deleted: number;
  deletedTime: number;
  autoChapter: number;
  autoChapterUpdateTime: number;
  orderKey: string | null;
  structureUpdateTime: number;
}

/** Key/value preference row. */
export interface PureWriterSetting {
  key: string;
  value: string;
  updateTime: number;
}

/**
 * In-memory Pure Writer library — the portable domain model
 * behind `Room.db` / `.pwb` payloads.
 */
export interface PureWriterLibrary {
  folders: PureWriterFolder[];
  categories: PureWriterCategory[];
  articles: PureWriterArticle[];
  settings: PureWriterSetting[];
  /** Room `PRAGMA user_version` (desktop samples use 27). */
  userVersion: number;
  /** `room_master_table.identity_hash` when known. */
  roomIdentityHash: string | null;
}

export interface VaultMapOptions {
  /**
   * Folder id used for notes at vault root (no parent directory).
   * @default "Default"
   */
  defaultFolderId?: string;
  /**
   * Display name for the default folder.
   * @default "Default"
   */
  defaultFolderName?: string;
  /** Clock for create/update timestamps (epoch ms). */
  nowMs?: number;
}

export interface LibraryToVaultOptions {
  /** Include soft-deleted articles and categories. @default false */
  includeDeleted?: boolean;
  /**
   * Emit articles under the trash folder (`PW_Trash`).
   * @default false
   */
  includeTrash?: boolean;
}

export interface RoomCodecOptions {
  /** Override Room identity hash written into `room_master_table`. */
  roomIdentityHash?: string;
  /** Override `PRAGMA user_version`. @default library.userVersion or 27 */
  userVersion?: number;
}
