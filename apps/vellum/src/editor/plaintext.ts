/**
 * Contenteditable plaintext writing surface.
 * One visual paragraph (`<p>`) maps to one line in the serialized file (`\n`-joined).
 * Enter creates a new paragraph and may insert ideographic-space first-line indent.
 */

import {
  firstLineIndentPrefix,
  readFirstLineIndent,
} from "@dionysen/settings-kit/editor-typography";

export interface PlaintextEditor {
  el: HTMLDivElement;
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
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

  const onInput = (): void => {
    ensureStructure(el);
    emitChange();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
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

    ensureStructure(el);
    const sel = window.getSelection();
    const block =
      closestBlock(sel?.anchorNode ?? null, el) ??
      (el.lastElementChild as HTMLElement | null);
    if (!block) {
      el.innerHTML = plaintextToHtml(text);
      emitChange();
      return;
    }

    const current = blockText(block);
    const offset = caretOffsetInBlock(block);
    const lines = text.split("\n");
    if (lines.length === 1) {
      setBlockText(
        block,
        current.slice(0, offset) + lines[0]! + current.slice(offset),
      );
      const node = block.firstChild;
      if (node) placeCaret(node, offset + lines[0]!.length);
      emitChange();
      return;
    }

    const first = current.slice(0, offset) + lines[0]!;
    const last = lines[lines.length - 1]! + current.slice(offset);
    setBlockText(block, first);
    let insertAfter: HTMLElement = block;
    for (let i = 1; i < lines.length - 1; i++) {
      const p = document.createElement("p");
      setBlockText(p, lines[i]!);
      insertAfter.after(p);
      insertAfter = p;
    }
    const lastP = document.createElement("p");
    setBlockText(lastP, last);
    insertAfter.after(lastP);
    if (lastP.firstChild?.nodeType === Node.TEXT_NODE) {
      placeCaret(lastP.firstChild, lines[lines.length - 1]!.length);
    } else {
      placeCaret(lastP, 0);
    }
    emitChange();
  };

  el.addEventListener("input", onInput);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("paste", onPaste);
  host.append(el);

  return {
    el,
    getValue: () => serializePlaintextDom(el),
    setValue: (value: string) => {
      el.innerHTML = plaintextToHtml(value);
    },
    focus: () => el.focus(),
    destroy: () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("paste", onPaste);
      el.remove();
    },
  };
}
