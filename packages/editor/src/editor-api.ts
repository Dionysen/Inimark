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

import { renderedPosToMdOffset } from "./selection-md-map.ts";
import {
  createEmbeddedCodeMirrorEditor,
  type EmbeddedCodeMirrorEditor,
} from "./code-highlighter.ts";
import { defaultPlugins } from "./editor.ts";
import { ensureTrailingSentinel } from "./trailing-sentinel.ts";
import { handleEditorSurfaceMouseDown } from "./click-focus.ts";
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
import { flashHeadingAtPos } from "./heading-flash.ts";
import { serialize } from "./serializer.ts";
import { executeEditorCommand, type EditorCommandName } from "./commands.ts";

/** Scroll/cursor snapshot for restoring where the user left off in a file. */
export interface EditorViewState {
  /** Markdown character offset for selection anchor. */
  anchor: number;
  /** Markdown character offset for selection head (omit when equal to anchor). */
  head?: number;
  /** scrollTop of the editor scroll container. */
  scrollTop: number;
  /** Whether the editor was in raw source mode. */
  sourceMode?: boolean;
}

export interface EditorOptions {
  /** Initial markdown the editor opens with. Defaults to empty. */
  initialContent?: string;
  /** Fired on every document-changing transaction; arg is the current markdown. Raw, no debounce. */
  onChange?: (md: string) => void;
  /** Fired when content is replaced programmatically (`setMarkdown`, source toggle, …). */
  onContentReplaced?: () => void;
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
  /** Capture cursor + scroll position for the current document. */
  getViewState(): EditorViewState;
  /** Restore cursor + scroll after `setMarkdown` (waits for layout). */
  restoreViewState(state: EditorViewState): void;
  /** Smooth-scroll the editor surface to the top. */
  scrollToTop(): void;
  /** Smooth-scroll the editor surface to the bottom. */
  scrollToBottom(): void;
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
  /** Skip typewriter recenter until this timestamp (outline jump pins heading to top). */
  let suppressTypewriterUntil = 0;
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

  interface ScrollSnapshot {
    scrollTop: number;
    cursorTopInViewport: number | null;
  }

  function captureScrollSnapshot(fromSource: boolean): ScrollSnapshot {
    const scrollHost = findScrollContainer();
    const snapshot: ScrollSnapshot = {
      scrollTop: scrollHost.scrollTop,
      cursorTopInViewport: null,
    };
    try {
      const rect = scrollHost.getBoundingClientRect();
      if (fromSource && sourceView) {
        const head = sourceView.view.state.selection.main.head;
        const coords = sourceView.view.coordsAtPos(head);
        snapshot.cursorTopInViewport = coords.top - rect.top;
      } else {
        const head = view.state.selection.head;
        const coords = view.coordsAtPos(head);
        snapshot.cursorTopInViewport = coords.top - rect.top;
      }
    } catch {
      /* layout not ready */
    }
    return snapshot;
  }

  function restoreScrollSnapshot(
    snapshot: ScrollSnapshot,
    getCoords: () => { top: number } | null,
  ): void {
    const scrollHost = findScrollContainer();
    try {
      const coords = getCoords();
      if (coords && snapshot.cursorTopInViewport != null) {
        const rect = scrollHost.getBoundingClientRect();
        const topInContent = coords.top - rect.top + scrollHost.scrollTop;
        scrollHost.scrollTop = Math.max(0, topInContent - snapshot.cursorTopInViewport);
        return;
      }
    } catch {
      /* fall through */
    }
    scrollHost.scrollTop = snapshot.scrollTop;
  }

