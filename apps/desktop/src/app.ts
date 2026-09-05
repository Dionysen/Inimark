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
import { isTauri } from "./platform/env.ts";
import { closeWindow } from "./platform/window-chrome.ts";
import type { Workspace } from "./platform/types.ts";
import {
  defaultExpandedDirs,
  openWorkspaceByPath,
  pickWorkspace,
  readWorkspaceFile,
  refreshWorkspaceTree,
  writeWorkspaceFile,
} from "./platform/workspace.ts";
import { mountEditorFontZoom } from "./editor/font-zoom.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { applySettings, loadSettings, SETTINGS_STORAGE_KEY } from "./settings/store.ts";
import { formatMarkdown } from "./settings/markdown-format.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { mountShell } from "./shell.ts";
import { promptUnsavedChanges } from "./ui/confirm-dialog.ts";

export interface AppController {
  editor: Editor;
  destroy(): void;
}

export function mountApp(host: HTMLElement): AppController {
  let settings = loadSettings();
  applySettings(settings);

  const shell = mountShell(host, {
    onCloseRequest: () => requestAppClose(),
  });
  let workspace: Workspace | null = null;
  let activeFilePath: string | null = null;
  let activeLibraryId: string | null = null;
  let closeInProgress = false;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanups: Array<() => void> = [];

  const editor = createEditor(shell.editorHost, {
    initialContent: "# Welcome\n\nStart writing…",
    onChange: () => {
      shell.setDirty(true);
      scheduleAutoSave();
    },
  });
  editor.setTypewriterMode(settings.typewriterMode);

  cleanups.push(
    mountEditorFontZoom({
      editorHost: shell.editorHost,
      toastHost: shell.mainColumn,
      getSettings: () => settings,
      setSettings(next) {
        settings = next;
      },
    }),
  );

  function clearAutoSaveTimer(): void {
    if (autoSaveTimer != null) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function scheduleAutoSave(): void {
    clearAutoSaveTimer();
    if (!settings.autoSave) return;
    if (!workspace || !activeFilePath) return;
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      void saveCurrentFile({ quiet: true });
    }, 900);
  }

  function currentMarkdownForSave(): string {
    const raw = editor.getMarkdown();
    if (!settings.markdownFormat.formatOnSave) return raw;
    return formatMarkdown(raw, settings.markdownFormat);
  }

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

  async function saveCurrentFile(options?: { quiet?: boolean }): Promise<boolean> {
    const markdown = currentMarkdownForSave();
    if (workspace && activeFilePath) {
      const result = await writeWorkspaceFile(workspace, activeFilePath, markdown);
      if (result.status === "saved") {
        if (settings.markdownFormat.formatOnSave) {
          const current = editor.getMarkdown();
          if (current !== markdown) editor.setMarkdown(markdown);
        }
        shell.setFileName(result.name);
        shell.setDirty(false);
        workspace.tree = await refreshWorkspaceTree(workspace);
        shell.sidebar.setWorkspace(workspace);
        shell.sidebar.setActiveFile(activeFilePath);
        persistLibrarySession();
        return true;
      }
      if (result.status === "error" && !options?.quiet) {
        console.error(result.message);
      }
      return false;
    }

    const result = await editor.saveMarkdownFile();
    if (result.status === "saved" || result.status === "downloaded") {
      shell.setFileName(result.name);
      shell.setDirty(false);
      persistLibrarySession();
      return true;
    }
    return result.status !== "error";
  }

  async function saveFileAs(): Promise<void> {
    const result = await editor.saveMarkdownFileAs();
    if (result.status === "saved" || result.status === "downloaded") {
      activeFilePath = null;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(null);
      shell.setDirty(false);
      persistLibrarySession();
    }
  }

  function resetToUntitled(): void {
    editor.newMarkdownFile();
    activeFilePath = null;
    shell.setFileName(null);
    shell.sidebar.setActiveFile(null);
    shell.setDirty(false);
    persistLibrarySession();
  }

  async function confirmDiscardChanges(): Promise<boolean> {
    if (!shell.isDirty()) return true;
    const choice = await promptUnsavedChanges({
      title: "Save changes?",
      message: "Your changes will be lost if you don't save them.",
    });
    if (choice === "cancel") return false;
    if (choice === "save") return saveCurrentFile();
    return true;
  }

  async function openWorkspaceFile(
    path: string,
    options?: {
      skipConfirm?: boolean;
      line?: number;
      query?: string;
      snippet?: string;
    },
  ): Promise<void> {
    if (!workspace) return;
    if (!options?.skipConfirm && !(await confirmDiscardChanges())) return;

    const sameFile = activeFilePath === path;
    if (!sameFile) {
      const result = await readWorkspaceFile(workspace, path);
      if (result.status !== "opened") {
        if (result.status === "error") {
          console.error(result.message);
        }
        return;
      }

      editor.setMarkdown(result.text);
      activeFilePath = path;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(path);
      shell.setDirty(false);
      persistLibrarySession();
    } else {
      shell.sidebar.setActiveFile(path);
    }

    const query = options?.query?.trim();
    if (query) {
      editor.revealSearchMatch({
        query,
        line: options?.line,
        snippet: options?.snippet,
      });
    } else {
      editor.clearSearchHighlight();
    }
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
      if (result.status === "error") {
        console.error(result.message);
      }
      return;
    }

    await activateWorkspace(result.workspace, options);
  }

  async function switchLibrary(libraryId: string): Promise<void> {
    if (libraryId === activeLibraryId) return;
    if (!(await confirmDiscardChanges())) return;
    persistLibrarySession();
    await loadLibraryById(libraryId, { restoreSession: true });
  }

  async function openFolder(): Promise<void> {
    const picked = await pickWorkspace();
    if (picked.status === "cancelled") return;
    if (picked.status !== "picked") {
      if (picked.status === "error") {
        console.error(picked.message);
      }
      return;
    }

    if (!(await confirmDiscardChanges())) return;
    persistLibrarySession();
    await activateWorkspace(picked.workspace, { restoreSession: false });
  }

  async function openSettings(): Promise<void> {
    try {
      await openSettingsWindow();
    } catch (error) {
      console.error("Failed to open settings window", error);
    }
  }

  async function openFile(): Promise<void> {
    if (!(await confirmDiscardChanges())) return;
    const result = await editor.openMarkdownFile();
    if (result.status === "opened") {
      activeFilePath = null;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(null);
      shell.setDirty(false);
      persistLibrarySession();
    }
  }

  async function newFile(): Promise<void> {
    if (!(await confirmDiscardChanges())) return;
    resetToUntitled();
  }

  async function closeCurrent(): Promise<void> {
    if (shell.isDirty()) {
      const choice = await promptUnsavedChanges({
        title: "Save changes?",
        message: "Save changes before closing this file?",
      });
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await saveCurrentFile();
        if (!saved) return;
      }
    }

    if (activeFilePath) {
      resetToUntitled();
      return;
    }

    await requestAppClose();
  }

  async function requestAppClose(): Promise<void> {
    if (closeInProgress) return;
    if (shell.isDirty()) {
      const choice = await promptUnsavedChanges({
        title: "Save changes?",
        message: "Your changes will be lost if you don't save them.",
      });
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await saveCurrentFile();
        if (!saved) return;
      }
    }

    closeInProgress = true;
    persistLibrarySession();

    if (isTauri()) {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const settings = await WebviewWindow.getByLabel("settings");
      if (settings) await settings.destroy();
    }

    await closeWindow();
  }

  async function restoreLastLibrary(): Promise<void> {
    const lastId = getLastLibraryId();
    if (!lastId) return;
    await loadLibraryById(lastId, { restoreSession: true });
  }

  shell.sidebar.onFileSelect((path, options) => void openWorkspaceFile(path, options));
  shell.sidebar.onOpenFolder(() => void openFolder());
  shell.sidebar.onOpenSettings(() => void openSettings());
  shell.sidebar.onSwitchLibrary((libraryId) => void switchLibrary(libraryId));
  shell.sidebar.onExpandedDirsChange(() => persistLibrarySession());
  shell.sidebar.onFileRenamed((from, to) => {
    if (!workspace) return;
    if (activeFilePath === from || activeFilePath?.startsWith(`${from}/`)) {
      activeFilePath = to;
      shell.setFileName(to.split(/[/\\]/).pop() ?? to);
      shell.sidebar.setActiveFile(to);
      persistLibrarySession();
    }
  });
  shell.sidebar.onFileDeleted((path) => {
    if (
      activeFilePath === path ||
      activeFilePath?.startsWith(`${path}/`)
    ) {
      resetToUntitled();
    }
  });
  shell.sidebar.onCloseLibrary(() => {
    persistLibrarySession();
    workspace = null;
    activeFilePath = null;
    activeLibraryId = null;
    shell.sidebar.setWorkspace(null);
    refreshLibraryList();
  });

  cleanups.push(
    mountShortcutHandler({
      save: () => void saveCurrentFile(),
      "save-as": () => void saveFileAs(),
      new: () => void newFile(),
      open: () => void openFile(),
      "open-folder": () => void openFolder(),
      close: () => void closeCurrent(),
      "toggle-sidebar": () => shell.toggleSidebar(),
      "open-settings": () => void openSettings(),
    }),
  );

  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      settings = loadSettings();
      applySettings(settings);
      editor.setTypewriterMode(settings.typewriterMode);
    }
    if (event.key === LIBRARIES_STORAGE_KEY) {
      refreshLibraryList();
      if (activeLibraryId && !getLibraryById(activeLibraryId)) {
        workspace = null;
        activeFilePath = null;
        activeLibraryId = null;
        shell.sidebar.setWorkspace(null);
      }
    }
  };
  window.addEventListener("storage", onStorage);
  cleanups.push(() => window.removeEventListener("storage", onStorage));

  if (isTauri()) {
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const unlistenClose = await win.onCloseRequested((event) => {
        event.preventDefault();
        void requestAppClose();
      });
      cleanups.push(unlistenClose);
    })();
  }

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    persistLibrarySession();
    if (shell.isDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  cleanups.push(() => window.removeEventListener("beforeunload", onBeforeUnload));

  refreshLibraryList();
  void restoreLastLibrary();

  const fileName = editor.getCurrentFileName();
  if (fileName) shell.setFileName(fileName);

  return {
    editor,
    destroy() {
      clearAutoSaveTimer();
      persistLibrarySession();
      for (const cleanup of cleanups.reverse()) cleanup();
      editor.destroy();
      shell.destroy();
    },
  };
}
