import { createEditor, type Editor } from "@inimark/editor";
import "@inimark/editor/widgets.css";
import "@inimark/editor/theme-typora.css";
import "katex/dist/katex.min.css";
import "./styles/app.css";
import type { Workspace } from "./platform/types.ts";
import {
  pickWorkspace,
  readWorkspaceFile,
  refreshWorkspaceTree,
  writeWorkspaceFile,
} from "./platform/workspace.ts";
import { mountShell } from "./shell.ts";

export interface AppController {
  editor: Editor;
  destroy(): void;
}

export function mountApp(host: HTMLElement): AppController {
  const shell = mountShell(host);
  let workspace: Workspace | null = null;
  let activeFilePath: string | null = null;

  const editor = createEditor(shell.editorHost, {
    initialContent: "# Welcome\n\nStart writing…",
    onChange: (markdown) => {
      shell.setDirty(true);
      shell.setStatus(markdown.length > 0 ? `${markdown.length} chars` : "Empty");
    },
  });

  async function confirmDiscard(): Promise<boolean> {
    if (!shell.isDirty()) return true;
    return window.confirm("Discard unsaved changes?");
  }

  async function openWorkspaceFile(path: string): Promise<void> {
    if (!workspace) return;
    if (!(await confirmDiscard())) return;

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

    workspace = picked.workspace;
    shell.sidebar.setWorkspace(workspace);
    shell.setStatus(`Library: ${workspace.rootName}`);
  }

  shell.sidebar.onFileSelect((path) => void openWorkspaceFile(path));

  shell.onNew(async () => {
    if (!(await confirmDiscard())) return;
    editor.newMarkdownFile();
    activeFilePath = null;
    shell.setFileName(null);
    shell.sidebar.setActiveFile(null);
    shell.setDirty(false);
  });

  shell.onOpen(async () => {
    if (!(await confirmDiscard())) return;
    const result = await editor.openMarkdownFile();
    if (result.status === "opened") {
      activeFilePath = null;
      shell.setFileName(result.name);
      shell.sidebar.setActiveFile(null);
      shell.setDirty(false);
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
    }
  });

  shell.onToggleAppearance(() => {
    const root = document.documentElement;
    const next = root.dataset.appearance === "dark" ? "light" : "dark";
    root.dataset.appearance = next;
    root.style.colorScheme = next;
  });

  const fileName = editor.getCurrentFileName();
  if (fileName) shell.setFileName(fileName);

  return {
    editor,
    destroy() {
      editor.destroy();
      shell.destroy();
    },
  };
}
