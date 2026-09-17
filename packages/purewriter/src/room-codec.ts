import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { ROOM_DDL } from "./room-schema.ts";
import type {
  PureWriterArticle,
  PureWriterCategory,
  PureWriterFolder,
  PureWriterLibrary,
  PureWriterSetting,
  RoomCodecOptions,
} from "./types.ts";
import { ROOM_IDENTITY_HASH, ROOM_USER_VERSION } from "./vault-map.ts";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Load sql.js once. In Node, resolves the bundled wasm next to the package;
 * in browsers, pass `locateFile` via {@link initRoomSqlJs}.
 */
export async function initRoomSqlJs(
  options?: Parameters<typeof initSqlJs>[0],
): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs(options);
  }
  return sqlJsPromise;
}

/** Reset the cached sql.js module (tests only). */
export function resetRoomSqlJsForTests(): void {
  sqlJsPromise = null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function strOrNull(value: unknown): string | null {
  if (value == null) return null;
  return str(value);
}

function tableColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const cols = new Set<string>();
  if (!result[0]) return cols;
  const nameIdx = result[0].columns.indexOf("name");
  for (const row of result[0].values) {
    cols.add(str(row[nameIdx]));
  }
  return cols;
}

function readRows(db: Database, sql: string): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Decode a Pure Writer `Room.db` (or backup `.db`) into the domain model.
 * Extra tables (Daily, History, …) are ignored — notes round-trip only needs
 * Folder / Category / Article / Setting.
 */
export function decodeRoomDatabase(SQL: SqlJsStatic, bytes: Uint8Array): PureWriterLibrary {
  const db = new SQL.Database(bytes);
  try {
    const folderCols = tableColumns(db, "Folder");
    const categoryCols = tableColumns(db, "Category");
    const articleCols = tableColumns(db, "Article");
    if (folderCols.size === 0 || articleCols.size === 0) {
      throw new Error("not a Pure Writer Room database (missing Folder/Article)");
    }

    const folders: PureWriterFolder[] = readRows(db, "SELECT * FROM Folder").map((row) => ({
      id: str(row.id),
      name: str(row.name),
      createdTime: num(row.createdTime),
      description: strOrNull(row.description),
      rank: num(row.rank),
      deleted: num(row.deleted),
      deletedTime: num(row.deletedTime),
      selectedArticleId: strOrNull(row.selectedArticleId),
      selectedArticleId1: strOrNull(row.selectedArticleId1),
      selectedOutlineId: strOrNull(row.selectedOutlineId),
      extension: strOrNull(row.extension),
      updateTime: num(row.updateTime),
      rankUpdateTime: num(row.rankUpdateTime),
      autoChapter: num(row.autoChapter),
      autoChapterUpdateTime: num(row.autoChapterUpdateTime),
      autoChapterResetForCategory: num(row.autoChapterResetForCategory),
      autoChapterResetForCategoryUpdateTime: num(row.autoChapterResetForCategoryUpdateTime),
      autoChapterReplaceBadPrefix: num(row.autoChapterReplaceBadPrefix),
      autoChapterReplaceBadPrefixUpdateTime: num(row.autoChapterReplaceBadPrefixUpdateTime),
      tags: strOrNull(row.tags),
      tagsUpdateTime: num(row.tagsUpdateTime),
      rankMode: strOrNull(row.rankMode),
      rankModeUpdateTime: num(row.rankModeUpdateTime),
    }));

    const categories: PureWriterCategory[] = categoryCols.size
      ? readRows(db, "SELECT * FROM Category").map((row) => ({
          id: str(row.id),
          folderId: str(row.folderId),
          name: str(row.name),
          createdTime: num(row.createdTime),
          collapsed: num(row.collapsed),
          rank: num(row.rank),
          description: strOrNull(row.description),
          rankUpdateTime: num(row.rankUpdateTime),
          folderIdUpdateTime: num(row.folderIdUpdateTime),
          updateTime: num(row.updateTime),
          deleted: num(row.deleted),
          deletedTime: num(row.deletedTime),
          orderKey: strOrNull(row.orderKey),
          structureUpdateTime: num(row.structureUpdateTime),
        }))
      : [];

    const articles: PureWriterArticle[] = readRows(db, "SELECT * FROM Article").map((row) => ({
      id: str(row.id),
      title: str(row.title),
      content: str(row.content),
      summary: strOrNull(row.summary),
      count: row.count == null ? null : num(row.count),
      extension: str(row.extension, "txt"),
      preview: num(row.preview),
      preview1: num(row.preview1),
      updateTime: num(row.updateTime),
      createTime: num(row.createTime),
      folderId: str(row.folderId),
      categoryId: strOrNull(row.categoryId),
      editorId: num(row.editorId),
      rank: num(row.rank),
      titleUpdateTime: num(row.titleUpdateTime),
      rankUpdateTime: num(row.rankUpdateTime),
      folderIdUpdateTime: num(row.folderIdUpdateTime),
      categoryIdUpdateTime: num(row.categoryIdUpdateTime),
      extensionUpdateTime: num(row.extensionUpdateTime),
      deleted: num(row.deleted),
      deletedTime: num(row.deletedTime),
      autoChapter: num(row.autoChapter),
      autoChapterUpdateTime: num(row.autoChapterUpdateTime),
      orderKey: strOrNull(row.orderKey),
      structureUpdateTime: num(row.structureUpdateTime),
    }));

    const settings: PureWriterSetting[] = tableColumns(db, "Setting").size
      ? readRows(db, "SELECT * FROM Setting").map((row) => ({
          key: str(row.key),
          value: str(row.value),
          updateTime: num(row.updateTime),
        }))
      : [];

    const userVersionRow = db.exec("PRAGMA user_version");
    const userVersion = num(userVersionRow[0]?.values[0]?.[0], ROOM_USER_VERSION);

    let roomIdentityHash: string | null = null;
    if (tableColumns(db, "room_master_table").size) {
      const identity = readRows(db, "SELECT identity_hash FROM room_master_table WHERE id = 42");
      roomIdentityHash = identity[0] ? strOrNull(identity[0].identity_hash) : null;
    }

    return {
      folders,
      categories,
      articles,
      settings,
      userVersion,
      roomIdentityHash,
    };
  } finally {
    db.close();
  }
}

