/** Transient paired-symbol sessions; decorations stay outside editable/undo DOM. */
const PAIRS: Readonly<Record<string, string>> = {
  '"': '"', "'": "'", "“": "”", "‘": "’", "「": "」", "『": "』",
  "＂": "＂", "＇": "＇", "｢": "｣", "`": "`",
  "(": ")", "（": "）", "[": "]", "［": "］", "【": "】",
  "{": "}", "｛": "｝", "<": ">", "＜": "＞", "《": "》", "〈": "〉",
  "〔": "〕", "〖": "〗", "〘": "〙", "〚": "〛", "｟": "｠",
};

interface Quote { start: number; end: number; open: string; close: string }
interface QuoteInputOptions {
  value(): string;
  selection(): { start: number; end: number };
  caret(offset: number): void;
}

export function mountQuoteInput(el: HTMLElement, options: QuoteInputOptions) {
  let active: Quote | null = null;
  let previous = options.value();
  let composing = false;
  let inserting = false;
  let compositionBase = "";
  let disposed = false;
  const overlay = document.createElement("div");
  overlay.className = "vellum-quote-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);

  const reset = () => {
    active = null;
    previous = options.value();
    overlay.replaceChildren();
  };

  // Resolve across text nodes: native editing/undo can split a paragraph's text.
  const point = (offset: number): [Node, number] | null => {
    for (const block of el.children) {
      const walker = document.createTreeWalker(block, window.NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length ?? 0;
        if (offset <= length) return [node, offset];
        offset -= length;
      }
      if (offset === 0) return [block, block.childNodes.length];
      offset -= 1; // serialized paragraph separator
    }
    return null;
  };

  const draw = () => {
    overlay.replaceChildren();
    if (!active || !el.contains(window.getSelection()?.anchorNode ?? null)) return;
    const start = point(active.start);
    const end = point(active.end + 1);
    if (!start || !end) return;
    const viewport = el.parentElement?.getBoundingClientRect();
    if (viewport) {
      overlay.style.clipPath = `inset(${Math.max(0, viewport.top)}px ${Math.max(0, window.innerWidth - viewport.right)}px ${Math.max(0, window.innerHeight - viewport.bottom)}px ${Math.max(0, viewport.left)}px)`;
    }
    const range = document.createRange();
    range.setStart(...start);
    range.setEnd(...end);
    // One outline per visual line, including both quote characters.
    const lines: { left: number; top: number; right: number; bottom: number }[] = [];
    for (const rect of Array.from(range.getClientRects())) {
      if (!rect.width || !rect.height) continue;
      const line = lines.find((item) => Math.abs(item.top - rect.top) < 2);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.bottom = Math.max(line.bottom, rect.bottom);
      } else lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
    for (const rect of lines) {
      const frame = document.createElement("div");
      frame.className = "vellum-quote-frame";
      Object.assign(frame.style, {
        left: `${rect.left - 2}px`, top: `${rect.top - 2}px`,
        width: `${rect.right - rect.left + 4}px`, height: `${rect.bottom - rect.top + 4}px`,
      });
      overlay.append(frame);
    }
  };

  const selectionChanged = () => {
    // Wait for input to map the session if selectionchange precedes it.
    if (composing || inserting || options.value() !== previous) return;
    const { start, end } = options.selection();
    if (active && (!el.contains(window.getSelection()?.anchorNode ?? null) ||
      start <= active.start || end > active.end)) reset();
    draw();
  };

  const input = (event: Event) => {
    const value = options.value();
    if (inserting) { previous = value; return; }
    if ((event as InputEvent).inputType?.startsWith("history")) { reset(); return; }
    if (active && value !== previous) {
      let start = 0;
      while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
      let oldEnd = previous.length;
      let newEnd = value.length;
      while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === value[newEnd - 1]) { oldEnd--; newEnd--; }
      if (start > active.start && oldEnd <= active.end) active.end += newEnd - oldEnd;
      else active = null;
      if (active && (value[active.start] !== active.open || value[active.end] !== active.close ||
        value.slice(active.start, active.end).includes("\n"))) active = null;
    }
    previous = value;
    draw();
  };

  const canPair = (open: string, value: string, offset: number) => {
    if (!PAIRS[open]) return false;
    // Apostrophes and inch marks in running prose must remain ordinary text.
    const before = value[offset - 1] ?? "";
    if (open === "'") return !/[\p{Script=Latin}\p{N}]/u.test(before);
    if (open === '"') return !/\p{N}/u.test(before);
    return true;
  };

  const insert = (text: string): boolean => {
    inserting = true;
    try {
      // Native insertText records the pair in the browser's undo stack.
      return typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    } finally { inserting = false; }
  };

  const moveCaret = (offset: number) => {
    inserting = true;
    try { options.caret(offset); } finally { inserting = false; }
  };

  const beforeInput = (event: InputEvent) => {
    if (inserting || composing || event.isComposing || event.inputType !== "insertText" || !event.cancelable) return;
    const open = event.data ?? "";
    const { start, end } = options.selection();
    if (start !== end) return;
    if (active && start === active.end && open === active.close) {
      event.preventDefault();
      moveCaret(active.end + 1);
      reset();
      return;
    }
    if (!canPair(open, options.value(), start)) return;
    if (!insert(open + PAIRS[open])) return;
    event.preventDefault();
    active = { start, end: start + 1, open, close: PAIRS[open]! };
    previous = options.value();
    moveCaret(start + 1);
    draw();
  };

  const compositionStart = () => { composing = true; compositionBase = options.value(); };
  const compositionEnd = (event: CompositionEvent) => {
    composing = false;
    const open = event.data;
    // Wait for the final input event (WebKit and Chromium order it differently).
    queueMicrotask(() => {
      if (disposed || composing || !PAIRS[open]) return;
      const { start, end } = options.selection();
      const value = options.value();
      if (start !== end || value[start - 1] !== open ||
        value !== compositionBase.slice(0, start - 1) + open + compositionBase.slice(start - 1) ||
        !canPair(open, value, start - 1)) return;
      if (!insert(PAIRS[open]!)) return;
      active = { start: start - 1, end: start, open, close: PAIRS[open]! };
      previous = options.value();
      moveCaret(start);
      draw();
    });
  };

  el.addEventListener("beforeinput", beforeInput);
  el.addEventListener("input", input);
  el.addEventListener("compositionstart", compositionStart);
  el.addEventListener("compositionend", compositionEnd);
  el.addEventListener("blur", reset);
  document.addEventListener("selectionchange", selectionChanged);
  window.addEventListener("scroll", draw, true);
  window.addEventListener("resize", draw);
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
  resize?.observe(el);

  return {
    reset,
    finish(): boolean {
      selectionChanged();
      if (!active || composing) return false;
      const { start, end } = options.selection();
      if (start !== end) return false;
      moveCaret(active.end + 1);
      reset();
      return true;
    },
    destroy() {
      disposed = true;
      resize?.disconnect();
      el.removeEventListener("beforeinput", beforeInput);
      el.removeEventListener("input", input);
      el.removeEventListener("compositionstart", compositionStart);
      el.removeEventListener("compositionend", compositionEnd);
      el.removeEventListener("blur", reset);
      document.removeEventListener("selectionchange", selectionChanged);
      window.removeEventListener("scroll", draw, true);
      window.removeEventListener("resize", draw);
      overlay.remove();
    },
  };
}
