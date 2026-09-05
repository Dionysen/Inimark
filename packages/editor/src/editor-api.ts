// Public façade. Consumers see only `createEditor()` and the small
// `Editor` controller it returns; ProseMirror is an implementation
// detail.
//
// Two surfaces are intentionally exposed:
//   - the high-level controller (getMarkdown / setMarkdown /
//     toggleSource / focus / destroy) is the supported API.
//   - `editor.view` is an escape hatch onto the underlying PM
//     EditorView for advanced cases (custom plugins, deep PM hooks).
//     Documented as "no warranty" — touching it is opt-in.
//
// Source-mode toggle (rendered ↔ raw markdown textarea) is built in.
// `⌘/` (Mac) or `Ctrl+/` (other) is wired automatically; consumers
// can also call `editor.toggleSource()` directly.

import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import {
  createEmbeddedCodeMirrorEditor,
  type EmbeddedCodeMirrorEditor,
} from "./code-highlighter.ts";
import { defaultPlugins } from "./editor.ts";
import {
  createMarkdownFile,
  pickMarkdownFile,
  readMarkdownFileHandle,
  saveMarkdownFileAs as saveMarkdownAs,
  writeMarkdownFile,
  type FileResult,
} from "./local-files.ts";
import { isFocusMode as readFocusMode, setFocusMode as dispatchFocusMode } from "./modes.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";
import {
  clearSearchRevealInView,
  revealSearchMatchInView,
  type SearchRevealOptions,
} from "./search-reveal.ts";
import { serialize } from "./serializer.ts";
import { executeEditorCommand, type EditorCommandName } from "./commands.ts";

export interface EditorOptions {
  /** Initial markdown the editor opens with. Defaults to empty. */
  initialContent?: string;
  /** Fired on every document-changing transaction; arg is the current markdown. Raw, no debounce. */
  onChange?: (md: string) => void;
  /** Fired when the editor surface (rendered or source) gains focus. */
  onFocus?: () => void;
  /** Fired when the editor surface loses focus. */
  onBlur?: () => void;
}

export interface Editor {
  /** Current markdown — renders source from the live PM doc, or returns the textarea contents in source mode. */
  getMarkdown(): string;
  /** Replace the document. Works in either rendered or source mode. */
  setMarkdown(md: string): void;
  /** Flip between rendered and raw-source views. ⌘/ does the same. */
  toggleSource(): void;
  /** Whether the editor is currently in raw-source mode. */
  isSourceMode(): boolean;
  toggleFocusMode(): void;
  setFocusMode(enabled: boolean): void;
  isFocusMode(): boolean;
  toggleTypewriterMode(): void;
  setTypewriterMode(enabled: boolean): void;
  isTypewriterMode(): boolean;
  openMarkdownFile(): Promise<FileResult>;
  openMarkdownFileHandle(handle: FileSystemFileHandle): Promise<FileResult>;
  /** Start an untitled document without opening a save picker. */
  newMarkdownFile(): void;
  createMarkdownFile(): Promise<FileResult>;
  saveMarkdownFile(): Promise<FileResult>;
  saveMarkdownFileAs(): Promise<FileResult>;
  getCurrentFileName(): string | null;
  /**
   * Highlight vault-search matches and scroll to the best hit for
   * `query` / optional `line` + `snippet`. No-op when query is empty.
   */
  revealSearchMatch(options: SearchRevealOptions): boolean;
  /** Jump to a heading by text (and optional 1-based source line hint). */
  scrollToHeading(text: string, line?: number): boolean;
  /** Clear vault-search highlight decorations. */
  clearSearchHighlight(): void;
  /** Run a named format/insert command (context menu, toolbar, …). */
  executeCommand(name: EditorCommandName | string): boolean;
  /** Focus whichever surface is active. */
  focus(): void;
  /** Tear down the editor and remove its DOM. */
  destroy(): void;
  /** Escape hatch: the live ProseMirror view. Advanced; no API stability promised on this access. */
  readonly view: EditorView;
}