/**
 * Encode a Pure Writer library into a SQLite `Room.db` byte array.
 */
export function encodeRoomDatabase(
  SQL: SqlJsStatic,
  library: PureWriterLibrary,
  options: RoomCodecOptions = {},
): Uint8Array {
  const db = new SQL.Database();
  try {
    for (const ddl of ROOM_DDL) {
      db.run(ddl);
    }

    db.run("INSERT INTO android_metadata (locale) VALUES (?)", ["zh_CN"]);
    const identity = options.roomIdentityHash ?? library.roomIdentityHash ?? ROOM_IDENTITY_HASH;
    db.run("INSERT INTO room_master_table (id, identity_hash) VALUES (42, ?)", [identity]);

    const insertFolder = db.prepare(`
      INSERT INTO Folder (
        id, name, createdTime, description, rank, deleted, deletedTime,
        selectedArticleId, selectedArticleId1, selectedOutlineId, extension,
        updateTime, rankUpdateTime, autoChapter, autoChapterUpdateTime,
        autoChapterResetForCategory, autoChapterResetForCategoryUpdateTime,
        autoChapterReplaceBadPrefix, autoChapterReplaceBadPrefixUpdateTime,
        tags, tagsUpdateTime, rankMode, rankModeUpdateTime
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `);
    for (const f of library.folders) {
      insertFolder.run([
        f.id,
        f.name,
        f.createdTime,
        f.description,
        f.rank,
        f.deleted,
        f.deletedTime,
        f.selectedArticleId,
        f.selectedArticleId1,
        f.selectedOutlineId,
        f.extension,
        f.updateTime,
        f.rankUpdateTime,
        f.autoChapter,
        f.autoChapterUpdateTime,
        f.autoChapterResetForCategory,
        f.autoChapterResetForCategoryUpdateTime,
        f.autoChapterReplaceBadPrefix,
        f.autoChapterReplaceBadPrefixUpdateTime,
        f.tags,
        f.tagsUpdateTime,
        f.rankMode,
        f.rankModeUpdateTime,
      ]);
    }
    insertFolder.free();

    const insertCategory = db.prepare(`
      INSERT INTO Category (
        id, folderId, name, createdTime, collapsed, rank, description,
        rankUpdateTime, folderIdUpdateTime, updateTime, deleted, deletedTime,
        orderKey, structureUpdateTime
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const c of library.categories) {
      insertCategory.run([
        c.id,
        c.folderId,
        c.name,
        c.createdTime,
        c.collapsed,
        c.rank,
        c.description,
        c.rankUpdateTime,
        c.folderIdUpdateTime,
        c.updateTime,
        c.deleted,
        c.deletedTime,
        c.orderKey,
        c.structureUpdateTime,
      ]);
    }
    insertCategory.free();

    const insertArticle = db.prepare(`
      INSERT INTO Article (
        id, title, content, summary, count, extension, preview, preview1,
        updateTime, createTime, folderId, categoryId, editorId, rank,
        titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime,
        extensionUpdateTime, deleted, deletedTime, autoChapter, autoChapterUpdateTime,
        orderKey, structureUpdateTime
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const a of library.articles) {
      insertArticle.run([
        a.id,
        a.title,
        a.content,
        a.summary,
        a.count,
        a.extension,
        a.preview,
        a.preview1,
        a.updateTime,
        a.createTime,
        a.folderId,
        a.categoryId,
        a.editorId,
        a.rank,
        a.titleUpdateTime,
        a.rankUpdateTime,
        a.folderIdUpdateTime,
        a.categoryIdUpdateTime,
        a.extensionUpdateTime,
        a.deleted,
        a.deletedTime,
        a.autoChapter,
        a.autoChapterUpdateTime,
        a.orderKey,
        a.structureUpdateTime,
      ]);
    }
    insertArticle.free();

    const insertSetting = db.prepare(
      "INSERT INTO Setting (key, value, updateTime) VALUES (?,?,?)",
    );
    for (const s of library.settings) {
      insertSetting.run([s.key, s.value, s.updateTime]);
    }
    insertSetting.free();

    const userVersion = options.userVersion ?? library.userVersion ?? ROOM_USER_VERSION;
    db.run(`PRAGMA user_version = ${userVersion}`);

    return db.export();
  } finally {
    db.close();
  }
}

/**
 * Convenience: init sql.js (Node wasm locator) then decode.
 * Prefer injecting {@link SqlJsStatic} in browsers.
 */
export async function decodeRoomDatabaseAsync(
  bytes: Uint8Array,
  initOptions?: Parameters<typeof initSqlJs>[0],
): Promise<PureWriterLibrary> {
  const SQL = await initRoomSqlJs(initOptions);
  return decodeRoomDatabase(SQL, bytes);
}

/** Convenience: init sql.js then encode. */
export async function encodeRoomDatabaseAsync(
  library: PureWriterLibrary,
  options: RoomCodecOptions = {},
  initOptions?: Parameters<typeof initSqlJs>[0],
): Promise<Uint8Array> {
  const SQL = await initRoomSqlJs(initOptions);
  return encodeRoomDatabase(SQL, library, options);
}
