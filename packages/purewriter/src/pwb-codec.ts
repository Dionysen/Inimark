import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** MD5 of empty content — written as `MD5` inside modern `.pwb` archives. */
export const PWB_EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";

/** 7z magic (`7z\xBC\xAF\x27\x1C`). */
export const PWB_7Z_MAGIC = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);

/** SQLite header prefix. */
export const SQLITE_MAGIC = "SQLite format 3";

export function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

export function startsWithMagic(bytes: Uint8Array, magic: Uint8Array | string): boolean {
  if (typeof magic === "string") {
    if (bytes.length < magic.length) return false;
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic.charCodeAt(i)) return false;
    }
    return true;
  }
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

export type PureWriterPayloadKind = "room-db" | "pwb";

/** Detect whether bytes are a raw Room.db or a `.pwb` (7z) archive. */
export function detectPureWriterPayload(bytes: Uint8Array): PureWriterPayloadKind {
  if (startsWithMagic(bytes, SQLITE_MAGIC)) return "room-db";
  if (startsWithMagic(bytes, PWB_7Z_MAGIC)) return "pwb";
  throw new Error("unrecognized Pure Writer payload (expected Room.db or .pwb)");
}

async function resolveSevenZipPath(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    const mod = await import("7zip-bin");
    return mod.path7za;
  } catch {
    /* fall through */
  }
  return "7z";
}

export interface PwbCodecOptions {
  /** Absolute path to a 7-Zip CLI (`7z` / `7za`). */
  sevenZipPath?: string;
  /**
   * Base file name inside the archive (without extension).
   * Produces `{base}.db` plus MD5 sidecars.
   */
  archiveBaseName?: string;
}

/**
 * Pack Room.db bytes into a Pure Writer `.pwb` (7z) archive.
 * Requires a 7-Zip binary (`7zip-bin` dependency or system `7z`).
 */
export async function encodePwb(
  roomDbBytes: Uint8Array,
  options: PwbCodecOptions = {},
): Promise<Uint8Array> {
  const sevenZip = await resolveSevenZipPath(options.sevenZipPath);
  const base = options.archiveBaseName ?? "PureWriterBackup";
  const dbName = `${base}.db`;
  const dir = await mkdtemp(join(tmpdir(), "inimark-pwb-"));
  try {
    const dbPath = join(dir, dbName);
    const md5Path = join(dir, "MD5");
    const md5v2Path = join(dir, "MD5V2");
    const outPath = join(dir, `${base}.pwb`);

    await writeFile(dbPath, roomDbBytes);
    await writeFile(md5Path, PWB_EMPTY_MD5, "utf8");
    await writeFile(md5v2Path, md5Hex(roomDbBytes), "utf8");

    await execFileAsync(sevenZip, ["a", "-t7z", "-mx=5", outPath, dbName, "MD5", "MD5V2"], {
      cwd: dir,
      windowsHide: true,
    });

    return new Uint8Array(await readFile(outPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Extract Room.db bytes from a `.pwb` (7z) archive.
 */
export async function decodePwb(
  pwbBytes: Uint8Array,
  options: PwbCodecOptions = {},
): Promise<Uint8Array> {
  const sevenZip = await resolveSevenZipPath(options.sevenZipPath);
  const dir = await mkdtemp(join(tmpdir(), "inimark-pwb-x-"));
  try {
    const archivePath = join(dir, "archive.pwb");
    await writeFile(archivePath, pwbBytes);
    await execFileAsync(sevenZip, ["x", archivePath, `-o${dir}`, "-y"], {
      cwd: dir,
      windowsHide: true,
    });

    const { readdir } = await import("node:fs/promises");
    const names = await readdir(dir);
    const dbName = names.find((n) => n.toLowerCase().endsWith(".db"));
    if (!dbName) {
      throw new Error(".pwb archive does not contain a .db file");
    }
    return new Uint8Array(await readFile(join(dir, dbName)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Suggest a `.pwb` file name from a human label (folder count / article count optional). */
export function suggestPwbFileName(parts: {
  folderCount: number;
  articleCount: number;
  hostLabel?: string;
  at?: Date;
}): string {
  const at = parts.at ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  const host = parts.hostLabel ?? "Inimark";
  return `PureWriterBackup-${parts.folderCount}文件夹-${parts.articleCount}篇文章-${stamp}-Desktop-${host}.pwb`;
}

/** Strip directory prefixes for archive base naming. */
export function archiveBaseFromPath(filePath: string): string {
  const name = basename(filePath);
  return name.replace(/\.pwb$/i, "").replace(/\.db$/i, "");
}