export function createEditor(
  host: HTMLElement,
  options: EditorOptions = {},
): Editor {
  const wrap = document.createElement("div");
  wrap.className = "typora-web-wrap";
  const editorHost = document.createElement("div");
  editorHost.className = "typora-web-editor-host";
  const sourceHost = document.createElement("div");
  sourceHost.className = "typora-web-source-editor";
  sourceHost.hidden = true;
  wrap.append(editorHost, sourceHost);
  host.append(wrap);

  let view: EditorView;
  let sourceView: EmbeddedCodeMirrorEditor | null = null;
  let inSource = false;
  let typewriterMode = false;
  let typewriterRaf: number | null = null;
  /** True while the primary button is held (drag-select); skip typewriter scroll until release. */
  let pointerSelecting = false;
  let currentFileHandle: FileSystemFileHandle | null = null;
  let currentFileName: string | null = null;

  function findScrollContainer(): HTMLElement {
    let el: HTMLElement | null = host;
    while (el && el !== document.documentElement) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
        return el;
      }
      el = el.parentElement;
    }
    return host;
  }

  function applyTypewriterPad(): void {
    if (!typewriterMode) {
      wrap.style.removeProperty("--typewriter-pad");
      return;
    }
    const sc = findScrollContainer();
    const pad = Math.max(0, Math.floor(sc.clientHeight * 0.45));
    wrap.style.setProperty("--typewriter-pad", `${pad}px`);
  }

  function scrollCursorToCenterNow(): void {
    if (inSource || pointerSelecting) return;
    try {
      const sc = findScrollContainer();
      const coords = view.coordsAtPos(view.state.selection.head);
      const lineCenter = (coords.top + coords.bottom) / 2;
      const containerTop = sc.getBoundingClientRect().top;
      const lineCenterInContent = lineCenter - containerTop + sc.scrollTop;
      sc.scrollTop = Math.max(0, lineCenterInContent - sc.clientHeight / 2);
    } catch {
      /* ignore layout races */
    }
  }

  function scheduleScrollCursorToCenter(): void {
    if (!typewriterMode || inSource || pointerSelecting) return;
    if (typewriterRaf != null) return;
    typewriterRaf = requestAnimationFrame(() => {
      typewriterRaf = null;
      scrollCursorToCenterNow();
    });
  }

  function endPointerSelecting(): void {
    if (!pointerSelecting) return;
    pointerSelecting = false;
    document.removeEventListener("mouseup", endPointerSelecting, true);
    document.removeEventListener("pointerup", endPointerSelecting, true);
    document.removeEventListener("pointercancel", endPointerSelecting, true);
    if (typewriterMode) scheduleScrollCursorToCenter();
  }

  function beginPointerSelecting(): void {
    if (pointerSelecting) return;
    pointerSelecting = true;
    if (typewriterRaf != null) {
      cancelAnimationFrame(typewriterRaf);
      typewriterRaf = null;
    }
    document.addEventListener("mouseup", endPointerSelecting, true);
    document.addEventListener("pointerup", endPointerSelecting, true);
    document.addEventListener("pointercancel", endPointerSelecting, true);
  }

  function onTypewriterResize(): void {
    if (!typewriterMode) return;
    applyTypewriterPad();
    scheduleScrollCursorToCenter();
  }

  function buildView(initialMd: string): EditorView {
    const doc = initialMd ? parse(initialMd) : schema.nodes.doc.createAndFill()!;
    const base = EditorState.create({
      schema,
      doc,
      plugins: defaultPlugins({ cursorWidget: false }),
    });
    // Fire one no-op transaction so normalize's appendTransaction runs
    // and method-B marks (em, strong, autolink, etc.) apply on first
    // render. EditorState.create alone runs `state.init` but not
    // `appendTransaction`, leaving parsed-from-seed docs with raw text.
    const state = base.apply(base.tr.setSelection(TextSelection.atStart(doc)));
    const v: EditorView = new EditorView(editorHost, {
      state,
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (typewriterMode && (tr.selectionSet || tr.docChanged)) {
          scheduleScrollCursorToCenter();
        }
        if (tr.docChanged) options.onChange?.(serialize(next.doc));
      },
      handleDOMEvents: {
        focus: () => { options.onFocus?.(); return false; },
        blur: () => { options.onBlur?.(); return false; },
        mousedown: (_view, event) => {
          // Keep existing selection on right-click (WebKit otherwise picks a word).
          if (event.button === 2) return true;
          if (event.button === 0) beginPointerSelecting();
          return false;
        },
        pointerdown: (_view, event) => {
          if (event.button === 2) return true;
          if (event.isPrimary && event.button === 0) beginPointerSelecting();
          return false;
        },
      },
    });
    return v;
  }

  function rebuild(md: string): void {
    const focusMode = readFocusMode(view.state);
    view.destroy();
    editorHost.innerHTML = "";
    view = buildView(md);
    if (focusMode) {
      dispatchFocusMode(view.state, (tr) => view.updateState(view.state.apply(tr)), true);
    }
    syncModeClasses();
    if (typewriterMode) {
      applyTypewriterPad();
      scheduleScrollCursorToCenter();
    }
  }

  function syncModeClasses(): void {
    wrap.classList.toggle("tw-focus-mode", readFocusMode(view.state));
    wrap.classList.toggle("tw-typewriter-mode", typewriterMode);
  }

  function restorePageScroll(top: number): void {
    try {
      window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
    } catch {
      try { window.scrollTo(0, top); } catch {}
    }
  }

  function preservePageScroll<T>(fn: () => T): T {
    const top = window.scrollY;
    const result = fn();
    restorePageScroll(top);
    return result;
  }

  function getSourceMarkdown(): string {
    return sourceView?.view.state.doc.toString() ?? "";
  }

  function setSourceMarkdown(md: string): void {
    if (!sourceView) return;
    sourceView.setDoc(md);
  }

  // Best-effort cursor mapping between rendered and source. Both
  // directions cut/parse a prefix and use its length / content.size as
  // the position. Mid-syntax cursors (e.g. between `*` and `bold` in
  // an unclosed `*bold`) may land a few chars off, but plain prose and
  // line boundaries are spot-on.
  function renderedCursorToMdOffset(): number {
    const sel = view.state.selection;
    try {
      return serialize(view.state.doc.cut(0, sel.from)).length;
    } catch {
      return serialize(view.state.doc).length;
    }
  }
  function mdOffsetToRenderedPos(md: string, offset: number): number {
    try {
      return parse(md.slice(0, Math.max(0, offset))).content.size;
    } catch {
      return 0;
    }
  }

  function enterSource(): void {
    preservePageScroll(() => {
      const md = serialize(view.state.doc);
      const mdCursor = renderedCursorToMdOffset();
      sourceHost.replaceChildren();
      sourceView = createEmbeddedCodeMirrorEditor({
        parent: sourceHost,
        doc: md,
        markdownSource: true,
        className: "typora-web-cm-source",
        onChange: (next) => options.onChange?.(next),
      });
      editorHost.hidden = true;
      sourceHost.hidden = false;
      const clamped = Math.min(mdCursor, md.length);
      sourceView.view.dispatch({ selection: { anchor: clamped } });
      sourceView.view.focus();
      inSource = true;
    });
  }

  function exitSource(): void {
    preservePageScroll(() => {
      const md = getSourceMarkdown();
      const mdCursor = sourceView?.view.state.selection.main.head ?? md.length;
      const targetRaw = mdOffsetToRenderedPos(md, mdCursor);
      rebuild(md);
      const target = Math.min(targetRaw, view.state.doc.content.size);
      try {
        const sel = TextSelection.near(view.state.doc.resolve(target));
        view.dispatch(view.state.tr.setSelection(sel));
      } catch {}
      sourceView?.destroy();
      sourceView = null;
      sourceHost.replaceChildren();
      sourceHost.hidden = true;
      editorHost.hidden = false;
      view.focus();
      inSource = false;
    });
  }

  // ⌘/ on Mac, Ctrl+/ elsewhere. Window-level keydown so it works
  // whether the editor or the source editor has focus; gated on
  // event-target containment so multiple editors don't poach each
  // other's keystrokes.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "F8") {
      const t = e.target as Element | null;
      if (t && (editorHost.contains(t) || sourceHost.contains(t))) {
        e.preventDefault();
        e.stopPropagation();
        controller.toggleFocusMode();
      }
      return;
    }
    if (e.key === "F9") {
      const t = e.target as Element | null;
      if (t && (editorHost.contains(t) || sourceHost.contains(t))) {
        e.preventDefault();
        e.stopPropagation();
        controller.toggleTypewriterMode();
      }
      return;
    }
    if (e.key !== "/") return;
    const isMac = /Mac/.test(navigator.platform);
    if (!(isMac ? e.metaKey : e.ctrlKey)) return;
    if (e.shiftKey || e.altKey) return;
    const t = e.target as Element | null;
    if (!t) return;
    if (!editorHost.contains(t) && !sourceHost.contains(t)) return;
    e.preventDefault();
    e.stopPropagation();
    if (inSource) exitSource();
    else enterSource();
  };
  window.addEventListener("keydown", onKey, true);

  // Wire source editor focus/blur to the same callbacks as the editor.
  if (options.onFocus) {
    sourceHost.addEventListener("focusin", () => options.onFocus!());
  }
  if (options.onBlur) {
    sourceHost.addEventListener("focusout", () => options.onBlur!());
  }

  view = buildView(options.initialContent ?? "");

  const controller: Editor = {
    getMarkdown(): string {
      return inSource ? getSourceMarkdown() : serialize(view.state.doc);
    },
    setMarkdown(md: string): void {
      if (inSource) {
        setSourceMarkdown(md);
      } else {
        rebuild(md);
      }
    },
    toggleSource(): void {
      if (inSource) exitSource();
      else enterSource();
    },
    isSourceMode(): boolean {
      return inSource;
    },
    toggleFocusMode(): void {
      this.setFocusMode(!this.isFocusMode());
    },
    setFocusMode(enabled: boolean): void {
      dispatchFocusMode(view.state, (tr) => view.dispatch(tr), enabled);
      syncModeClasses();
    },
    isFocusMode(): boolean {
      return readFocusMode(view.state);
    },
    toggleTypewriterMode(): void {
      this.setTypewriterMode(!typewriterMode);
    },
    setTypewriterMode(enabled: boolean): void {
      typewriterMode = enabled;
      syncModeClasses();
      applyTypewriterPad();
      if (enabled) {
        // Wait a frame so padding is laid out before measuring caret.
        scheduleScrollCursorToCenter();
      }
    },
    isTypewriterMode(): boolean {
      return typewriterMode;
    },
    async openMarkdownFile(): Promise<FileResult> {
      const picked = await pickMarkdownFile();
      if (picked.status !== "picked") return picked;
      try {
        const text = await picked.file.text();
        currentFileHandle = picked.handle;
        currentFileName = picked.handle?.name || picked.file.name;
        this.setMarkdown(text);
        return { status: "opened", name: currentFileName };
      } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : String(error) };
      }
    },
    async openMarkdownFileHandle(handle: FileSystemFileHandle): Promise<FileResult> {
      const result = await readMarkdownFileHandle(handle);
      if (result.status === "error") return result;
      currentFileHandle = result.handle;
      currentFileName = result.name;
      this.setMarkdown(result.text);
      return { status: "opened", name: result.name };
    },
    newMarkdownFile(): void {
      currentFileHandle = null;
      currentFileName = null;
      this.setMarkdown("");
    },
    async createMarkdownFile(): Promise<FileResult> {
      const result = await createMarkdownFile();
      if (result.status !== "created") return result;
      currentFileHandle = result.handle;
      currentFileName = result.name;
      this.setMarkdown("");
      return { status: "saved", name: result.name };
    },
    async saveMarkdownFile(): Promise<FileResult> {
      if (!currentFileHandle) return this.saveMarkdownFileAs();
      return writeMarkdownFile(currentFileHandle, this.getMarkdown());
    },
    async saveMarkdownFileAs(): Promise<FileResult> {
      const result = await saveMarkdownAs(this.getMarkdown(), currentFileName ?? "untitled.md");
      if (result.status === "saved") {
        currentFileHandle = result.handle ?? null;
        currentFileName = result.name;
      } else if (result.status === "downloaded") {
        currentFileHandle = null;
        currentFileName = result.name;
      }
      return result;
    },
    getCurrentFileName(): string | null {
      return currentFileName;
    },
    revealSearchMatch(options) {
      if (inSource) exitSource();
      // Two frames: one for setMarkdown/rebuild layout, one for reliable coords.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          revealSearchMatchInView(view, options, findScrollContainer());
        });
      });
      return true;
    },
    scrollToHeading(text, line) {
      if (inSource) exitSource();
      const needle = text.trim();
      if (!needle) return false;

      const lineAt = (pos: number): number => {
        const safe = Math.max(0, Math.min(pos, view.state.doc.content.size));
        const before = view.state.doc.textBetween(0, safe, "\n", "\n");
        return before ? before.split("\n").length : 1;
      };

      let bestPos: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      view.state.doc.descendants((node, pos) => {
        if (node.type.name !== "heading") return;
        const content = node.textContent.trim();
        let score = Number.POSITIVE_INFINITY;
        if (content === needle) score = 0;
        else if (content.includes(needle) || needle.includes(content)) score = 1;
        if (line != null && Number.isFinite(score)) {
          score += Math.abs(lineAt(pos) - line) * 0.01;
        }
        if (score < bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      });

      if (bestPos == null || bestScore >= 2) {
        return this.revealSearchMatch({ query: needle, line });
      }

      const tr = view.state.tr;
      tr.setSelection(TextSelection.near(tr.doc.resolve(bestPos + 1)));
      view.dispatch(tr);
      const dom = view.nodeDOM(bestPos) as HTMLElement | null;
      dom?.scrollIntoView({ block: "start", behavior: "smooth" });
      view.focus();
      return true;
    },
    clearSearchHighlight() {
      clearSearchRevealInView(view);
    },
    executeCommand(name) {
      if (inSource) exitSource();
      return executeEditorCommand(view, name);
    },
    focus(): void {
      if (inSource) sourceView?.view.focus();
      else view.focus();
    },
    destroy(): void {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onTypewriterResize);
      document.removeEventListener("mouseup", endPointerSelecting, true);
      document.removeEventListener("pointerup", endPointerSelecting, true);
      document.removeEventListener("pointercancel", endPointerSelecting, true);
      if (typewriterRaf != null) cancelAnimationFrame(typewriterRaf);
      wrap.style.removeProperty("--typewriter-pad");
      sourceView?.destroy();
      view.destroy();
      wrap.remove();
    },
    get view() {
      return view;
    },
  };
  syncModeClasses();
  window.addEventListener("resize", onTypewriterResize);
  return controller;
}