  function scheduleScrollRestore(
    snapshot: ScrollSnapshot,
    getCoords: () => { top: number } | null,
    onDone?: () => void,
  ): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScrollSnapshot(snapshot, getCoords);
        onDone?.();
      });
    });
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
    if (performance.now() < suppressTypewriterUntil) return;
    if (typewriterRaf != null) return;
    typewriterRaf = requestAnimationFrame(() => {
      typewriterRaf = null;
      if (performance.now() < suppressTypewriterUntil) return;
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
    const parsed = initialMd ? parse(initialMd) : schema.nodes.doc.createAndFill()!;
    const doc = ensureTrailingSentinel(parsed);
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
  function mdOffsetToRenderedPos(md: string, offset: number): number {
    try {
      return parse(md.slice(0, Math.max(0, offset))).content.size;
    } catch {
      return 0;
    }
  }

  function currentMdSelection(): { anchor: number; head: number } {
    if (inSource && sourceView) {
      const sel = sourceView.view.state.selection.main;
      return { anchor: sel.anchor, head: sel.head };
    }
    const sel = view.state.selection;
    try {
      const anchor = renderedPosToMdOffset(view.state.doc, sel.from);
      const head = renderedPosToMdOffset(view.state.doc, sel.to);
      return { anchor, head };
    } catch {
      const len = serialize(view.state.doc).length;
      return { anchor: len, head: len };
    }
  }

  function setRenderedSelectionFromMdOffsets(md: string, anchor: number, head: number): void {
    const from = Math.min(mdOffsetToRenderedPos(md, anchor), view.state.doc.content.size);
    const to = Math.min(mdOffsetToRenderedPos(md, head), view.state.doc.content.size);
    try {
      const sel = TextSelection.create(view.state.doc, from, to);
      view.dispatch(view.state.tr.setSelection(sel));
      return;
    } catch {
      /* fall through */
    }
    try {
      const sel = TextSelection.near(view.state.doc.resolve(from));
      view.dispatch(view.state.tr.setSelection(sel));
    } catch {
      /* ignore */
    }
  }

  function suppressTypewriterScroll(): void {
    suppressTypewriterUntil = performance.now() + 800;
    if (typewriterRaf != null) {
      cancelAnimationFrame(typewriterRaf);
      typewriterRaf = null;
    }
  }

  function enterSource(): void {
    suppressTypewriterScroll();
    const snapshot = captureScrollSnapshot(false);
    const { anchor, head } = currentMdSelection();
    const md = serialize(view.state.doc);
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
    const clampedAnchor = Math.min(anchor, md.length);
    const clampedHead = Math.min(head, md.length);
    sourceView.view.dispatch({
      selection: { anchor: clampedAnchor, head: clampedHead },
    });
    inSource = true;
    scheduleScrollRestore(snapshot, () => {
      try {
        const pos = sourceView!.view.state.selection.main.head;
        return sourceView!.view.coordsAtPos(pos);
      } catch {
        return null;
      }
    }, () => sourceView?.view.focus());
  }

  function exitSource(): void {
    suppressTypewriterScroll();
    const snapshot = captureScrollSnapshot(true);
    const md = getSourceMarkdown();
    const sel = sourceView?.view.state.selection.main;
    const anchor = Math.min(sel?.anchor ?? md.length, md.length);
    const head = Math.min(sel?.head ?? md.length, md.length);
    sourceView?.destroy();
    sourceView = null;
    sourceHost.replaceChildren();
    sourceHost.hidden = true;
    editorHost.hidden = false;
    rebuild(md);
    setRenderedSelectionFromMdOffsets(md, anchor, head);
    inSource = false;
    scheduleScrollRestore(snapshot, () => {
      try {
        return view.coordsAtPos(view.state.selection.head);
      } catch {
        return null;
      }
    }, () => view.focus());
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

  function onEditorSurfaceMouseDown(e: MouseEvent): void {
    if (inSource) return;
    handleEditorSurfaceMouseDown(view, e, host);
  }

  view = buildView(options.initialContent ?? "");
  // Capture so caret placement runs before ProseMirror's default mousedown handling.
  host.addEventListener("mousedown", onEditorSurfaceMouseDown, true);

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
      options.onContentReplaced?.();
    },
    toggleSource(): void {
      if (inSource) exitSource();
      else enterSource();
      options.onContentReplaced?.();
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

      const normalizeHeadingText = (value: string): string =>
        value
          .trim()
          .replace(/!\[[^\]]*]\([^)]*\)/g, "")
          .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
          .replace(/[*_~`]+/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const lineAt = (pos: number): number => {
        const safe = Math.max(0, Math.min(pos, view.state.doc.content.size));
        const before = view.state.doc.textBetween(0, safe, "\n", "\n");
        return before ? before.split("\n").length : 1;
      };

      const findHeadingPos = (): number | null => {
        const normNeedle = normalizeHeadingText(needle);
        type Candidate = { pos: number; textScore: number; lineDist: number };
        const candidates: Candidate[] = [];

        view.state.doc.descendants((node, pos) => {
          if (node.type.name !== "heading") return;
          const normContent = normalizeHeadingText(node.textContent);
          let textScore = 99;
          if (normNeedle && normContent === normNeedle) textScore = 0;
          else if (
            normNeedle &&
            (normContent.includes(normNeedle) || normNeedle.includes(normContent))
          ) {
            textScore = 1;
          }
          const lineDist =
            line != null && Number.isFinite(line) ? Math.abs(lineAt(pos) - line) : 0;
          // Keep text matches, or near-line headings when the outline line hint is close.
          if (textScore < 99 || (line != null && lineDist <= 3)) {
            candidates.push({ pos, textScore, lineDist });
          }
        });

        if (candidates.length === 0) return null;
        candidates.sort(
          (a, b) => a.textScore - b.textScore || a.lineDist - b.lineDist,
        );
        return candidates[0]!.pos;
      };

      const jump = (): boolean => {
        const bestPos = findHeadingPos();
        if (bestPos == null) {
          return revealSearchMatchInView(
            view,
            { query: needle, line },
            findScrollContainer(),
          );
        }

        const tr = view.state.tr;
        tr.setSelection(TextSelection.near(tr.doc.resolve(bestPos + 1)));
        // Keep the heading at the top; don't let typewriter mode re-center.
        suppressTypewriterUntil = performance.now() + 800;
        if (typewriterRaf != null) {
          cancelAnimationFrame(typewriterRaf);
          typewriterRaf = null;
        }
        view.dispatch(tr);

        const scrollHost = findScrollContainer();
        try {
          const coords = view.coordsAtPos(bestPos + 1);
          const hostRect = scrollHost.getBoundingClientRect();
          const target = coords.top - hostRect.top + scrollHost.scrollTop;
          scrollHost.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
        } catch {
          const dom = view.nodeDOM(bestPos) as HTMLElement | null;
          dom?.scrollIntoView({ block: "start", behavior: "smooth" });
        }

        flashHeadingAtPos(view, bestPos);
        // Defer focus so the outline mousedown/click sequence isn't stolen.
        requestAnimationFrame(() => view.focus());
        return true;
      };

      // Wait for source→IR layout (and any pending paint) before measuring.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          jump();
        });
      });
      return true;
    },
    clearSearchHighlight() {
      clearSearchRevealInView(view);
    },
    getViewState(): EditorViewState {
      const { anchor, head } = currentMdSelection();
      return {
        anchor,
        head: head !== anchor ? head : undefined,
        scrollTop: findScrollContainer().scrollTop,
        sourceMode: inSource || undefined,
      };
    },
    restoreViewState(state: EditorViewState): void {
      const apply = (): void => {
        suppressTypewriterScroll();
        const anchor = Math.max(0, state.anchor);
        const head = Math.max(0, state.head ?? state.anchor);

        if (state.sourceMode) {
          const md = serialize(view.state.doc);
          const clampedAnchor = Math.min(anchor, md.length);
          const clampedHead = Math.min(head, md.length);
          setRenderedSelectionFromMdOffsets(md, clampedAnchor, clampedHead);
          if (!inSource) enterSource();
          const mdNow = getSourceMarkdown();
          const a = Math.min(clampedAnchor, mdNow.length);
          const h = Math.min(clampedHead, mdNow.length);
          sourceView?.view.dispatch({ selection: { anchor: a, head: h } });
        } else {
          if (inSource) exitSource();
          const md = serialize(view.state.doc);
          const clampedAnchor = Math.min(anchor, md.length);
          const clampedHead = Math.min(head, md.length);
          setRenderedSelectionFromMdOffsets(md, clampedAnchor, clampedHead);
        }

        findScrollContainer().scrollTop = Math.max(0, state.scrollTop);
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(apply);
      });
    },
    scrollToTop(): void {
      findScrollContainer().scrollTo({ top: 0, behavior: "smooth" });
    },
    scrollToBottom(): void {
      const scrollHost = findScrollContainer();
      scrollHost.scrollTo({ top: scrollHost.scrollHeight, behavior: "smooth" });
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
      host.removeEventListener("mousedown", onEditorSurfaceMouseDown);
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
