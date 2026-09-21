/**
 * Contenteditable plaintext writing surface.
 * One visual paragraph (`<p>`) maps to one line in the serialized file (`\n`-joined).
 * Enter creates a new paragraph and may insert ideographic-space first-line indent.
 */

import {
  firstLineIndentPrefix,
  readFirstLineIndent,
} from "@dionysen/settings-kit/editor-typography";
import { mountQuoteInput } from "./quote-input";

export interface PlaintextEditor {
  el: HTMLDivElement;
  getValue(): string;
  /** Replace the article; emitChange is used by user-triggered transformations. */
  setValue(value: string, emitChange?: boolean): void;
  focus(): void;
  /** True when the editor has a non-empty text selection. */
  hasSelection(): boolean;
  /** Copy the current selection to the clipboard. */
  copySelection(): Promise<boolean>;
  /** Cut the current selection to the clipboard. */
  cutSelection(): Promise<boolean>;
  /** Paste clipboard text at the caret, replacing any selection. */
  pasteClipboard(): Promise<boolean>;
  /** Place the caret at the end of the document and focus. */
  focusAtEnd(): void;
  /** Keep the caret line vertically centered while writing. */
  setTypewriterMode(enabled: boolean): void;
  isTypewriterMode(): boolean;
  destroy(): void;
}

export interface MountPlaintextOptions {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Override indent count; defaults to `document.documentElement` dataset. */
  getFirstLineIndent?: () => number;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Serialize editor DOM → file text (paragraphs joined by `\n`). */
export function serializePlaintextDom(root: HTMLElement): string {
  const blocks = [...root.children].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  if (blocks.length === 0) {
    return (root.textContent ?? "").replace(/\u00a0/g, " ");
  }
  return blocks
    .map((block) => block.innerText.replace(/\u00a0/g, " ").replace(/\n/g, ""))
    .join("\n");
}

/** Build paragraph HTML from file text (`\n` → `<p>`). */
export function plaintextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.length === 0 ? [""] : normalized.split("\n");
  return lines
    .map((line) => {
      if (line.length === 0) return "<p><br></p>";
      return `<p>${escapeText(line)}</p>`;
    })
    .join("");
}

function placeCaret(node: Node, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const max =
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent?.length ?? 0)
      : node.childNodes.length;
  range.setStart(node, Math.max(0, Math.min(offset, max)));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function closestBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur instanceof HTMLElement && cur.parentElement === root) return cur;
    cur = cur.parentNode;
  }
  return null;
}

function blockText(block: HTMLElement): string {
  return block.innerText.replace(/\u00a0/g, " ").replace(/\n/g, "");
}

function setBlockText(block: HTMLElement, text: string): void {
  block.replaceChildren();
  if (text.length === 0) {
    block.append(document.createElement("br"));
    return;
  }
  block.textContent = text;
}

function caretOffsetInBlock(block: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return blockText(block).length;
  const range = sel.getRangeAt(0);
  if (!block.contains(range.startContainer)) return blockText(block).length;
  const pre = range.cloneRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().replace(/\u00a0/g, " ").replace(/\n/g, "").length;
}

function ensureStructure(root: HTMLElement): void {
  if (root.querySelector(":scope > p")) return;
  root.innerHTML = plaintextToHtml(root.textContent ?? "");
}

function editorBlocks(root: HTMLElement): HTMLElement[] {
  return [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
}

function serializedOffsetFromPoint(
  root: HTMLElement,
  container: Node,
  nodeOffset: number,
): number {
  const blocks = editorBlocks(root);
  const block = closestBlock(container, root);
  if (!block) return serializePlaintextDom(root).length;
  let pos = 0;
  for (const item of blocks) {
    if (item === block) {
      const pre = document.createRange();
      pre.selectNodeContents(block);
      try {
        pre.setEnd(container, nodeOffset);
        pos += pre.toString().replace(/\u00a0/g, " ").replace(/\n/g, "").length;
      } catch {
        pos += blockText(block).length;
      }
      return pos;
    }
    pos += blockText(item).length + 1;
  }
  return pos;
}

function placeCaretAtSerializedOffset(root: HTMLElement, offset: number): void {
  ensureStructure(root);
  const blocks = editorBlocks(root);
  if (blocks.length === 0) return;
  let remaining = Math.max(0, offset);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const text = blockText(block);
    if (remaining <= text.length) {
      if (text.length === 0 || !block.firstChild) {
        placeCaret(block, 0);
        return;
      }
      const walker = document.createTreeWalker(block, window.NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) {
          placeCaret(node, remaining);
          return;
        }
        remaining -= length;
      }
      placeCaret(block, block.childNodes.length);
      return;
    }
    remaining -= text.length;
    if (i < blocks.length - 1) remaining -= 1;
  }
  const last = blocks[blocks.length - 1]!;
  const lastText = blockText(last);
  if (lastText.length === 0 || !last.firstChild) {
    placeCaret(last, 0);
    return;
  }
  if (last.firstChild.nodeType === Node.TEXT_NODE) {
    placeCaret(last.firstChild, lastText.length);
  } else {
    placeCaret(last, last.childNodes.length);
  }
}

