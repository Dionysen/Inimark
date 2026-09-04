import { createEditor, type Editor } from "@md/editor";
import "@md/editor/widgets.css";
import "@md/editor/theme-typora.css";
import "katex/dist/katex.min.css";
import "./styles/app.css";
import { mountShell } from "./shell.ts";

export interface AppController {
  editor: Editor;
  destroy(): void;
}

export function mountApp(host: HTMLElement): AppController {
  const shell = mountShell(host);
  const editor = createEditor(shell.editorHost, {
    initialContent: "# Welcome\n\nStart writing…",
    onChange: (markdown) => {
      shell.setDirty(true);
      shell.setStatus(markdown.length > 0 ? `${markdown.length} chars` : "Empty");
    },
  });

  shell.onNew(() => {
    editor.newMarkdownFile();
    shell.setFileName(null);
    shell.setDirty(false);
  });

  shell.onOpen(async () => {
    const result = await editor.openMarkdownFile();
    if (result.status === "opened") {
      shell.setFileName(result.name);
      shell.setDirty(false);
    }
  });

  shell.onSave(async () => {
    const result = await editor.saveMarkdownFile();
    if (result.status === "saved" || result.status === "downloaded") {
      shell.setFileName(result.name);
      shell.setDirty(false);
    }
  });

  shell.onSaveAs(async () => {
    const result = await editor.saveMarkdownFileAs();
    if (result.status === "saved" || result.status === "downloaded") {
      shell.setFileName(result.name);
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
