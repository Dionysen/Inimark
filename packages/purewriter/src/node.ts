import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  decodeRoomDatabase,
  encodeRoomDatabase,
  initRoomSqlJs,
} from "./room-codec.ts";
import {
  archiveBaseFromPath,
  decodePwb,
  detectPureWriterPayload,
  encodePwb,
  type PwbCodecOptions,
} from "./pwb-codec.ts";
import { isNoteFileName, normalizeVaultPath } from "./paths.ts";
import type {
  LibraryToVaultOptions,
  PureWriterLibrary,
  VaultContent,
  VaultMapOptions,
  VaultNote,
} from "./types.ts";
import { libraryToVault, vaultToLibrary } from "./vault-map.ts";

const require = createRequire(import.meta.url);

const SKIP_DIR_NAMES = new Set([
  ".git",
  ".obsidian",
  ".inimark",
  "node_modules",
  "dist",
  "landing",
]);

/** sql.js init options that locate the shipped wasm file next to `sql.js`. */
export function nodeSqlJsInitOptions(): { locateFile: (file: string) => string } {
  const sqlJsEntry = require.resolve("sql.js");
  const distDir = dirname(sqlJsEntry);
  return {
    locateFile: (file: string) => join(distDir, file),
  };
}

async function getSqlJs() {
  return initRoomSqlJs(nodeSqlJsInitOptions());
}

/**
 * Load all editable notes under a vault root into {@link VaultContent}.
 * Skips `.inimark` / `.git` / `dist` and non-note files.
 */
export async function loadVaultContentFromFs(vaultRoot: string): Promise<VaultContent> {
  const notes: VaultNote[] = [];

  async function walk(absDir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

    for (const entry of entries) {
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        await walk(abs);
        continue;
      }
      if (!entry.isFile() || !isNoteFileName(entry.name)) continue;

      const rel = normalizeVaultPath(relative(vaultRoot, abs));
      const buf = await readFile(abs);
      const info = await stat(abs);
      notes.push({
        path: rel,
        content: buf.toString("utf8"),
        mtimeMs: info.mtimeMs,
        birthtimeMs: info.birthtimeMs,
      });
    }
  }

  await walk(vaultRoot);
  return { notes };
}

/**
 * Write vault notes to disk (creates parent directories).
 * Does not delete existing files outside the snapshot.
 */
export async function writeVaultContentToFs(
  vaultRoot: string,
  vault: VaultContent,
): Promise<void> {
  for (const note of vault.notes) {
    const abs = join(vaultRoot, ...normalizeVaultPath(note.path).split("/"));
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, note.content, "utf8");
  }
}

/** Export an on-disk vault to Pure Writer `Room.db` bytes. */
export async function exportVaultToRoomDb(
  vaultRoot: string,
  mapOptions?: VaultMapOptions,
): Promise<Uint8Array> {
  const vault = await loadVaultContentFromFs(vaultRoot);
  const library = vaultToLibrary(vault, mapOptions);
  const SQL = await getSqlJs();
  return encodeRoomDatabase(SQL, library);
}

/** Export an on-disk vault to `.pwb` bytes. */
export async function exportVaultToPwb(
  vaultRoot: string,
  mapOptions?: VaultMapOptions,
  pwbOptions?: PwbCodecOptions,
): Promise<Uint8Array> {
  const db = await exportVaultToRoomDb(vaultRoot, mapOptions);
  return encodePwb(db, pwbOptions);
}

/** Import Room.db / `.pwb` bytes into a vault directory. */
export async function importPureWriterBytesToVault(
  bytes: Uint8Array,
  vaultRoot: string,
  options?: LibraryToVaultOptions & PwbCodecOptions,
): Promise<VaultContent> {
  const library = await decodePureWriterBytes(bytes, options);
  const vault = libraryToVault(library, options);
  await mkdir(vaultRoot, { recursive: true });
  await writeVaultContentToFs(vaultRoot, vault);
  return vault;
}

/** Decode Room.db or `.pwb` bytes into a library. */
export async function decodePureWriterBytes(
  bytes: Uint8Array,
  options?: PwbCodecOptions,
): Promise<PureWriterLibrary> {
  const kind = detectPureWriterPayload(bytes);
  const dbBytes = kind === "pwb" ? await decodePwb(bytes, options) : bytes;
  const SQL = await getSqlJs();
  return decodeRoomDatabase(SQL, dbBytes);
}

/** Encode a library to Room.db or `.pwb` file bytes. */
export async function encodePureWriterBytes(
  library: PureWriterLibrary,
  format: "room-db" | "pwb",
  options?: PwbCodecOptions,
): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = encodeRoomDatabase(SQL, library);
  if (format === "room-db") return db;
  return encodePwb(db, {
    ...options,
    archiveBaseName: options?.archiveBaseName ?? "PureWriterBackup-Inimark",
  });
}

/** Read a `.db` / `.pwb` path into a library. */
export async function loadPureWriterFile(
  filePath: string,
  options?: PwbCodecOptions,
): Promise<PureWriterLibrary> {
  const bytes = new Uint8Array(await readFile(filePath));
  return decodePureWriterBytes(bytes, {
    ...options,
    archiveBaseName: options?.archiveBaseName ?? archiveBaseFromPath(filePath),
  });
}

/** Write a library to a `.db` or `.pwb` path (format from extension). */
export async function savePureWriterFile(
  filePath: string,
  library: PureWriterLibrary,
  options?: PwbCodecOptions,
): Promise<void> {
  const format = filePath.toLowerCase().endsWith(".pwb") ? "pwb" : "room-db";
  const bytes = await encodePureWriterBytes(library, format, {
    ...options,
    archiveBaseName: options?.archiveBaseName ?? archiveBaseFromPath(filePath),
  });
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export {
  decodePwb,
  encodePwb,
  detectPureWriterPayload,
  md5Hex,
  suggestPwbFileName,
} from "./pwb-codec.ts";
