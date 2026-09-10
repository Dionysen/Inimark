import { describe, expect, test, vi } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { setClipboardBridge } from "../src/clipboard-bridge.ts";
import {
  copySelectionAsHtml,
  copySelectionAsPlainText,
  pasteAsPlainText,
  pasteFromClipboard,
  sliceToHtml,
} from "../src/clipboard.ts";
import { defaultPlugins } from "../src/editor.ts";
import { parse } from "../src/parser.ts";
import { schema } from "../src/schema.ts";

function mountView(markdown = ""): {
  host: HTMLElement;
  view: EditorView;
  cleanup: () => void;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const view = new EditorView(host, {
    state: EditorState.create({
      schema,
      doc: markdown ? parse(markdown) : schema.nodes.doc.createAndFill()!,
      plugins: defaultPlugins({ cursorWidget: false }),
    }),
  });
  return {
    host,
    view,
    cleanup: () => {
      view.destroy();
      host.remove();
    },
  };
}

function selectAll(view: EditorView): void {
  const { doc } = view.state;
  const end = doc.content.size;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(doc, 1, Math.max(1, end - 1))),
  );
}

describe("clipboard", () => {
  test("sliceToHtml emits rendered HTML tags without markdown delimiters", () => {
    const doc = parse("**bold**");
    const slice = doc.slice(0, doc.content.size);
    const html = sliceToHtml(slice, schema);
    expect(html).toContain("<strong>");
    expect(html).toContain("bold");
    expect(html).not.toContain("**");
  });

  test("copySelectionAsPlainText omits markdown delimiters", async () => {
    const { view, cleanup } = mountView("**bold** and *italic*");
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardBridge({ readText: vi.fn(), writeText });
    try {
      selectAll(view);
      expect(await copySelectionAsPlainText(view)).toBe(true);
      expect(writeText).toHaveBeenCalledWith("bold and italic");
    } finally {
      setClipboardBridge(null);
      cleanup();
    }
  });

  test("copySelectionAsHtml writes HTML source", async () => {
    const { view, cleanup } = mountView("**bold**");
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardBridge({ readText: vi.fn(), writeText });
    try {
      selectAll(view);
      expect(await copySelectionAsHtml(view)).toBe(true);
      const written = writeText.mock.calls[0]![0] as string;
      expect(written).toContain("<strong>");
      expect(written).toContain("bold");
      expect(written).not.toContain("**");
    } finally {
      setClipboardBridge(null);
      cleanup();
    }
  });

  test("pasteAsPlainText inserts without markdown parsing", async () => {
    const { view, cleanup } = mountView("");
    setClipboardBridge({
      readText: vi.fn().mockResolvedValue("**not bold**"),
      writeText: vi.fn(),
    });
    try {
      expect(await pasteAsPlainText(view)).toBe(true);
      expect(view.state.doc.textContent).toBe("**not bold**");
      const marks = new Set<string>();
      view.state.doc.firstChild!.forEach((child) => {
        for (const mark of child.marks) marks.add(mark.type.name);
      });
      expect(marks.has("strong")).toBe(false);
    } finally {
      setClipboardBridge(null);
      cleanup();
    }
  });

  test("pasteFromClipboard parses markdown by default", async () => {
    const { view, cleanup } = mountView("");
    setClipboardBridge({
      readText: vi.fn().mockResolvedValue("**bold**"),
      writeText: vi.fn(),
    });
    try {
      expect(await pasteFromClipboard(view)).toBe(true);
      const marks = new Set<string>();
      view.state.doc.firstChild!.forEach((child) => {
        for (const mark of child.marks) marks.add(mark.type.name);
      });
      expect(marks.has("strong")).toBe(true);
    } finally {
      setClipboardBridge(null);
      cleanup();
    }
  });

  test("copy with empty selection is a no-op", async () => {
    const { view, cleanup } = mountView("hello");
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardBridge({ readText: vi.fn(), writeText });
    try {
      expect(await copySelectionAsPlainText(view)).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      setClipboardBridge(null);
      cleanup();
    }
  });
});
