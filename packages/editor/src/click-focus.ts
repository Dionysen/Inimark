import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { isModifiedClick, isRenderedNavigablePointer } from "./link-navigation.ts";
import { isEmptyParagraph, trailingSentinelStart } from "./trailing-sentinel.ts";

type BlockRect = {
  nodePos: number;
  node: PMNode;
  from: number;
  to: number;
  top: number;
  bottom: number;
  opaque: boolean;
};

const OPAQUE_BLOCKS = new Set([
  "code_block",
  "math_block",
  "horizontal_rule",
  "more_break",
  "html_block",
]);

function isInteractiveEditorTarget(target: Element): boolean {
  if (target.closest(".typora-web-code-editor .cm-editor")) return true;
  if (target.closest(".cb-lang-input, .cb-lang-menu")) return true;
  if (target.closest(".typora-web-html-source")) return true;
  // Editable TeX source while revealed (open / error / empty draft).
  if (target.closest("math-block math-source")) {
    const block = target.closest("math-block");
    if (
      block &&
      (block.classList.contains("math-source-open") ||
        block.classList.contains("math-error") ||
        block.classList.contains("math-empty"))
    ) {
      return true;
    }
  }
  if (target.closest(".table-toolbar, .table-resize-popup, .table-insert-dialog, .table-rc-toolbar, .table-rc-popup, .inimark-editor-context-menu, .inimark-editor-context-submenu")) return true;
  if (target.closest(".emoji-completion")) return true;
  if (target.closest(".file-input")) return true;
  if (target.closest(".wiki-link-autocomplete")) return true;
  if (target.closest(".wiki-link-widget, .wiki-embed-note, .wiki-embed-image")) return true;
  if (target.closest("input, textarea, select, button")) return true;
  return false;
}

function isOpaqueChromeClick(target: Element): boolean {
  if (target.closest(".code-block-node") && !target.closest(".typora-web-code-editor")) {
    return true;
  }
  if (target.closest("math-block math-preview")) return true;
  if (target.closest(".html-block-node .html-block-preview")) return true;
  if (target.closest("toc-block")) return true;
  if (target.closest(".diagram-panel")) return true;
  const ceFalse = target.closest('.ProseMirror [contenteditable="false"]');
  if (ceFalse && !isInteractiveEditorTarget(target)) return true;
  return false;
}

/** Non-editable rendered previews — clicks must not move the caret. */
function shouldPreserveSelectionOnClick(target: Element): boolean {
  if (target.closest("math-block math-preview")) return true;
  if (target.closest(".html-block-node .html-block-preview")) return true;
  if (target.closest("toc-block")) return true;
  if (target.closest(".diagram-panel")) return true;
  return false;
}

function blockRect(
  view: EditorView,
  nodePos: number,
  node: PMNode,
  prevBottom: number | null,
): BlockRect | null {
  const from = nodePos + 1;
  const to = nodePos + node.nodeSize - 1;
  const opaque = OPAQUE_BLOCKS.has(node.type.name);
  try {
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    return {
      nodePos,
      node,
      from,
      to,
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      opaque,
    };
  } catch {
    if (!isEmptyParagraph(node)) return null;
    const top = prevBottom ?? view.dom.getBoundingClientRect().top;
    const line = 24;
    return { nodePos, node, from, to, top, bottom: top + line, opaque };
  }
}

function collectBlockRects(view: EditorView): BlockRect[] {
  const doc = view.state.doc;
  const blocks: BlockRect[] = [];
  let pos = 0;
  let prevBottom: number | null = null;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const rect = blockRect(view, pos, node, prevBottom);
    if (rect) {
      blocks.push(rect);
      prevBottom = rect.bottom;
    }
    pos += node.nodeSize;
  }
  return blocks;
}

function contentBottomBeforeSentinel(view: EditorView): number | null {
  const doc = view.state.doc;
  if (doc.childCount < 2 || !isEmptyParagraph(doc.lastChild!)) return null;
  let pos = 0;
  for (let i = 0; i < doc.childCount - 1; i++) pos += doc.child(i).nodeSize;
  const lastContent = doc.child(doc.childCount - 2)!;
  try {
    return view.coordsAtPos(pos + lastContent.nodeSize - 1).bottom;
  } catch {
    return null;
  }
}

function posInTrailingSentinel(doc: PMNode, pos: number): boolean {
  const start = trailingSentinelStart(doc);
  if (start == null) return false;
  const $pos = doc.resolve(pos);
  if ($pos.depth < 1 || $pos.index(0) !== doc.childCount - 1) return false;
  return isEmptyParagraph($pos.node(1));
}