function readSelection(root: HTMLElement): { start: number; end: number; text: string } {
  const value = serializePlaintextDom(root);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { start: value.length, end: value.length, text: "" };
  }
  const anchor = sel.anchorNode;
  if (!anchor || !root.contains(anchor)) {
    return { start: value.length, end: value.length, text: "" };
  }
  const range = sel.getRangeAt(0);
  let start = serializedOffsetFromPoint(root, range.startContainer, range.startOffset);
  let end = serializedOffsetFromPoint(root, range.endContainer, range.endOffset);
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  start = Math.max(0, Math.min(start, value.length));
  end = Math.max(0, Math.min(end, value.length));
  return { start, end, text: value.slice(start, end) };
}

function applyReplacement(
  root: HTMLElement,
  start: number,
  end: number,
  insertText: string,
): void {
  ensureStructure(root);
  const value = serializePlaintextDom(root);
  const next = value.slice(0, start) + insertText + value.slice(end);
  root.innerHTML = plaintextToHtml(next);
  placeCaretAtSerializedOffset(root, start + insertText.length);
}

function replaceSelection(root: HTMLElement, insertText: string): void {
  const { start, end } = readSelection(root);
  applyReplacement(root, start, end, insertText);
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to execCommand fallback */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.append(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
}

async function readClipboardText(): Promise<string> {
  try {
    if (navigator.clipboard?.readText) {
      return (await navigator.clipboard.readText()) ?? "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Split `block` at the caret into [before][after], then open a new paragraph
 * after it whose content starts with the indent prefix + `after`.
 */
function splitBlockAtCaret(
  root: HTMLElement,
  block: HTMLElement,
  indentPrefix: string,
): void {
  const text = blockText(block);
  const offset = caretOffsetInBlock(block);
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  setBlockText(block, before);

  const next = document.createElement("p");
  const nextText = indentPrefix + after;
  setBlockText(next, nextText);
  block.after(next);

  if (indentPrefix.length > 0 && next.firstChild) {
    placeCaret(next.firstChild, indentPrefix.length);
  } else if (next.firstChild?.nodeType === Node.TEXT_NODE) {
    placeCaret(next.firstChild, 0);
  } else {
    placeCaret(next, 0);
  }
  void root;
}

/** Minimal contenteditable writing surface — no Markdown / ProseMirror dependency. */
export function mountPlaintextEditor(
  host: HTMLElement,
  options: MountPlaintextOptions = {},
): PlaintextEditor {
  const el = document.createElement("div");
  el.className = "vellum-plaintext-editor";
  el.contentEditable = "true";
  el.spellcheck = true;
  el.role = "textbox";
  el.ariaMultiLine = "true";
  if (options.placeholder) el.dataset.placeholder = options.placeholder;
  el.innerHTML = plaintextToHtml(options.value ?? "");

  const resolveIndent = (): number =>
    options.getFirstLineIndent?.() ?? readFirstLineIndent();

  const emitChange = (): void => {
    options.onChange?.(serializePlaintextDom(el));
  };

  // ── Typewriter mode ──────────────────────────────────────────────────────
  // Keep the caret line vertically centered. The top pad lets the first line
  // rest at center even when the document is shorter than the viewport.
  let typewriter = false;
  let typewriterRaf: number | null = null;
  let pointerDown = false;
  let composing = false;
  const quotes = mountQuoteInput(el, {
    value: () => serializePlaintextDom(el),
    selection: () => readSelection(el),
    caret: (offset) => placeCaretAtSerializedOffset(el, offset),
  });

  const applyTypewriterPad = (): void => {
    if (!typewriter) {
      el.style.removeProperty("--vellum-typewriter-pad");
      return;
    }
    const next = `${Math.max(0, Math.floor(host.clientHeight * 0.5))}px`;
    if (el.style.getPropertyValue("--vellum-typewriter-pad") !== next) {
      el.style.setProperty("--vellum-typewriter-pad", next);
    }
  };

  const caretLineRect = (range: Range): DOMRect | null => {
    const rect = range.getBoundingClientRect();
    if (rect.height > 0) return rect;
    const node = range.startContainer;
    const block =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    const blockRect = block?.getBoundingClientRect() ?? null;
    return blockRect && blockRect.height > 0 ? blockRect : null;
  };

  const centerCaret = (): void => {
    if (!typewriter) return;
    // Refresh the top pad first — the host may have resized since last time.
    applyTypewriterPad();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;
    const rect = caretLineRect(range);
    if (!rect) return;
    const hostRect = host.getBoundingClientRect();
    const lineCenter = rect.top + rect.height / 2;
    const viewCenter = hostRect.top + hostRect.height / 2;
    const delta = lineCenter - viewCenter;
    if (Math.abs(delta) < 1) return;
    host.scrollTop += delta;
  };

  const scheduleCenter = (): void => {
    if (!typewriter || pointerDown || composing || typewriterRaf != null) return;
    typewriterRaf = requestAnimationFrame(() => {
      typewriterRaf = null;
      centerCaret();
    });
  };

  const onDocumentSelectionChange = (): void => {
    if (!typewriter) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!el.contains(sel.anchorNode)) return;
    scheduleCenter();
  };

  const onPointerDown = (): void => {
    pointerDown = true;
  };

  const onPointerUp = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    scheduleCenter();
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (): void => {
    composing = false;
    scheduleCenter();
  };

  const onWindowResize = (): void => {
    applyTypewriterPad();
    scheduleCenter();
  };

  const onInput = (): void => {
    ensureStructure(el);
    emitChange();
    scheduleCenter();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.shiftKey || composing || event.isComposing || event.keyCode === 229) return;
    if (!event.ctrlKey && !event.metaKey && !event.altKey && quotes.finish()) {
      event.preventDefault();
      scheduleCenter();
      return;
    }
    quotes.reset();
    event.preventDefault();
    ensureStructure(el);
    const sel = window.getSelection();
    const block =
      closestBlock(sel?.anchorNode ?? null, el) ??
      (el.lastElementChild as HTMLElement | null);
    const prefix = firstLineIndentPrefix(resolveIndent());
    if (!block) {
      el.innerHTML = plaintextToHtml(prefix);
      const p = el.querySelector("p");
      if (p?.firstChild) placeCaret(p.firstChild, prefix.length);
      else if (p) placeCaret(p, 0);
    } else {
      splitBlockAtCaret(el, block, prefix);
    }
    emitChange();
  };

  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    const raw = event.clipboardData?.getData("text/plain") ?? "";
    const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!text) return;
    quotes.reset();
    replaceSelection(el, text);
    emitChange();
  };

  const copySelection = async (): Promise<boolean> => {
    const { text } = readSelection(el);
    if (!text) return false;
    el.focus();
    await writeClipboardText(text);
    return true;
  };

  const cutSelection = async (): Promise<boolean> => {
    const { text, start, end } = readSelection(el);
    if (!text) return false;
    el.focus();
    await writeClipboardText(text);
    quotes.reset();
    applyReplacement(el, start, end, "");
    emitChange();
    return true;
  };

  const pasteClipboard = async (): Promise<boolean> => {
    el.focus();
    const raw = await readClipboardText();
    const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!text) return false;
    quotes.reset();
    replaceSelection(el, text);
    emitChange();
    return true;
  };

  el.addEventListener("input", onInput);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("paste", onPaste);
  el.addEventListener("compositionstart", onCompositionStart);
  el.addEventListener("compositionend", onCompositionEnd);
  document.addEventListener("selectionchange", onDocumentSelectionChange);
  document.addEventListener("mousedown", onPointerDown, true);
  document.addEventListener("mouseup", onPointerUp, true);
  document.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("resize", onWindowResize);
  host.append(el);

  return {
    el,
    getValue: () => serializePlaintextDom(el),
    setValue: (value: string, emitChange = false) => {
      el.innerHTML = plaintextToHtml(value);
      quotes.reset();
      if (emitChange) options.onChange?.(value);
    },
    focus: () => el.focus(),
    hasSelection: () => readSelection(el).text.length > 0,
    copySelection,
    cutSelection,
    pasteClipboard,
    focusAtEnd: () => {
      ensureStructure(el);
      placeCaretAtSerializedOffset(el, serializePlaintextDom(el).length);
      el.focus();
      scheduleCenter();
    },
    setTypewriterMode: (enabled: boolean) => {
      typewriter = enabled;
      el.classList.toggle("is-typewriter", enabled);
      applyTypewriterPad();
      scheduleCenter();
    },
    isTypewriterMode: () => typewriter,
    destroy: () => {
      quotes.destroy();
      if (typewriterRaf != null) cancelAnimationFrame(typewriterRaf);
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", onDocumentSelectionChange);
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("mouseup", onPointerUp, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("resize", onWindowResize);
      el.remove();
    },
  };
}
