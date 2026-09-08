import { createEditor, setWikiLinkBridge, type Editor } from "@inimark/editor";
import "@inimark/editor/widgets.css";
import "@inimark/editor/theme-typora.css";
import "katex/dist/katex.min.css";
import "./styles/app.css";
import { t } from "./i18n/index.ts";
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
import { isTauri, joinWorkspacePath, fileNameFromPath } from "./platform/env.ts";
import { closeWindow } from "./platform/window-chrome.ts";
import type { Workspace } from "./platform/types.ts";
import {
  createWorkspaceFile,
  defaultExpandedDirs,
  openWorkspaceByPath,
  pickWorkspace,
  readWorkspaceFile,
  refreshWorkspaceTree,
  writeWorkspaceFile,
} from "./platform/workspace.ts";
import { mountEditorFontZoom } from "./editor/font-zoom.ts";
import { mountWordCount } from "./editor/word-count.ts";
import { mountEditorContextMenu } from "./editor/context-menu.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import {
  applySettings,
  loadSettings,
  saveSettings,
  type AppSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
} from "./settings/store.ts";
import { formatMarkdown } from "./settings/markdown-format.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { mountShell } from "./shell.ts";
import { FileNavigationHistory } from "./navigation-history.ts";
import { promptUnsavedChanges } from "./ui/confirm-dialog.ts";
import { showQuickOpenDialog } from "./ui/quick-open-dialog.ts";
import {
  flattenWorkspaceFiles,
} from "./quick-open/search.ts";
import {
  getRecentFiles,
  recordRecentFile,
} from "./quick-open/recent-files.ts";
import {
  buildLinkIndexForWorkspace,
  linkIndex,
} from "./wikilink/index.ts";

export interface AppController {
  editor: Editor;
  destroy(): void;
}

