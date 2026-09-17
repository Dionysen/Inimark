import { describe, expect, test } from "vitest";
import { splitBlock } from "prosemirror-commands";
import { TextSelection } from "prosemirror-state";

import {
  documentFormatFromPath,
  isEditableNoteFile,
  isMarkdownFile,
  isPlainTextFile,
} from "../src/document-format.ts";
import {
  insertPlaintextAtSelection,
  parsePlaintext,
  plaintextOffsetToPos,
  plaintextPosToOffset,
  serializePlaintext,
} from "../src/plaintext.ts";
import { createEditor } from "../src/lib.ts";

describe("documentFormatFromPath", () => {
  test("detects markdown extensions", () => {
    expect(documentFormatFromPath("notes/Welcome.md")).toBe("markdown");
    expect(documentFormatFromPath("a.markdown")).toBe("markdown");
    expect(documentFormatFromPath("b.MDOWN")).toBe("markdown");
    expect(isMarkdownFile("Welcome.md")).toBe(true);
  });

  test("detects plaintext .txt", () => {
    expect(documentFormatFromPath("draft.txt")).toBe("plaintext");
    expect(documentFormatFromPath("folder/Note.TXT")).toBe("plaintext");
    expect(isPlainTextFile("note.txt")).toBe(true);
  });

  test("rejects non-note extensions", () => {
    expect(documentFormatFromPath("image.png")).toBeNull();
    expect(isEditableNoteFile("image.png")).toBe(false);
    expect(isEditableNoteFile("a.md")).toBe(true);
    expect(isEditableNoteFile("a.txt")).toBe(true);
  });
});

describe("plaintext parse/serialize", () => {
  test("round-trips lines as paragraphs", () => {
    const samples = ["", "hello", "a\nb", "a\n\nc", "# not a heading\n* literal"];
    for (const sample of samples) {
      expect(serializePlaintext(parsePlaintext(sample))).toBe(sample);
    }
  });

  test("does not interpret markdown syntax", () => {
    const doc = parsePlaintext("# Title\n**bold**");
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).type.name).toBe("paragraph");
    expect(doc.child(0).textContent).toBe("# Title");
    expect(doc.child(1).textContent).toBe("**bold**");
  });

  test("maps offsets across newlines", () => {
    const doc = parsePlaintext("ab\ncd");
    expect(plaintextOffsetToPos(doc, 0)).toBe(1);
    expect(plaintextOffsetToPos(doc, 2)).toBe(3); // on `\n` → end of first para
    expect(plaintextOffsetToPos(doc, 3)).toBe(5); // 'c'
    expect(plaintextPosToOffset(doc, plaintextOffsetToPos(doc, 4))).toBe(4);
  });
});

describe("plaintext editor mode", () => {
  test("keeps markdown syntax literal and disables source mode", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "seed" });
    try {
      editor.setFormat("plaintext");
      editor.setMarkdown("# Hello\nworld");
      expect(editor.getFormat()).toBe("plaintext");
      expect(editor.getMarkdown()).toBe("# Hello\nworld");
      expect(editor.view.state.doc.child(0).textContent).toBe("# Hello");
      editor.toggleSource();
      expect(editor.isSourceMode()).toBe(false);
      expect(editor.executeCommand("bold")).toBe(false);
      expect(editor.executeCommand("insert-datetime")).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("Enter creates a new line/paragraph", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host);
    try {
      editor.setFormat("plaintext");
      editor.setMarkdown("line");
      const end = editor.view.state.doc.content.size - 1;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, end)),
      );
      splitBlock(editor.view.state, editor.view.dispatch.bind(editor.view));
      expect(editor.getMarkdown()).toBe("line\n");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("insertPlaintextAtSelection splits on newlines", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host);
    try {
      editor.setFormat("plaintext");
      editor.setMarkdown("");
      insertPlaintextAtSelection(editor.view, "one\ntwo");
      expect(editor.getMarkdown()).toBe("one\ntwo");
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
