export type WorkspaceTreeNode = {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: WorkspaceTreeNode[];
  /** Last modified time (ms since epoch), when available. */
  mtimeMs?: number;
  /** Creation time (ms since epoch), when available. */
  birthtimeMs?: number;
  /** Browser File System Access API handle (not available in Tauri mode). */
  handle?: FileSystemFileHandle;
};

export type Workspace = {
  rootPath: string;
  rootName: string;
  tree: WorkspaceTreeNode[];
};

export type WorkspacePickResult =
  | { status: "picked"; workspace: Workspace }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export type WorkspaceFileResult =
  | { status: "opened"; path: string; name: string; text: string }
  | { status: "saved"; path: string; name: string }
  | { status: "error"; message: string };