function clickTargetIsSentinelParagraph(view: EditorView, target: Element | null): boolean {
  if (!target) return false;
  const sentinelEl = view.dom.lastElementChild;
  if (!sentinelEl || sentinelEl.tagName !== "P") return false;
  return target === sentinelEl || sentinelEl.contains(target);
}

/** Clicks that should land at the start of the trailing sentinel, not end-of-prev-line. */
function shouldFocusTrailingSentinel(
  view: EditorView,
  clientY: number,
  blocks: BlockRect[],
  target: Element | null = null,
): boolean {
  const sentinelStart = trailingSentinelStart(view.state.doc);
  if (sentinelStart == null || blocks.length === 0) return false;

  const last = blocks[blocks.length - 1]!;
  if (!isEmptyParagraph(last.node)) return false;

  if (clickTargetIsSentinelParagraph(view, target)) return true;

  const contentBottom = contentBottomBeforeSentinel(view);
  if (contentBottom != null && clientY > contentBottom + 2) return true;

  if (clientY >= last.top - 2 && clientY <= last.bottom + 2) {
    if (blocks.length < 2) return true;
    const prev = blocks[blocks.length - 2]!;
    if (clientY > prev.bottom - 2) return true;
  }

  return false;
}

function prosePosForBlock(block: BlockRect, preferStart: boolean): number {
  if (isEmptyParagraph(block.node) || preferStart) return block.from;
  return block.to;
}

function posInBlock(block: BlockRect, y: number): number {
  if (isEmptyParagraph(block.node)) return block.from;
  const mid = (block.top + block.bottom) / 2;
  return y >= mid ? block.to : block.from;
}

function nearestEditablePos(
  blocks: BlockRect[],
  index: number,
  dir: -1 | 1,
  preferStart = false,
): number | null {
  for (let i = index + dir; i >= 0 && i < blocks.length; i += dir) {
    const block = blocks[i]!;
    if (block.opaque) continue;
    if (dir < 0) return prosePosForBlock(block, false);
    return prosePosForBlock(block, preferStart || isEmptyParagraph(block.node));
  }
  return null;
}

function hitIsInsideOpaqueBlock(view: EditorView, pos: number): boolean {
  const $pos = view.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (OPAQUE_BLOCKS.has($pos.node(depth).type.name)) return true;
  }
  return false;
}

function posFromCoordsHit(
  view: EditorView,
  clientX: number,
  clientY: number,
  blocks: BlockRect[],
  target: Element | null,
): number | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (!hit || hitIsInsideOpaqueBlock(view, hit.pos)) return null;
  if (
    shouldFocusTrailingSentinel(view, clientY, blocks, target) &&
    !posInTrailingSentinel(view.state.doc, hit.pos)
  ) {
    return null;
  }
  return hit.pos;
}

/** Map a screen click to the nearest prose caret position. */
export function focusPosFromClick(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element | null = null,
): number | null {
  // Host / wrap margin clicks are outside `view.dom`. Do not force the trailing
  // sentinel — map by Y (and clamp X into the content column) like Typora.
  const inEditorTarget =
    target && view.dom.contains(target) ? target : null;

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return 1;

  const sentinelStart = trailingSentinelStart(view.state.doc);
  if (
    sentinelStart != null &&
    shouldFocusTrailingSentinel(view, clientY, blocks, inEditorTarget)
  ) {
    return sentinelStart;
  }

  const opaqueChrome = inEditorTarget ? isOpaqueChromeClick(inEditorTarget) : false;

  if (!opaqueChrome) {
    const hit = posFromCoordsHit(view, clientX, clientY, blocks, inEditorTarget);
    if (hit != null) return hit;
  }

  for (const dy of [0, -8, 8, -16, 16, -32, 32]) {
    const probe = posFromCoordsHit(view, clientX, clientY + dy, blocks, inEditorTarget);
    if (probe != null) return probe;
  }

  const editorRect = view.dom.getBoundingClientRect();
  const x = Math.max(editorRect.left + 4, Math.min(clientX, editorRect.right - 4));

  for (const dy of [0, -8, 8, -16, 16]) {
    const probe = posFromCoordsHit(view, x, clientY + dy, blocks, inEditorTarget);
    if (probe != null) return probe;
  }

  if (clientY < blocks[0]!.top) {
    return nearestEditablePos(blocks, 0, -1) ?? blocks[0]!.from;
  }

  const last = blocks[blocks.length - 1]!;
  if (clientY > last.bottom) {
    return (
      sentinelStart ??
      nearestEditablePos(blocks, blocks.length - 1, 1, true) ??
      last.to
    );
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (clientY >= block.top && clientY <= block.bottom) {
      if (block.opaque) {
        const mid = (block.top + block.bottom) / 2;
        if (clientY >= mid) {
          return (
            nearestEditablePos(blocks, i, 1) ??
            TextSelection.atEnd(view.state.doc).from
          );
        }
        return (
          nearestEditablePos(blocks, i, -1) ??
          nearestEditablePos(blocks, i, 1) ??
          TextSelection.atEnd(view.state.doc).from
        );
      }
      return posInBlock(block, clientY);
    }
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i]!;
    const next = blocks[i + 1]!;
    if (clientY > cur.bottom && clientY < next.top) {
      const gapMid = (cur.bottom + next.top) / 2;
      if (clientY >= gapMid) {
        return nearestEditablePos(blocks, i, 1, true) ?? next.from;
      }
      return nearestEditablePos(blocks, i + 1, -1) ?? cur.to;
    }
  }

  let best: { dist: number; pos: number } | null = null;
  for (const block of blocks) {
    if (block.opaque) continue;
    const mid = (block.top + block.bottom) / 2;
    const dist = Math.abs(clientY - mid);
    const pos = posInBlock(block, clientY);
    if (!best || dist < best.dist) best = { dist, pos };
  }
  return best?.pos ?? TextSelection.atEnd(view.state.doc).from;
}

