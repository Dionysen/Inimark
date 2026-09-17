import { ensureDirectoryPermission, loadDirectoryHandle } from "../libraries/handles.ts";
import { libraryIdFromPath } from "../libraries/id.ts";
import { isTauri, joinWorkspacePath } from "../platform/env.ts";
import { INIMARK_DIR, inimarkRelativePath } from "./paths.ts";

async function readInimarkFileTauri(
  rootPath: string,
  fileName: string,
): Promise<string | null> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fullPath = joinWorkspacePath(rootPath, inimarkRelativePath(fileName));
    return await readTextFile(fullPath);
  } catch (error) {
    console.warn(`Failed to read .inimark/${fileName}:`, error);
    return null;
  }
}

export async function inimarkFileExists(
  rootPath: string,
  fileName: string,
): Promise<boolean> {
  if (isTauri()) {
    try {
      const { exists } = await import("@tauri-apps/plugin-fs");
      const fullPath = joinWorkspacePath(rootPath, inimarkRelativePath(fileName));
      return await exists(fullPath);
    } catch {
      return false;
    }
  }
  try {
    const dir = await getInimarkDirHandle(rootPath);
    if (!dir) return false;
    await dir.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function writeInimarkFileTauri(
  rootPath: string,
  fileName: string,
  content: string,
): Promise<void> {
  const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
  const dirPath = joinWorkspacePath(rootPath, INIMARK_DIR);
  await mkdir(dirPath, { recursive: true });
  const fullPath = joinWorkspacePath(rootPath, inimarkRelativePath(fileName));
  await writeTextFile(fullPath, content);
}

async function getInimarkDirHandle(
  rootPath: string,
  options?: { create?: boolean },
): Promise<FileSystemDirectoryHandle | null> {
  const libraryId = libraryIdFromPath(rootPath);
  const root = await loadDirectoryHandle(libraryId);
  if (!root) return null;
  const mode = options?.create ? "readwrite" : "read";
  const allowed = await ensureDirectoryPermission(root, mode);
  if (!allowed) return null;
  try {
    return await root.getDirectoryHandle(INIMARK_DIR, { create: options?.create === true });
  } catch {
    return null;
  }
}

async function readInimarkFileBrowser(
  rootPath: string,
  fileName: string,
): Promise<string | null> {
  try {
    const dir = await getInimarkDirHandle(rootPath);
    if (!dir) return null;
    const file = await dir.getFileHandle(fileName);
    const blob = await file.getFile();
    return await blob.text();
  } catch {
    return null;
  }
}

async function writeInimarkFileBrowser(
  rootPath: string,
  fileName: string,
  content: string,
): Promise<void> {
  const dir = await getInimarkDirHandle(rootPath, { create: true });
  if (!dir) {
    throw new Error("Library folder access is unavailable.");
  }
  const file = await dir.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function readInimarkFile(
  rootPath: string,
  fileName: string,
): Promise<string | null> {
  if (isTauri()) return readInimarkFileTauri(rootPath, fileName);
  return readInimarkFileBrowser(rootPath, fileName);
}

export async function writeInimarkFile(
  rootPath: string,
  fileName: string,
  content: string,
): Promise<void> {
  if (isTauri()) {
    await writeInimarkFileTauri(rootPath, fileName, content);
    return;
  }
  await writeInimarkFileBrowser(rootPath, fileName, content);
}
