import { createEditor, type Editor } from "@inimark/editor";
import "@inimark/editor/widgets.css";
import "@inimark/editor/theme-typora.css";
import "katex/dist/katex.min.css";
import "./styles/app.css";
import {
  getLastLibraryId,
  getLibraryById,
  getLibrarySession,
  LIBRARIES_STORAGE_KEY,
  libraryIdFromPath,
  listLibraries,
  saveLibrarySession,
  setLastLibraryId,
  upsertLibrary,
} from "./libraries/store.ts";
import type { Workspace } from "./platform/types.ts";
import {
  defaultExpandedDirs,
  openWorkspaceByPath,
  pickWorkspace,
  readWorkspaceFile,
  refreshWorkspaceTree,
  writeWorkspaceFile,
} from "./platform/workspace.ts";
import { applySettings, loadSettings, SETTINGS_STORAGE_KEY } from "./settings/store.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { mountShell } from "./shell.ts";

export interface AppController {
  editor: Editor;
  destroy(): void;
}

export function mountApp(host: HTMLElement): AppController {
  const settings = loadSettings();
  applySettings(settings);

  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      applySettings(loadSettings());
    }
    if (event.key === LIBRARIES_STORAGE_KEY) {
      refreshLibraryList();
      if (activeLibraryId && !getLibraryById(activeLibraryId)) {
        workspace = null;
        activeFilePath = null;
        activeLibraryId = null;
        shell.sidebar.setWorkspace(null);
        shell.setStatus("Current library was removed");
      }
    }
  };
  window.addEventListener("storage", onStorage);

  const shell = mountShell(host);
  let workspace: Workspace | null = null;
  let activeFilePath: string | null = null;
  let activeLibraryId: string | null = null;

  const editor = createEditor(shell.editorHost, {
    initialContent: "# Welcome\n\nStart writing…",
    onChange: (markdown) => {
      shell.setDirty(true);
      shell.setStatus(markdown.length > 0 ? `${markdown.length} chars` : "Empty");
    },
  });

  function refreshLibraryList(): void {
    shell.sidebar.setSavedLibraries(listLibraries(), activeLibraryId);
  }

  function persistLibrarySession(): void {
    if (!workspace || !activeLibraryId) return;
    saveLibrarySession(activeLibraryId, {
      activeFilePath,
      expandedDirs: shell.sidebar.getExpandedDirs(),
    });
  }

  async function confirmDiscard(): Promise<boolean> {
    if (!shell.isDirty()) return true;
    return window.confirm("Discard unsaved changes?");
  }

  async function openWorkspaceFile(
    path: string,
    options?: { skipConfirm?: boolean },
  ): Promise<void> {
    if (!workspace) return;
    if (!options?.skipConfirm && !(await confirmDiscard())) return;

    const result = await readWorkspaceFile(workspace, path);
    if (result.status !== "opened") {
      shell.setStatus(result.status === "error" ? result.message : "Unable to open file");
      return;
    }

    editor.setMarkdown(result.text);
    activeFilePath = path;
    shell.setFileName(result.name);
    shell.sidebar.setActiveFile(path);
    shell.setDirty(false);
    shell.setStatus(`Opened ${result.name}`);
    persistLibrarySession();
  }

  async function activateWorkspace(
    next: Workspace,
    options?: { restoreSession?: boolean },
  ): Promise<void> {
    workspace = next;
    activeLibraryId = libraryIdFromPath(workspace.rootPath);
    upsertLibrary(workspace.rootPath, workspace.rootName);
    setLastLibraryId(activeLibraryId);
    refreshLibraryList();
    shell.sidebar.setWorkspace(workspace);

    const session = getLibrarySession(activeLibraryId);
    const expandedDirs =
      options?.restoreSession && session.expandedDirs.length > 0
        ? session.expandedDirs
        : defaultExpandedDirs(workspace);
    shell.sidebar.setExpandedDirs(expandedDirs);
    shell.setStatus(`Library: ${workspace.rootName}`);

    if (options?.restoreSession && session.activeFilePath) {
      await openWorkspaceFile(session.activeFilePath, { skipConfirm: true });
    } else {
      activeFilePath = null;
      shell.sidebar.setActiveFile(null);
    }
  }

  async function loadLibraryById(
    libraryId: string,
    options?: { restoreSession?: boolean },
  ): Promise<void> {
    const record = getLibraryById(libraryId);
    if (!record) return;

    const result = await openWorkspaceByPath(record.rootPath);
    if (result.status !== "picked") {
      shell.setStatus(
        result.status === "error" ? result.message : "Unable to open library",
      );
      return;
    }

    await activateWorkspace(result.workspace, options);
  }

  async function switchLibrary(libraryId: string): Promise<void> {
    if (libraryId === activeLibraryId) return;
    if (!(await confirmDiscard())) return;
    persistLibrarySession();
    await loadLibraryById(libraryId, { restoreSession: true });
  }

  async function openFolder(): Promise<void> {
    const picked = await pickWorkspace();
    if (picked.status === "cancelled") return;
    if (picked.status !== "picked") {
      shell.setStatus(
        picked.status === "unsupported"
          ? "Folder picker is not supported in this environment"
          : picked.message,
      );
      return;
    }

    if (!(await confirmDiscard())) return;
    persistLibrarySession();
    await activateWorkspace(picked.workspace, { restoreSession: false });
  }

  async function openSettings(): Promise<void> {
    try {
      await openSettingsWindow();
    } catch (error) {
      console.error("Failed to open settings window", error);
      shell.setStatus(
        error instanceof Error ? error.message : "Could not open settings window",
      );
    }
  }

  async function restoreLastLibrary(): Promise<void> {
    const lastId = getLastLibraryId();
    if (!lastId) return;
    await loadLibraryById(lastId, { restoreSession: true });
  }

  shell.sidebar.onFileSelect((path) => void openWorkspaceFile(path));
  shell.sidebar.onOpenFolder(() => void openFolder());
  shell.sidebar.onOpenSettings(() => void openSettings());
  shell.sidebar.onSwitchLibrary((libraryId) => void switchLibrary(libraryId));
  shell.sidebar.onExpandedDirsChange(() => persistLibrarySession());
  shell.sidebar.onCloseLibrary(() => {
    persistLibrarySession();
    workspace = null;
    activeFilePath = null;
    activeLibraryId = null;
    shell.sidebar.setWorkspace(null);
    refreshLibraryList();
    shell.setStatus("Library closed");
  });

  shell.onNew(async () => {
    if (!(await confirmDiscard())) return;
    editor.newMarkdownFile();
    activeFilePath = null;
    shell.setFileName(null);
    shell.sidebar.setActiveFile(null);
    shell.setDirty(false);
    persistLibrarySession();
  });

  shell.onOpen(async () => {
    if (!(await confirmDiscard())) return;
    const result = await editor.openMarkdownFile();
    if (result.status === "opened") {
      activeFilePath = null;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(null);
      shell.setDirty(false);
      persistLibrarySession();
    }
  });

  shell.onOpenFolder(() => void openFolder());

  shell.onSave(async () => {
    if (workspace && activeFilePath) {
      const result = await writeWorkspaceFile(
        workspace,
        activeFilePath,
        editor.getMarkdown(),
      );
      if (result.status === "saved") {
        shell.setFileName(result.name);
        shell.setDirty(false);
        shell.setStatus(`Saved ${result.name}`);
        workspace.tree = await refreshWorkspaceTree(workspace);
        shell.sidebar.setWorkspace(workspace);
        shell.sidebar.setActiveFile(activeFilePath);
        persistLibrarySession();
      } else if (result.status === "error") {
        shell.setStatus(result.message);
      }
      return;
    }

    const result = await editor.saveMarkdownFile();
    if (result.status === "saved" || result.status === "downloaded") {
      shell.setFileName(result.name);
      shell.setDirty(false);
    }
  });

  shell.onSaveAs(async () => {
    const result = await editor.saveMarkdownFileAs();
    if (result.status === "saved" || result.status === "downloaded") {
      activeFilePath = null;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(null);
      shell.setDirty(false);
      persistLibrarySession();
    }
  });

  shell.onToggleAppearance(() => {
    void openSettings();
  });

  refreshLibraryList();
  void restoreLastLibrary();

  const fileName = editor.getCurrentFileName();
  if (fileName) shell.setFileName(fileName);

  const onBeforeUnload = () => persistLibrarySession();
  window.addEventListener("beforeunload", onBeforeUnload);

  return {
    editor,
    destroy() {
      persistLibrarySession();
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("storage", onStorage);
      editor.destroy();
      shell.destroy();
    },
  };
}