/** True when PM's default click handling would miss or misplace the caret. */
export function needsClickRedirect(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element,
): boolean {
  if (isOpaqueChromeClick(target)) return true;

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return true;

  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  const hit = view.posAtCoords({ left: clientX, top: clientY });

  // Sentinel zone: only redirect when native handling would miss (host padding /
  // below-content / end-of-previous-line). Clicks on the sentinel <p> itself —
  // or coords that already resolve inside it — must keep drag-select alive.
  if (shouldFocusTrailingSentinel(view, clientY, blocks, target)) {
    if (clickTargetIsSentinelParagraph(view, target)) return false;
    if (hit && posInTrailingSentinel(view.state.doc, hit.pos)) return false;
    return true;
  }

  if (clientY < first.top - 2 || clientY > last.bottom + 2) return true;
  if (hit && hitIsInsideOpaqueBlock(view, hit.pos)) return true;
  return hit == null;
}

type SelectionDrag = {
  view: EditorView;
  anchor: number;
  moved: boolean;
  onMove: (event: MouseEvent) => void;
  onUp: (event: MouseEvent) => void;
};

let activeDrag: SelectionDrag | null = null;

function clearSelectionDrag(): void {
  if (!activeDrag) return;
  window.removeEventListener("mousemove", activeDrag.onMove, true);
  window.removeEventListener("mouseup", activeDrag.onUp, true);
  activeDrag = null;
}

function applyNearestSelection(view: EditorView, anchor: number, clientX: number, clientY: number): void {
  if (!view.editable || view.isDestroyed) return;
  const el = document.elementFromPoint(clientX, clientY);
  // Only pass in-editor targets so host/chrome hits use Y-based nearest mapping.
  const target = el && view.dom.contains(el) ? el : null;
  const head = focusPosFromClick(view, clientX, clientY, target) ?? anchor;
  if (head === anchor) {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor)).scrollIntoView(),
    );
    return;
  }
  const sel = TextSelection.create(view.state.doc, anchor, head);
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
}

/**
 * Place the caret via nearest-pos mapping and, on drag, extend the selection
 * with the same mapping so editor-chrome / sentinel clicks can select text.
 */
export function focusEditorAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  event?: Event,
): boolean {
  if (!view.editable) return false;
  const target = event?.target instanceof Element ? event.target : null;
  const pos = focusPosFromClick(view, clientX, clientY, target);
  if (pos == null) return false;

  event?.preventDefault?.();
  if (event && "stopPropagation" in event) {
    (event as MouseEvent).stopPropagation?.();
  }

  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView();
  view.dispatch(tr);
  view.focus();

  const mouse = event as MouseEvent | undefined;
  if (mouse && mouse.type === "mousedown" && mouse.button === 0) {
    clearSelectionDrag();
    const drag: SelectionDrag = {
      view,
      anchor: pos,
      moved: false,
      onMove: (moveEvent: MouseEvent) => {
        if (!(moveEvent.buttons & 1)) {
          clearSelectionDrag();
          return;
        }
        drag.moved = true;
        applyNearestSelection(view, drag.anchor, moveEvent.clientX, moveEvent.clientY);
      },
      onUp: (upEvent: MouseEvent) => {
        if (drag.moved) {
          applyNearestSelection(view, drag.anchor, upEvent.clientX, upEvent.clientY);
        }
        clearSelectionDrag();
      },
    };
    activeDrag = drag;
    window.addEventListener("mousemove", drag.onMove, true);
    window.addEventListener("mouseup", drag.onUp, true);
  }

  return true;
}

