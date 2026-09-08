import {
  buildMarkdownTreeFromDirectory,
  pickMarkdownDirectory,
  readMarkdownFileHandle,
} from "@inimark/editor";

import {
  deleteDirectoryHandle,
  ensureDirectoryPermission,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "../libraries/handles.ts";
import { libraryIdFromPath, upsertLibrary } from "../libraries/store.ts";
import { fileNameFromPath, isTauri, joinWorkspacePath } from "./env.ts";
import type {
  Workspace,
  WorkspaceFileResult,
  WorkspacePickResult,
  WorkspaceTreeNode,
} from "./types.ts";

export async function pickWorkspace(): Promise<WorkspacePickResult> {
  if (isTauri()) return pickWorkspaceTauri();
  return pickWorkspaceBrowser();
}

export async function openWorkspaceByPath(rootPath: string): Promise<WorkspacePickResult> {
  if (isTauri()) return openWorkspaceByPathTauri(rootPath);
  return openWorkspaceByPathBrowser(rootPath);
}

export async function readWorkspaceFile(
  workspace: Workspace,
  relativePath: string,
): Promise<WorkspaceFileResult> {
  if (isTauri()) return readWorkspaceFileTauri(workspace, relativePath);
  return readWorkspaceFileBrowser(workspace, relativePath);
}

export async function writeWorkspaceFile(
  workspace: Workspace,
  relativePath: string,
  text: string,
): Promise<WorkspaceFileResult> {
  if (isTauri()) return writeWorkspaceFileTauri(workspace, relativePath, text);
  return writeWorkspaceFileBrowser(workspace, relativePath, text);
}

export async function refreshWorkspaceTree(
  workspace: Workspace,
): Promise<WorkspaceTreeNode[]> {
  if (isTauri()) return buildTauriTree(workspace.rootPath);
  return workspace.tree;
}

export function defaultExpandedDirs(workspace: Workspace): string[] {
  return workspace.tree
    .filter((node) => node.kind === "directory")
    .map((node) => node.path);
}

function toWorkspaceTree(nodes: WorkspaceTreeNode[] | undefined): WorkspaceTreeNode[] {
  return nodes ?? [];
}

async function pickWorkspaceBrowser(): Promise<WorkspacePickResult> {
  const picked = await pickMarkdownDirectory();
  if (picked.status !== "picked") return picked;
  const workspace: Workspace = {
    rootPath: picked.tree.path,
    rootName: picked.tree.name,
    tree: toWorkspaceTree(picked.tree.children),
  };
  const libraryId = libraryIdFromPath(workspace.rootPath);
  await saveDirectoryHandle(libraryId, picked.directoryHandle);
  upsertLibrary(workspace.rootPath, workspace.rootName);
  return { status: "picked", workspace };
}

async function openWorkspaceByPathBrowser(rootPath: string): Promise<WorkspacePickResult> {
  const libraryId = libraryIdFromPath(rootPath);
  const handle = await loadDirectoryHandle(libraryId);
  if (!handle) {
    return {
      status: "error",
      message: "Library access expired. Open the folder again from the library menu.",
    };
  }

  const allowed = await ensureDirectoryPermission(handle);
  if (!allowed) {
    return { status: "error", message: "Permission denied for library folder." };
  }

  try {
    const tree = await buildMarkdownTreeFromDirectory(handle);
    const workspace: Workspace = {
      rootPath: tree.path,
      rootName: tree.name,
      tree: toWorkspaceTree(tree.children),
    };
    upsertLibrary(workspace.rootPath, workspace.rootName);
    return { status: "picked", workspace };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readWorkspaceFileBrowser(
  workspace: Workspace,
  relativePath: string,
): Promise<WorkspaceFileResult> {
  const node = findTreeNode(workspace.tree, relativePath);
  if (!node?.handle) {
    return { status: "error", message: `File not found in workspace: ${relativePath}` };
  }
  const opened = await readMarkdownFileHandle(node.handle);
  if (opened.status !== "opened") return opened;
  return {
    status: "opened",
    path: relativePath,
    name: opened.name,
    text: opened.text,
  };
}

async function writeWorkspaceFileBrowser(
  workspace: Workspace,
  relativePath: string,
  text: string,
): Promise<WorkspaceFileResult> {
  const node = findTreeNode(workspace.tree, relativePath);
  if (!node?.handle) {
    return { status: "error", message: `File not found in workspace: ${relativePath}` };
  }
  try {
    const writable = await node.handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { status: "saved", path: relativePath, name: node.name };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function findTreeNode(
  nodes: WorkspaceTreeNode[],
  path: string,
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findTreeNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

async function pickWorkspaceTauri(): Promise<WorkspacePickResult> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open folder as library",
    });
    if (selected === null) return { status: "cancelled" };
    const rootPath = typeof selected === "string" ? selected : selected;
    return openWorkspaceByPathTauri(rootPath);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function openWorkspaceByPathTauri(rootPath: string): Promise<WorkspacePickResult> {
  try {
    const tree = await buildTauriTree(rootPath);
    const workspace: Workspace = {
      rootPath,
      rootName: fileNameFromPath(rootPath),
      tree,
    };
    upsertLibrary(rootPath, workspace.rootName);
    return { status: "picked", workspace };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function buildTauriTree(rootPath: string): Promise<WorkspaceTreeNode[]> {
  const { readDir, stat } = await import("@tauri-apps/plugin-fs");
  return readTauriDirectory(readDir, stat, rootPath, rootPath);
}

async function readTauriDirectory(
  readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>,
  stat: (path: string) => Promise<{ mtime: Date | null; birthtime: Date | null }>,
  rootPath: string,
  currentPath: string,
): Promise<WorkspaceTreeNode[]> {
  const entries = await readDir(currentPath);
  const filtered = entries.filter((entry) => !entry.name.startsWith("."));

  const nodes = (
    await Promise.all(
      filtered.map(async (entry): Promise<WorkspaceTreeNode | null> => {
        const fullPath = joinPath(currentPath, entry.name);
        const relativePath = toRelativePath(rootPath, fullPath);

        let mtimeMs: number | undefined;
        let birthtimeMs: number | undefined;
        try {
          const info = await stat(fullPath);
          mtimeMs = info.mtime?.getTime();
          birthtimeMs = info.birthtime?.getTime();
        } catch {
          /* ignore missing metadata */
        }

        if (entry.isDirectory) {
          const children = await readTauriDirectory(readDir, stat, rootPath, fullPath);
          return {
            name: entry.name,
            path: relativePath,
            kind: "directory",
            children,
            mtimeMs,
            birthtimeMs,
          };
        }

        if (/\.(md|markdown|mdown)$/i.test(entry.name)) {
          return {
            name: entry.name,
            path: relativePath,
            kind: "file",
            mtimeMs,
            birthtimeMs,
          };
        }

        return null;
      }),
    )
  ).filter((node): node is WorkspaceTreeNode => node != null);

  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return nodes;
}

async function readWorkspaceFileTauri(
  workspace: Workspace,
  relativePath: string,
): Promise<WorkspaceFileResult> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    const text = await readTextFile(fullPath);
    return {
      status: "opened",
      path: relativePath,
      name: fileNameFromPath(relativePath),
      text,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function writeWorkspaceFileTauri(
  workspace: Workspace,
  relativePath: string,
  text: string,
): Promise<WorkspaceFileResult> {
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    await writeTextFile(fullPath, text);
    return {
      status: "saved",
      path: relativePath,
      name: fileNameFromPath(relativePath),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Create a new markdown file (Tauri). Browser returns an error for now. */
export async function createWorkspaceFile(
  workspace: Workspace,
  relativePath: string,
  text = "",
): Promise<WorkspaceFileResult> {
  if (!isTauri()) {
    return { status: "error", message: "Creating files is only supported in the desktop app." };
  }
  return writeWorkspaceFileTauri(workspace, relativePath, text);
}

/** Create a new directory (Tauri). Browser returns an error for now. */
export async function createWorkspaceDirectory(
  workspace: Workspace,
  relativePath: string,
): Promise<{ status: "created"; path: string } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Creating folders is only supported in the desktop app." };
  }
  try {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    await mkdir(fullPath, { recursive: true });
    return { status: "created", path: relativePath };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function renameWorkspaceEntry(
  workspace: Workspace,
  fromRelative: string,
  toRelative: string,
): Promise<{ status: "renamed"; path: string } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Renaming is only supported in the desktop app." };
  }
  try {
    const { rename, exists } = await import("@tauri-apps/plugin-fs");
    const fromPath = joinWorkspacePath(workspace.rootPath, fromRelative);
    const toPath = joinWorkspacePath(workspace.rootPath, toRelative);
    if (await exists(toPath)) {
      return { status: "error", message: `Already exists: ${toRelative}` };
    }
    await rename(fromPath, toPath);
    return { status: "renamed", path: toRelative };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function uniqueChildRelativePath(
  workspace: Workspace,
  destDir: string,
  name: string,
): Promise<string> {
  const { exists } = await import("@tauri-apps/plugin-fs");
  const joinRel = (dir: string, file: string) =>
    dir ? `${dir.replace(/\\/g, "/")}/${file}` : file;

  let candidate = joinRel(destDir, name);
  if (!(await exists(joinWorkspacePath(workspace.rootPath, candidate)))) {
    return candidate;
  }

  const dot = name.includes(".") && !name.startsWith(".") ? name.lastIndexOf(".") : -1;
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  for (let i = 1; i < 1000; i++) {
    candidate = joinRel(destDir, `${base} ${i}${ext}`);
    if (!(await exists(joinWorkspacePath(workspace.rootPath, candidate)))) {
      return candidate;
    }
  }
  return joinRel(destDir, `${base} ${Date.now()}${ext}`);
}

async function copyPathRecursive(fromPath: string, toPath: string): Promise<void> {
  const { copyFile, mkdir, readDir, stat } = await import("@tauri-apps/plugin-fs");
  const info = await stat(fromPath);
  if (info.isDirectory) {
    await mkdir(toPath, { recursive: true });
    const entries = await readDir(fromPath);
    for (const entry of entries) {
      await copyPathRecursive(joinPath(fromPath, entry.name), joinPath(toPath, entry.name));
    }
    return;
  }
  await copyFile(fromPath, toPath);
}

function isForbiddenDest(sourceRelative: string, destDir: string): boolean {
  const src = sourceRelative.replace(/\\/g, "/");
  const dest = destDir.replace(/\\/g, "/");
  if (dest === src) return true;
  return dest.startsWith(`${src}/`);
}

/** Copy a file or folder into `destDir` ("" = vault root). */
export async function copyWorkspaceEntry(
  workspace: Workspace,
  fromRelative: string,
  destDir: string,
): Promise<{ status: "copied"; path: string } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Copying is only supported in the desktop app." };
  }
  const from = fromRelative.replace(/\\/g, "/");
  const dest = destDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (isForbiddenDest(from, dest)) {
    return { status: "error", message: "Cannot copy a folder into itself." };
  }
  try {
    const name = fileNameFromPath(from);
    const toRelative = await uniqueChildRelativePath(workspace, dest, name);
    const fromPath = joinWorkspacePath(workspace.rootPath, from);
    const toPath = joinWorkspacePath(workspace.rootPath, toRelative);
    await copyPathRecursive(fromPath, toPath);
    return { status: "copied", path: toRelative };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Move a file or folder into `destDir` ("" = vault root). */
export async function moveWorkspaceEntry(
  workspace: Workspace,
  fromRelative: string,
  destDir: string,
): Promise<{ status: "moved"; path: string } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Moving is only supported in the desktop app." };
  }
  const from = fromRelative.replace(/\\/g, "/");
  const dest = destDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (isForbiddenDest(from, dest)) {
    return { status: "error", message: "Cannot move a folder into itself." };
  }
  const parentIdx = from.lastIndexOf("/");
  const currentParent = parentIdx >= 0 ? from.slice(0, parentIdx) : "";
  if (currentParent === dest) {
    return { status: "moved", path: from };
  }
  try {
    const name = fileNameFromPath(from);
    const toRelative = await uniqueChildRelativePath(workspace, dest, name);
    const result = await renameWorkspaceEntry(workspace, from, toRelative);
    if (result.status === "error") return result;
    return { status: "moved", path: result.path };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteWorkspaceEntry(
  workspace: Workspace,
  relativePath: string,
): Promise<{ status: "deleted" } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Deleting is only supported in the desktop app." };
  }
  try {
    const { remove } = await import("@tauri-apps/plugin-fs");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    await remove(fullPath, { recursive: true });
    return { status: "deleted" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function revealWorkspaceEntry(
  workspace: Workspace,
  relativePath: string,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Reveal is only supported in the desktop app." };
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    await invoke("reveal_in_file_manager", { path: fullPath });
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openWorkspaceEntryWithDefaultApp(
  workspace: Workspace,
  relativePath: string,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  if (!isTauri()) {
    return { status: "error", message: "Open is only supported in the desktop app." };
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const fullPath = joinWorkspacePath(workspace.rootPath, relativePath);
    await invoke("open_with_default_app", { path: fullPath });
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function removeLibraryAccess(libraryId: string): Promise<void> {
  if (!isTauri()) {
    await deleteDirectoryHandle(libraryId);
  }
}

function joinPath(base: string, name: string): string {
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base.replace(/[/\\]+$/, "")}${sep}${name}`;
}

function toRelativePath(rootPath: string, fullPath: string): string {
  const normRoot = rootPath.replace(/[/\\]+$/, "");
  const normFull = fullPath.replace(/\\/g, "/");
  const normRootSlash = normRoot.replace(/\\/g, "/");
  if (normFull.startsWith(normRootSlash)) {
    return normFull.slice(normRootSlash.length + 1);
  }
  return fullPath;
}
