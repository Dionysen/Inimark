import { Schema, type Node as PMNode } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

/**
 * Minimal schema for `.txt` editing: paragraphs of plain text only.
 * One physical line in the file maps to one paragraph (Enter → new line).
 */
export const plaintextSchema = new Schema({
  nodes: {
    doc: {
      content: "paragraph+",
    },
    paragraph: {
      group: "block",
      content: "text*",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: {
      group: "inline",
    },
  },
  marks: {},
});

/** Split on `\n`: each line becomes one paragraph (empty file → one empty paragraph). */
export function parsePlaintext(text: string): PMNode {
  const lines = text.split("\n");
  const paragraphs = lines.map((line) => {
    const content = line.length > 0 ? plaintextSchema.text(line) : undefined;
    return plaintextSchema.nodes.paragraph.create(null, content);
  });
  return plaintextSchema.nodes.doc.create(null, paragraphs);
}

/** Join paragraphs with a single `\n` (inverse of `parsePlaintext`). */
export function serializePlaintext(doc: PMNode): string {
  const lines: string[] = [];
  doc.forEach((node) => {
    if (node.type.name === "paragraph") {
      lines.push(node.textContent);
    }
  });
  return lines.join("\n");
}

/** Map a plaintext file character offset to a ProseMirror position. */
export function plaintextOffsetToPos(doc: PMNode, offset: number): number {
  let remaining = Math.max(0, offset);
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    const len = child.content.size;
    if (remaining <= len) {
      return pos + 1 + remaining;
    }
    remaining -= len;
    if (i < doc.childCount - 1) {
      if (remaining === 0) {
        // Offset lands on the `\n` separator → end of this paragraph.
        return pos + 1 + len;
      }
      remaining -= 1;
    }
    pos += child.nodeSize;
  }
  return doc.content.size;
}

/** Map a ProseMirror position to a plaintext file character offset. */
export function plaintextPosToOffset(doc: PMNode, pos: number): number {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  try {
    return serializePlaintext(doc.cut(0, clamped)).length;
  } catch {
    return serializePlaintext(doc).length;
  }
}

/**
 * Insert plain text at the selection. Newlines become new paragraphs
 * (matching the one-line-per-paragraph file model).
 */
export function insertPlaintextAtSelection(view: EditorView, raw: string): boolean {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text) return false;

  const { from, to } = view.state.selection;
  const current = serializePlaintext(view.state.doc);
  const fromOff = plaintextPosToOffset(view.state.doc, from);
  const toOff = plaintextPosToOffset(view.state.doc, to);
  const start = Math.min(fromOff, toOff);
  const end = Math.max(fromOff, toOff);
  const next = current.slice(0, start) + text + current.slice(end);
  const newDoc = parsePlaintext(next);
  const caret = start + text.length;
  let tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
  const pos = plaintextOffsetToPos(tr.doc, caret);
  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, pos));
  } catch {
    tr = tr.setSelection(TextSelection.atEnd(tr.doc));
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