export function mountApp(host: HTMLElement): AppController {
  let settings = loadSettings();
  applySettings(settings);

  const navHistory = new FileNavigationHistory();

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error(error);
    }
  }

  const shell = mountShell(host, {
    onCloseRequest: () => requestAppClose(),
    moreMenuActions: {
      canGoBack: () => navHistory.canBack(),
      canGoForward: () => navHistory.canForward(),
      onBack: () => void goHistoryBack(),
      onForward: () => void goHistoryForward(),
      canRename: () => Boolean(workspace && activeFilePath),
      onRename: () => shell.sidebar.renameActiveFile(),
      canCopyPath: () => Boolean(workspace && activeFilePath),
      onCopyFileName: () => {
        if (!activeFilePath) return;
        void copyToClipboard(fileNameFromPath(activeFilePath));
      },
      onCopyRelativePath: () => {
        if (!activeFilePath) return;
        void copyToClipboard(activeFilePath);
      },
      onCopyAbsolutePath: () => {
        if (!workspace || !activeFilePath) return;
        void copyToClipboard(joinWorkspacePath(workspace.rootPath, activeFilePath));
      },
    },
  });
  let workspace: Workspace | null = null;
  let activeFilePath: string | null = null;
  let activeLibraryId: string | null = null;
  let closeInProgress = false;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanups: Array<() => void> = [];
  let wordCount: ReturnType<typeof mountWordCount> | null = null;

  const editor = createEditor(shell.editorHost, {
    initialContent: t("editor.welcome"),
    onChange: (md) => {
      shell.setDirty(true);
      scheduleAutoSave();
      scheduleOutlineSync(md);
      wordCount?.scheduleUpdate();
      if (workspace && activeFilePath) {
        linkIndex.addFileLinks(activeFilePath, md);
      }
    },
  });
  editor.setTypewriterMode(settings.typewriterMode);

  wordCount = mountWordCount({
    host: shell.editorPane,
    editor,
    getSettings: () => settings,
    onWordCountChange(partial) {
      settings = {
        ...settings,
        wordCount: { ...settings.wordCount, ...partial },
      };
      saveSettings(settings);
    },
  });
  cleanups.push(() => wordCount?.destroy());

  let cachedImageUrl: ((path: string) => string | null) | null = null;
  void (async () => {
    if (!isTauri()) {
      cachedImageUrl = (path) =>
        workspace ? joinWorkspacePath(workspace.rootPath, path) : null;
      return;
    }
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      cachedImageUrl = (path) => {
        if (!workspace) return null;
        return convertFileSrc(joinWorkspacePath(workspace.rootPath, path));
      };
    } catch {
      cachedImageUrl = (path) =>
        workspace ? joinWorkspacePath(workspace.rootPath, path) : null;
    }
  })();

  setWikiLinkBridge({
    resolveNote: (noteName) => linkIndex.findFileByNoteName(noteName) ?? null,
    resolveImage: (name) => linkIndex.findImageByBaseName(name) ?? null,
    imageUrl: (relativePath) => cachedImageUrl?.(relativePath) ?? null,
    searchNotes: (query) => linkIndex.searchNotes(query),
    openNote: (noteName, heading) => {
      void (async () => {
        let path = linkIndex.findFileByNoteName(noteName);
        if (!path) {
          if (!workspace) return;
          const rel = noteName.endsWith(".md") ? noteName : `${noteName}.md`;
          const created = await createWorkspaceFile(
            workspace,
            rel,
            `# ${noteName.split("/").pop()}\n`,
          );
          if (created.status === "error") {
            console.error(created.message);
            return;
          }
          workspace.tree = await refreshWorkspaceTree(workspace);
          shell.sidebar.setWorkspace(workspace);
          linkIndex.registerFile(rel);
          linkIndex.addFileLinks(rel, `# ${noteName.split("/").pop()}\n`);
          path = rel;
        }
        await openWorkspaceFile(path);
        if (heading) {
          editor.scrollToHeading(heading);
        }
      })();
    },
    createNote: (noteName) => {
      void (async () => {
        if (!workspace) return;
        const rel = noteName.endsWith(".md") ? noteName : `${noteName}.md`;
        const result = await createWorkspaceFile(
          workspace,
          rel,
          `# ${noteName.split("/").pop()}\n`,
        );
        if (result.status === "error") {
          console.error(result.message);
          return;
        }
        workspace.tree = await refreshWorkspaceTree(workspace);
        shell.sidebar.setWorkspace(workspace);
        linkIndex.registerFile(rel);
        linkIndex.addFileLinks(rel, `# ${noteName.split("/").pop()}\n`);
      })();
    },
    previewNote: async (noteName) => {
      if (!workspace) return null;
      const path = linkIndex.findFileByNoteName(noteName);
      if (!path) return null;
      const opened = await readWorkspaceFile(workspace, path);
      if (opened.status !== "opened") return null;
      return opened.text.replace(/^---[\s\S]*?---\s*/, "").trim();
    },
  });
  cleanups.push(() => setWikiLinkBridge(null));

  shell.graph.onOpenFile((path) => {
    void openWorkspaceFile(path);
  });

  let outlineTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleOutlineSync(md?: string): void {
    if (outlineTimer != null) clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => {
      outlineTimer = null;
      shell.rightSidebar.setContent(md ?? editor.getMarkdown());
    }, 120);
  }
  scheduleOutlineSync(editor.getMarkdown());

  shell.rightSidebar.onSelectHeading((_level, text, line) => {
    editor.scrollToHeading(text, line);
  });

  const editorContextMenu = mountEditorContextMenu(shell.editorHost, editor);
  cleanups.push(() => editorContextMenu.destroy());

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
          if (current !== markdown) {
            editor.setMarkdown(markdown);
            scheduleOutlineSync(markdown);
          }
        }
        shell.setFileName(result.name);
        shell.setDirty(false);
        workspace.tree = await refreshWorkspaceTree(workspace);
        shell.sidebar.setWorkspace(workspace);
        shell.sidebar.setActiveFile(activeFilePath);
        linkIndex.addFileLinks(activeFilePath, markdown);
        linkIndex.persistCache(workspace.rootPath);
        shell.graph.setActiveFile(activeFilePath);
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
    shell.graph.setActiveFile(null);
    shell.setDirty(false);
    persistLibrarySession();
    scheduleOutlineSync("");
  }

  async function confirmDiscardChanges(): Promise<boolean> {
    if (!shell.isDirty()) return true;
    const choice = await promptUnsavedChanges({
      title: t("dialogs.unsavedTitle"),
      message: t("dialogs.unsavedMessage"),
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
      shell.graph.setActiveFile(path);
      shell.setDirty(false);
      persistLibrarySession();
      scheduleOutlineSync(result.text);
      recordRecentFile(activeLibraryId, path);
      navHistory.record(path);
    } else {
      shell.sidebar.setActiveFile(path);
      shell.graph.setActiveFile(path);
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

  async function goHistoryBack(): Promise<void> {
    const path = navHistory.back();
    if (!path) return;
    await navHistory.navigate((next) => openWorkspaceFile(next), path);
  }

  async function goHistoryForward(): Promise<void> {
    const path = navHistory.forward();
    if (!path) return;
    await navHistory.navigate((next) => openWorkspaceFile(next), path);
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
    navHistory.clear();
    shell.sidebar.setWorkspace(workspace);
    void buildLinkIndexForWorkspace(workspace);

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

  async function openQuickOpen(): Promise<void> {
    const selected = await showQuickOpenDialog({
      hasWorkspace: Boolean(workspace),
      files: workspace ? flattenWorkspaceFiles(workspace.tree) : [],
      recentPaths: getRecentFiles(activeLibraryId),
      currentFilePath: activeFilePath,
    });
    if (!selected) return;
    await openWorkspaceFile(selected);
  }

  async function newFile(): Promise<void> {
    if (!(await confirmDiscardChanges())) return;
    resetToUntitled();
  }

  async function closeCurrent(): Promise<void> {
    if (shell.isDirty()) {
      const choice = await promptUnsavedChanges({
        title: t("dialogs.unsavedTitle"),
        message: t("dialogs.unsavedMessageClose"),
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
        title: t("dialogs.unsavedTitle"),
        message: t("dialogs.unsavedMessage"),
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
  shell.sidebar.onEntriesMoved((pairs) => {
    if (!workspace || pairs.length === 0) return;
    void (async () => {
      const settings = loadSettings();
      const affected = linkIndex.getAffectedLinkCountForRenames(pairs);
      let shouldUpdate = settings.linkUpdateOnMove === "always";

      if (settings.linkUpdateOnMove === "ask" && affected.linksCount > 0) {
        const { promptLinkUpdate } = await import("./ui/link-update-dialog.ts");
        const result = await promptLinkUpdate({
          filesCount: affected.filesCount,
          linksCount: affected.linksCount,
        });
        if (result.choice === "cancel") {
          // Still remap index paths; content left as-is.
          linkIndex.remapPaths(pairs);
          linkIndex.persistCache(workspace!.rootPath);
          shell.graph.refresh();
          return;
        }
        shouldUpdate = result.choice === "update";
        if (result.always && shouldUpdate) {
          const next = { ...settings, linkUpdateOnMove: "always" as const };
          saveSettings(next);
        }
      } else if (settings.linkUpdateOnMove === "never") {
        shouldUpdate = false;
      }

      if (shouldUpdate && affected.linksCount > 0) {
        await linkIndex.rewriteWikiLinksBatch(
          pairs,
          async (path) => {
            const opened = await readWorkspaceFile(workspace!, path);
            return opened.status === "opened" ? opened.text : null;
          },
          async (path, content) => {
            await writeWorkspaceFile(workspace!, path, content);
          },
        );
      } else {
        linkIndex.remapPaths(pairs);
      }
      linkIndex.persistCache(workspace!.rootPath);

      navHistory.remap(pairs);

      const activeMoved = pairs.find(
        (p) =>
          activeFilePath === p.from ||
          activeFilePath?.startsWith(`${p.from}/`),
      );
      if (activeMoved && activeFilePath) {
        activeFilePath =
          activeFilePath === activeMoved.from
            ? activeMoved.to
            : `${activeMoved.to}${activeFilePath.slice(activeMoved.from.length)}`;
        // Prefer exact mapping from directory root moves already applied in sidebar;
        // keep UI in sync with sidebar active path.
        shell.setFileName(activeFilePath.split(/[/\\]/).pop() ?? activeFilePath);
        shell.sidebar.setActiveFile(activeFilePath);
        shell.graph.setActiveFile(activeFilePath);
        const opened = await readWorkspaceFile(workspace!, activeFilePath);
        if (opened.status === "opened") {
          editor.setMarkdown(opened.text);
          shell.setDirty(false);
          scheduleOutlineSync(opened.text);
        }
        persistLibrarySession();
      } else {
        shell.graph.refresh();
      }
    })();
  });
  shell.sidebar.onFileDeleted((path) => {
    linkIndex.removeFile(path);
    if (workspace) linkIndex.persistCache(workspace.rootPath);
    if (
      activeFilePath === path ||
      activeFilePath?.startsWith(`${path}/`)
    ) {
      resetToUntitled();
      shell.graph.setActiveFile(null);
    } else {
      shell.graph.refresh();
    }
  });
  shell.sidebar.onCloseLibrary(() => {
    persistLibrarySession();
    workspace = null;
    activeFilePath = null;
    activeLibraryId = null;
    navHistory.clear();
    shell.sidebar.setWorkspace(null);
    linkIndex.clear();
    shell.graph.setActiveFile(null);
    refreshLibraryList();
  });
  cleanups.push(
    mountShortcutHandler(
      {
        save: () => void saveCurrentFile(),
        "save-as": () => void saveFileAs(),
        new: () => void newFile(),
        open: () => void openQuickOpen(),
        "open-folder": () => void openFolder(),
        close: () => void closeCurrent(),
        "toggle-sidebar": () => shell.toggleSidebar(),
        "focus-search": () => shell.focusSearch(),
        "tree-cut": () => shell.sidebar.cutSelection(),
        "tree-copy": () => shell.sidebar.copySelection(),
        "tree-paste": () => void shell.sidebar.pasteClipboard(),
        "tree-rename": () => shell.sidebar.renameSelection(),
        "tree-delete": () => void shell.sidebar.deleteSelection(),
        "open-settings": () => void openSettings(),
      },
      {
        isTreeShortcutContext: () => shell.sidebar.isTreeShortcutContext(),
      },
    ),
  );

  const applyIncomingSettings = (next: AppSettings) => {
    settings = next;
    applySettings(settings);
    editor.setTypewriterMode(settings.typewriterMode);
    shell.applySidebarTabLayout(settings);
    shell.graph.applyGraphSettings(settings.graph);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      applyIncomingSettings(loadSettings());
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
      const { listen } = await import("@tauri-apps/api/event");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlistenSettings = await listen<AppSettings>(SETTINGS_SYNC_EVENT, (event) => {
        applyIncomingSettings(event.payload);
      });
      cleanups.push(unlistenSettings);

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
