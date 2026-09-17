/** Domain types mirroring crates/purewriter-store (camelCase JSON). */

export interface SchemaFingerprint {
  userVersion: number;
  identityHash: string;
}

export interface SchemaStatus {
  fingerprint: SchemaFingerprint;
  known: boolean;
  writesAllowed: boolean;
  allowWriteOnMismatch: boolean;
  expected: SchemaFingerprint[];
}

export interface Folder {
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

export interface Category {
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

export interface ArticleMeta {
  id: string;
  title: string;
  summary: string | null;
  count: number | null;
  extension: string;
  updateTime: number;
  createTime: number;
  folderId: string;
  categoryId: string | null;
  rank: number;
  deleted: number;
  orderKey: string | null;
}

export interface Article extends ArticleMeta {
  content: string;
  preview: number;
  preview1: number;
  editorId: number;
  titleUpdateTime: number;
  rankUpdateTime: number;
  folderIdUpdateTime: number;
  categoryIdUpdateTime: number;
  extensionUpdateTime: number;
  deletedTime: number;
  autoChapter: number;
  autoChapterUpdateTime: number;
  structureUpdateTime: number;
}

export interface Setting {
  key: string;
  value: string;
  updateTime: number;
}

export interface CreateFolder {
  name: string;
  description?: string | null;
  tags?: string | null;
}

export interface CreateCategory {
  folderId: string;
  name: string;
  description?: string | null;
}

export interface CreateArticle {
  title: string;
  content: string;
  folderId: string;
  categoryId?: string | null;
  extension?: string | null;
}

export interface UpdateArticle {
  title?: string;
  content?: string;
  folderId?: string;
  categoryId?: string | null;
  extension?: string;
  rank?: number;
}

export interface OpenLibraryResult {
  root: string;
  schema: SchemaStatus;
}

export interface StoreErrorPayload {
  code: string;
  message: string;
}

export const BASELINE_FINGERPRINT: SchemaFingerprint = {
  userVersion: 27,
  identityHash: "af22c7c534a04acc4530d670ac9e43c4",
};
