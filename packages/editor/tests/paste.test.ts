import { Slice } from "prosemirror-model";
import { describe, expect, test } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { defaultPlugins } from "../src/editor.ts";
import { insertMarkdownFromText } from "../src/paste.ts";
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

function pastePlainText(view: EditorView, text: string, html = ""): boolean {
  const event = {
    clipboardData: {
      getData(type: string) {
        if (type === "text/plain") return text;
        if (type === "text/html") return html;
        return "";
      },
    },
    preventDefault() {},
  } as unknown as ClipboardEvent;

  let handled = false;
  view.someProp("handlePaste", (handler) => {
    if (handler(view, event, Slice.empty)) handled = true;
  });
  return handled;
}

describe("markdown paste", () => {
  test("insertMarkdownFromText renders inline emphasis", () => {
    const { view, cleanup } = mountView("");
    try {
      expect(insertMarkdownFromText(view, "**bold** and *italic*")).toBe(true);
      const p = view.state.doc.firstChild!;
      const marks = new Set<string>();
      p.forEach((child) => {
        for (const mark of child.marks) marks.add(mark.type.name);
      });
      expect(marks.has("strong")).toBe(true);
      expect(marks.has("em")).toBe(true);
      expect(p.textContent).toBe("**bold** and *italic*");
    } finally {
      cleanup();
    }
  });

  test("insertMarkdownFromText creates block nodes immediately", () => {
    const { view, cleanup } = mountView("");
    try {
      expect(insertMarkdownFromText(view, "# Title\n\nParagraph")).toBe(true);
      expect(view.state.doc.childCount).toBe(2);
      expect(view.state.doc.child(0).type).toBe(schema.nodes.heading);
      expect(view.state.doc.child(0).attrs.level).toBe(1);
      expect(view.state.doc.child(1).type).toBe(schema.nodes.paragraph);
      expect(view.state.doc.child(1).textContent).toBe("Paragraph");
    } finally {
      cleanup();
    }
  });

  test("handlePaste routes plain-text markdown through parse", () => {
    const { view, cleanup } = mountView("");
    try {
      expect(pastePlainText(view, "- one\n- two")).toBe(true);
      const list = view.state.doc.firstChild!;
      expect(list.type).toBe(schema.nodes.bullet_list);
      expect(list.childCount).toBe(2);
    } finally {
      cleanup();
    }
  });

  test("handlePaste keeps internal ProseMirror HTML slices on the default path", () => {
    const { view, cleanup } = mountView("keep");
    try {
      const handled = pastePlainText(
        view,
        "ignored",
        '<meta charset="utf-8"><span data-pm-slice="1 1 []">x</span>',
      );
      expect(handled).toBe(false);
      expect(view.state.doc.textContent).toBe("keep");
    } finally {
      cleanup();
    }
  });
});
