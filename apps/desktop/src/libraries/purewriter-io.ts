/**
 * Desktop adapter: Pure Writer import/export via Tauri FS + `@inimark/purewriter`.
 * Does not use `@inimark/purewriter/node` (Node APIs unavailable in the webview).
 */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { DirEntry } from "@tauri-apps/plugin-fs";

import {
  PUREWRITER_SOURCE_DB_FILE,
  decodeRoomDatabase,
  encodeRoomDatabase,
  initRoomSqlJs,
  isNoteFileName,
  libraryToVault,
  normalizeVaultPath,
  syncRoomDatabaseWithVault,
  vaultToLibrary,
  type PureWriterLibrary,
  type VaultContent,
  type VaultNote,
} from "@inimark/purewriter";

import { INIMARK_DIR, inimarkRelativePath } from "../workspace/paths.ts";
import { fileNameFromPath, isTauri, joinWorkspacePath } from "../platform/env.ts";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const SKIP_DIR_NAMES = new Set([
  ".git",
  ".obsidian",
  ".inimark",
  "node_modules",
  "dist",
  "landing",
]);

const SQLITE_MAGIC = "SQLite format 3";
const PWB_MAGIC = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] as const;

async function getSqlJs() {
  return initRoomSqlJs({
    locateFile: () => sqlWasmUrl,
  });
}

function startsWithSqlite(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_MAGIC.length) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

function startsWithPwb(bytes: Uint8Array): boolean {
  if (bytes.length < PWB_MAGIC.length) return false;
  for (let i = 0; i < PWB_MAGIC.length; i++) {
    if (bytes[i] !== PWB_MAGIC[i]) return false;
  }
  return true;
}

/** Resolve Room.db bytes from a `.db` or `.pwb` file payload. */
export async function roomDbBytesFromPayload(bytes: Uint8Array): Promise<Uint8Array> {
  if (startsWithSqlite(bytes)) return bytes;
  if (startsWithPwb(bytes)) {
    const unpacked = await invoke<number[]>("purewriter_unpack_pwb", {
      pwbBytes: Array.from(bytes),
    });
    return new Uint8Array(unpacked);
  }
  throw new Error("unrecognized Pure Writer file (expected .db or .pwb)");
}

export async function packRoomDbToPwb(
  dbBytes: Uint8Array,
  archiveBaseName: string,
): Promise<Uint8Array> {
  const packed = await invoke<number[]>("purewriter_pack_pwb", {
    dbBytes: Array.from(dbBytes),
    archiveBaseName,
  });
  return new Uint8Array(packed);
}

async function walkNotes(vaultRoot: string, absDir: string, out: VaultNote[]): Promise<void> {
  let entries: DirEntry[];
  try {
    entries = await readDir(absDir);
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

  for (const entry of entries) {
    const abs = joinWorkspacePath(absDir, entry.name);
    if (entry.isDirectory) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      await walkNotes(vaultRoot, abs, out);
      continue;
    }
    if (!isNoteFileName(entry.name)) continue;
    const rel = normalizeVaultPath(
      abs.slice(vaultRoot.replace(/[/\\]+$/, "").length).replace(/^[/\\]+/, ""),
    );
    const text = await readTextFile(abs);
    out.push({ path: rel, content: text });
  }
}

/** Load editable notes under a vault root (Tauri). */
export async function loadVaultContent(vaultRoot: string): Promise<VaultContent> {
  const notes: VaultNote[] = [];
  await walkNotes(vaultRoot, vaultRoot, notes);
  return { notes };
}

async function ensureParentDir(filePath: string): Promise<void> {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return;
  await mkdir(normalized.slice(0, idx), { recursive: true });
}