/** ProseMirror Ctrl/Cmd+click selects the whole textblock — neutralize that. */
function shouldNeutralizeModifiedClick(view: EditorView, event: MouseEvent): boolean {
  if (!view.editable || event.button !== 0 || !isModifiedClick(event)) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!view.dom.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (target.closest("a")) return false;
  if (target.closest(".wiki-link-widget, .wiki-embed-note, .wiki-embed-image")) return false;
  return true;
}

function posAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element | null,
): number | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (hit) return hit.pos;
  return focusPosFromClick(view, clientX, clientY, target);
}

function applyPreciseSelection(
  view: EditorView,
  anchor: number,
  clientX: number,
  clientY: number,
  target: Element | null = null,
): void {
  const head = posAtPoint(view, clientX, clientY, target) ?? anchor;
  const sel =
    head === anchor
      ? TextSelection.create(view.state.doc, anchor)
      : TextSelection.create(view.state.doc, anchor, head);
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
}

/** Block PM's Ctrl/Cmd+click paragraph select; keep normal click + drag behavior. */
function startPreciseSelectionAtClick(view: EditorView, event: MouseEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  const head = posAtPoint(view, event.clientX, event.clientY, target);
  if (head == null) return false;

  event.preventDefault();
  event.stopPropagation();

  const anchor = event.shiftKey ? view.state.selection.anchor : head;
  applyPreciseSelection(view, anchor, event.clientX, event.clientY, target);
  view.focus();

  if (event.type === "mousedown" && event.button === 0) {
    const dragAnchor = view.state.selection.anchor;
    clearSelectionDrag();
    const drag: SelectionDrag = {
      view,
      anchor: dragAnchor,
      moved: false,
      onMove: (moveEvent: MouseEvent) => {
        if (!(moveEvent.buttons & 1)) {
          clearSelectionDrag();
          return;
        }
        drag.moved = true;
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const moveTarget = el && view.dom.contains(el) ? el : null;
        applyPreciseSelection(view, drag.anchor, moveEvent.clientX, moveEvent.clientY, moveTarget);
      },
      onUp: (upEvent: MouseEvent) => {
        if (drag.moved) {
          const el = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
          const upTarget = el && view.dom.contains(el) ? el : null;
          applyPreciseSelection(view, drag.anchor, upEvent.clientX, upEvent.clientY, upTarget);
        }
        clearSelectionDrag();
      },
    };
    activeDrag = drag;
    window.addEventListener("mousemove", drag.onMove, true);
    window.addEventListener("mouseup", drag.onUp, true);
  }

  return true;
}

/** Focus the nearest caret for clicks anywhere on the rendered editor surface. */
export function handleEditorSurfaceMouseDown(
  view: EditorView,
  event: MouseEvent,
  root: HTMLElement,
): boolean {
  if (!view.editable || event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!root.contains(target)) return false;
  if (target.closest(".typora-web-source-editor:not([hidden])")) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (shouldPreserveSelectionOnClick(target)) return false;
  if (isRenderedNavigablePointer(view, event)) return false;

  if (shouldNeutralizeModifiedClick(view, event)) {
    return startPreciseSelectionAtClick(view, event);
  }

  if (view.dom.contains(target) && !needsClickRedirect(view, event.clientX, event.clientY, target)) {
    return false;
  }

  return focusEditorAtPoint(view, event.clientX, event.clientY, event);
}

function shouldCaptureClick(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!view.dom.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (shouldPreserveSelectionOnClick(target)) return false;
  return needsClickRedirect(view, event.clientX, event.clientY, target);
}

export function clickFocusPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (isRenderedNavigablePointer(view, event)) return false;
          if (shouldNeutralizeModifiedClick(view, event)) {
            return startPreciseSelectionAtClick(view, event);
          }
          if (!shouldCaptureClick(view, event)) return false;
          return focusEditorAtPoint(view, event.clientX, event.clientY, event);
        },
      },
    },
  });
}
