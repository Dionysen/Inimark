import {
  DOMSerializer,
  Fragment,
  type Node as PMNode,
  type Schema,
  type Slice,
} from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import { getClipboardBridge } from "./clipboard-bridge.ts";
import { insertMarkdownFromText } from "./paste.ts";
import { parseInline } from "./inline-parse.ts";

/** Skip inline mark normalization for a plain-text paste transaction. */
export const PASTE_PLAIN_TEXT_META = "pastePlainText";

async function writeTextToClipboard(text: string): Promise<void> {
  const host = getClipboardBridge();
  if (host) {
    await host.writeText(text);
    return;
  }
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
}

/** Read plain text from the clipboard without WebView permission prompts when bridged. */
export async function readClipboardText(): Promise<string | null> {
  const host = getClipboardBridge();
  if (host) {
    try {
      const text = await host.readText();
      return text || null;
    } catch {
      return null;
    }
  }
  try {
    const text = await navigator.clipboard.readText();
    return text || null;
  } catch {
    return null;
  }
}

function selectionSlice(view: EditorView): Slice | null {
  const { from, to, empty } = view.state.selection;
  if (empty) return null;
  // `cut` closes open slice boundaries so block structure is preserved for
  // delimiter stripping and DOM serialization (unlike `slice`).
  return view.state.doc.cut(from, to);
}

function hiddenDelimMask(text: string, block: PMNode): Uint8Array {
  const hidden = new Uint8Array(text.length);
  for (const span of parseInline(text, block)) {
    markHidden(hidden, span.openFrom, span.openTo);
    markHidden(hidden, span.closeFrom, span.closeTo);
    for (const dr of span.delimRanges ?? []) {
      markHidden(hidden, dr.from, dr.to);
    }
  }
  return hidden;
}

function markHidden(mask: Uint8Array, from: number, to: number): void {
  for (let i = from; i < to; i++) mask[i] = 1;
}

function stripDelimitersInTextblock(block: PMNode): PMNode {
  const text = block.textContent;
  if (!text) return block;
  const hidden = hiddenDelimMask(text, block);
  const parts: PMNode[] = [];
  let textOffset = 0;
  block.content.forEach((child) => {
    if (!child.isText) {
      parts.push(child);
      return;
    }
    const raw = child.text!;
    let visible = "";
    for (let i = 0; i < raw.length; i++) {
      if (!hidden[textOffset + i]) visible += raw[i];
    }
    textOffset += raw.length;
    if (visible) parts.push(child.type.schema.text(visible, child.marks));
  });
  return block.type.create(block.attrs, Fragment.from(parts), block.marks);
}

function stripDelimitersInNode(node: PMNode): PMNode {
  if (node.isTextblock) return stripDelimitersInTextblock(node);
  if (!node.content.size) return node;
  const parts: PMNode[] = [];
  node.forEach((child) => parts.push(stripDelimitersInNode(child)));
  return node.copy(Fragment.from(parts));
}

/** Remove method-B delimiter chars so copy targets see rendered content only. */
export function stripSliceDelimiters(slice: Slice, schema: Schema): Fragment {
  const doc = schema.nodes.doc.create(null, slice.content);
  return stripDelimitersInNode(doc).content;
}

/** Serialize a document slice to an HTML source string. */
export function sliceToHtml(slice: Slice, schema: Schema): string {
  const wrap = document.createElement("div");
  DOMSerializer.fromSchema(schema).serializeFragment(
    stripSliceDelimiters(slice, schema),
    { document },
    wrap,
  );
  return wrap.innerHTML;
}

/** Serialize a document slice to visible plain text (no markdown delimiters). */
export function sliceToPlainText(slice: Slice, schema: Schema): string {
  const content = stripSliceDelimiters(slice, schema);
  return content.textBetween(0, content.size, "\n\n");
}

/** Copy the current selection as HTML source to the clipboard. */
export async function copySelectionAsHtml(view: EditorView): Promise<boolean> {
  const slice = selectionSlice(view);
  if (!slice) return false;
  await writeTextToClipboard(sliceToHtml(slice, view.state.schema));
  view.focus();
  return true;
}

/** Copy the current selection as visible plain text (no markdown syntax). */
export async function copySelectionAsPlainText(view: EditorView): Promise<boolean> {
  const slice = selectionSlice(view);
  if (!slice) return false;
  await writeTextToClipboard(sliceToPlainText(slice, view.state.schema));
  view.focus();
  return true;
}

function insertPlainText(view: EditorView, raw: string): boolean {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text) return false;
  const { from, to } = view.state.selection;
  view.dispatch(
    view.state.tr
      .insertText(text, from, to)
      .scrollIntoView()
      .setMeta(PASTE_PLAIN_TEXT_META, true),
  );
  view.focus();
  return true;
}

/** Paste clipboard markdown through the parse pipeline. */
export async function pasteFromClipboard(
  view: EditorView,
  plain = false,
): Promise<boolean> {
  const raw = await readClipboardText();
  if (!raw) return false;
  if (plain) return insertPlainText(view, raw);
  return insertMarkdownFromText(view, raw);
}

/** Insert clipboard plain text without parsing markdown. */
export async function pasteAsPlainText(view: EditorView): Promise<boolean> {
  return pasteFromClipboard(view, true);
}
