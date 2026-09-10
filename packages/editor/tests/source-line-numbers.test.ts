import type { EditorView as CodeMirrorView } from "@codemirror/view";
import { describe, expect, test } from "vitest";

import { createEditor } from "../src/lib.ts";

function lines(n: number): string {
  return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");
}

function getSourceCmView(host: HTMLElement): CodeMirrorView {
  const root = host.querySelector(".typora-web-cm-source") as
    | (HTMLElement & { __typoraWebCodeMirrorView?: CodeMirrorView })
    | null;
  const view = root?.__typoraWebCodeMirrorView;
  if (!view) throw new Error("source CodeMirror view not found");
  return view;
}

function readVisibleSourceLineNumbers(host: HTMLElement): string[] {
  return Array.from(
    host.querySelectorAll(".typora-web-cm-source .cm-lineNumbers .cm-gutterElement"),
    (el) => {
      if (getComputedStyle(el).visibility === "hidden") return "";
      return el.textContent?.trim() ?? "";
    },
  ).filter(Boolean);
}

describe("source mode line numbers", () => {
  test("shows every 10th line number", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const editor = createEditor(host, { initialContent: lines(25) });

    try {
      editor.toggleSource();
      await Promise.resolve();

      const cmView = getSourceCmView(host);
      const line1 = cmView.state.doc.line(1);
      cmView.dispatch({ selection: { anchor: line1.from } });
      await Promise.resolve();

      expect(readVisibleSourceLineNumbers(host)).toEqual(["1", "10", "20"]);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("also shows the active line when it is not a multiple of 10", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const editor = createEditor(host, { initialContent: lines(25) });

    try {
      editor.toggleSource();
      await Promise.resolve();

      const cmView = getSourceCmView(host);
      const line15 = cmView.state.doc.line(15);
      cmView.dispatch({ selection: { anchor: line15.from } });
      await Promise.resolve();

      expect(readVisibleSourceLineNumbers(host)).toEqual(["1", "10", "15", "20"]);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("always shows line 1 even when the caret is elsewhere", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const editor = createEditor(host, { initialContent: lines(25) });

    try {
      editor.toggleSource();
      await Promise.resolve();

      const cmView = getSourceCmView(host);
      const line4 = cmView.state.doc.line(4);
      cmView.dispatch({ selection: { anchor: line4.from } });
      await Promise.resolve();

      expect(readVisibleSourceLineNumbers(host)).toEqual(["1", "4", "10", "20"]);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("source mode exposes a line number gutter but fenced code blocks do not", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const editor = createEditor(host, { initialContent: "```js\nconsole.log(1);\n```" });

    try {
      await Promise.resolve();
      expect(host.querySelector(".typora-web-code-editor .cm-lineNumbers")).toBeNull();

      editor.toggleSource();
      await Promise.resolve();
      const gutters = host.querySelector<HTMLElement>(".typora-web-cm-source .cm-gutters");
      expect(gutters).not.toBeNull();
      expect(getComputedStyle(gutters!).display).not.toBe("none");
      expect(host.querySelector(".typora-web-cm-source .cm-lineNumbers")).not.toBeNull();
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("source mode keeps the writing column width unchanged", async () => {
    const host = document.createElement("div");
    host.style.width = "860px";
    document.body.append(host);
    const wrapStyle = document.createElement("style");
    wrapStyle.textContent = ".typora-web-wrap { max-width: 640px; }";
    document.head.append(wrapStyle);
    const editor = createEditor(host, { initialContent: lines(25) });

    try {
      const preview = host.querySelector<HTMLElement>(".ProseMirror");
      expect(preview).not.toBeNull();
      const previewWidth = preview!.getBoundingClientRect().width;

      editor.toggleSource();
      await Promise.resolve();

      const sourceScroller = host.querySelector<HTMLElement>(
        ".typora-web-source-editor .cm-scroller",
      );
      expect(sourceScroller).not.toBeNull();
      expect(sourceScroller!.getBoundingClientRect().width).toBeCloseTo(previewWidth, 0);
    } finally {
      wrapStyle.remove();
      editor.destroy();
      host.remove();
    }
  });
});