/** Write vault notes to disk. Continues after individual failures and reports them. */
export async function writeVaultContent(
  vaultRoot: string,
  vault: VaultContent,
): Promise<{ written: number; errors: Array<{ path: string; message: string }> }> {
  await mkdir(vaultRoot, { recursive: true });
  const errors: Array<{ path: string; message: string }> = [];
  let written = 0;
  for (const note of vault.notes) {
    const abs = joinWorkspacePath(vaultRoot, normalizeVaultPath(note.path));
    try {
      await ensureParentDir(abs);
      await writeTextFile(abs, note.content);
      written += 1;
    } catch (error) {
      errors.push({
        path: note.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { written, errors };
}

function sourceDbPath(vaultRoot: string): string {
  return joinWorkspacePath(vaultRoot, inimarkRelativePath(PUREWRITER_SOURCE_DB_FILE));
}

async function writeSourceDb(vaultRoot: string, bytes: Uint8Array): Promise<void> {
  const path = sourceDbPath(vaultRoot);
  await mkdir(joinWorkspacePath(vaultRoot, INIMARK_DIR), { recursive: true });
  await writeFile(path, bytes);
}

async function readSourceDb(vaultRoot: string): Promise<Uint8Array | null> {
  const path = sourceDbPath(vaultRoot);
  if (!(await exists(path))) return null;
  const data = await readFile(path);
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Import a Pure Writer `.pwb` / `Room.db` into a new vault folder.
 * Preserves the original database under `.inimark/purewriter-source.db` for faithful re-export.
 */
export async function importPureWriterToVault(
  sourceFilePath: string,
  vaultRoot: string,
): Promise<{ library: PureWriterLibrary; noteCount: number; skipped: number }> {
  const raw = await readFile(sourceFilePath);
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const dbBytes = await roomDbBytesFromPayload(bytes);
  const SQL = await getSqlJs();
  const library = decodeRoomDatabase(SQL, dbBytes);
  const vault = libraryToVault(library, { includeTrash: true, includeDeleted: false });
  const { written, errors } = await writeVaultContent(vaultRoot, vault);
  await writeSourceDb(vaultRoot, dbBytes);
  if (errors.length > 0 && written === 0) {
    throw new Error(errors[0]!.message);
  }
  if (errors.length > 0) {
    console.warn("Pure Writer import skipped notes:", errors.slice(0, 20));
  }
  return { library, noteCount: written, skipped: errors.length };
}

/**
 * Build Room.db bytes for the current vault.
 * Prefer syncing the imported Pure Writer source DB when present.
 */
export async function encodeVaultToRoomDb(vaultRoot: string): Promise<{
  bytes: Uint8Array;
  library: PureWriterLibrary;
  fromSource: boolean;
}> {
  const vault = await loadVaultContent(vaultRoot);
  const SQL = await getSqlJs();
  const source = await readSourceDb(vaultRoot);
  if (source) {
    const synced = syncRoomDatabaseWithVault(SQL, source, vault);
    return { bytes: synced.bytes, library: synced.library, fromSource: true };
  }
  const library = vaultToLibrary(vault);
  return { bytes: encodeRoomDatabase(SQL, library), library, fromSource: false };
}

export type PureWriterExportFormat = "pwb" | "db";

export async function exportVaultToPureWriterFile(
  vaultRoot: string,
  outPath: string,
  format: PureWriterExportFormat,
): Promise<{ noteCount: number; fromSource: boolean }> {
  const { bytes, library, fromSource } = await encodeVaultToRoomDb(vaultRoot);
  const baseName = fileNameFromPath(outPath).replace(/\.(pwb|db)$/i, "") || "PureWriterBackup";
  const payload =
    format === "pwb" ? await packRoomDbToPwb(bytes, baseName) : bytes;
  await ensureParentDir(outPath);
  await writeFile(outPath, payload);
  return { noteCount: library.articles.filter((a) => !a.deleted).length, fromSource };
}

/** Pick a Pure Writer backup / database file. */
export async function pickPureWriterSourceFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    title: "Import Pure Writer library",
    filters: [
      { name: "Pure Writer", extensions: ["pwb", "db"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

/** Pick an empty-ish folder to receive the imported vault. */
export async function pickImportDestinationFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose folder for the new library",
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

/** Save dialog for exporting `.pwb` or `.db`. */
export async function pickPureWriterExportPath(
  defaultName: string,
): Promise<{ path: string; format: PureWriterExportFormat } | null> {
  if (!isTauri()) return null;
  const selected = await save({
    defaultPath: defaultName.endsWith(".pwb") ? defaultName : `${defaultName}.pwb`,
    title: "Export Pure Writer library",
    filters: [
      { name: "Pure Writer backup", extensions: ["pwb"] },
      { name: "Room database", extensions: ["db"] },
    ],
  });
  if (!selected) return null;
  const format: PureWriterExportFormat = selected.toLowerCase().endsWith(".db") ? "db" : "pwb";
  return { path: selected, format };
}

export function suggestExportFileName(rootName: string, folderCount: number, articleCount: number): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safe = rootName.trim() || "Inimark";
  return `PureWriterBackup-${folderCount}文件夹-${articleCount}篇文章-${stamp}-Desktop-${safe}.pwb`;
}
