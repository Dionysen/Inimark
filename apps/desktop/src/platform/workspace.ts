import {
  pickMarkdownDirectory,
  readMarkdownFileHandle,
} from "@inimark/editor";

import { fileNameFromPath, isTauri, joinWorkspacePath } from "./env.ts";
import type {
  Workspace,
  WorkspaceFileResult,
  WorkspacePickResult,
  WorkspaceTreeNode,
} from "./types.ts";

const LAST_WORKSPACE_KEY = "inimark:lastWorkspace";

export function getLastWorkspacePath(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function rememberWorkspacePath(path: string): void {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, path);
  } catch {}
}

export async function pickWorkspace(): Promise<WorkspacePickResult> {
  if (isTauri()) return pickWorkspaceTauri();
  return pickWorkspaceBrowser();
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

async function pickWorkspaceBrowser(): Promise<WorkspacePickResult> {
  const picked = await pickMarkdownDirectory();
  if (picked.status !== "picked") return picked;
  const workspace: Workspace = {
    rootPath: picked.tree.path,
    rootName: picked.tree.name,
    tree: picked.tree.children ?? [],
  };
  rememberWorkspacePath(workspace.rootPath);
  return { status: "picked", workspace };
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
    const tree = await buildTauriTree(rootPath);
    const workspace: Workspace = {
      rootPath,
      rootName: fileNameFromPath(rootPath),
      tree,
    };
    rememberWorkspacePath(rootPath);
    return { status: "picked", workspace };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function buildTauriTree(rootPath: string): Promise<WorkspaceTreeNode[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  return readTauriDirectory(readDir, rootPath, rootPath);
}

async function readTauriDirectory(
  readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>,
  rootPath: string,
  currentPath: string,
): Promise<WorkspaceTreeNode[]> {
  const entries = await readDir(currentPath);
  const nodes: WorkspaceTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = joinPath(currentPath, entry.name);
    const relativePath = toRelativePath(rootPath, fullPath);
    if (entry.isDirectory) {
      const children = await readTauriDirectory(readDir, rootPath, fullPath);
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          kind: "directory",
          children,
        });
      }
    } else if (/\.(md|markdown|mdown)$/i.test(entry.name)) {
      nodes.push({ name: entry.name, path: relativePath, kind: "file" });
    }
  }

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
