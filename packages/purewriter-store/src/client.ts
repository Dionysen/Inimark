import { invoke } from "@tauri-apps/api/core";
import type {
  Article,
  ArticleMeta,
  Category,
  CreateArticle,
  CreateCategory,
  CreateFolder,
  Folder,
  OpenLibraryResult,
  SchemaStatus,
  Setting,
  UpdateArticle,
  UpdateCategory,
} from "./types.ts";

/** Open a Pure Writer library root (directory containing App/Room.db). */
export function pwOpen(root: string): Promise<OpenLibraryResult> {
  return invoke("pw_open", { root });
}

export function pwClose(): Promise<void> {
  return invoke("pw_close");
}

export function pwSchemaStatus(): Promise<SchemaStatus> {
  return invoke("pw_schema_status");
}

export function pwListFolders(includeDeleted = false): Promise<Folder[]> {
  return invoke("pw_list_folders", { includeDeleted });
}

export function pwListCategories(
  folderId?: string | null,
  includeDeleted = false,
): Promise<Category[]> {
  return invoke("pw_list_categories", { folderId: folderId ?? null, includeDeleted });
}

export function pwListArticles(
  folderId?: string | null,
  categoryId?: string | null,
  includeDeleted = false,
): Promise<ArticleMeta[]> {
  return invoke("pw_list_articles", {
    folderId: folderId ?? null,
    categoryId: categoryId ?? null,
    includeDeleted,
  });
}

export function pwGetArticle(id: string): Promise<Article> {
  return invoke("pw_get_article", { id });
}

export function pwCreateFolder(input: CreateFolder): Promise<Folder> {
  return invoke("pw_create_folder", { input });
}

export function pwCreateCategory(input: CreateCategory): Promise<Category> {
  return invoke("pw_create_category", { input });
}

export function pwCreateArticle(input: CreateArticle): Promise<Article> {
  return invoke("pw_create_article", { input });
}

export function pwUpdateArticle(id: string, patch: UpdateArticle): Promise<Article> {
  return invoke("pw_update_article", { id, patch });
}

export function pwTrashArticle(id: string): Promise<Article> {
  return invoke("pw_trash_article", { id });
}

/** Permanently delete an article that is already in the trash. */
export function pwPurgeArticle(id: string): Promise<void> {
  return invoke("pw_purge_article", { id });
}

export function pwUpdateCategory(id: string, patch: UpdateCategory): Promise<Category> {
  return invoke("pw_update_category", { id, patch });
}

/** Soft-delete a volume. Its chapters become uncategorized. */
export function pwDeleteCategory(id: string): Promise<void> {
  return invoke("pw_delete_category", { id });
}

/** Persist sibling article order. `ids` is the full new sequence. */
export function pwReorderArticles(ids: string[]): Promise<void> {
  return invoke("pw_reorder_articles", { ids });
}

/** Persist volume order. `ids` is the full new sequence of category ids. */
export function pwReorderCategories(ids: string[]): Promise<void> {
  return invoke("pw_reorder_categories", { ids });
}

export function pwListSettings(): Promise<Setting[]> {
  return invoke("pw_list_settings");
}

export function pwSetSetting(key: string, value: string): Promise<Setting> {
  return invoke("pw_set_setting", { key, value });
}

export function pwExportPwb(path: string): Promise<void> {
  return invoke("pw_pwb_export", { path });
}

export function pwImportPwb(path: string): Promise<string> {
  return invoke("pw_pwb_import", { path });
}
