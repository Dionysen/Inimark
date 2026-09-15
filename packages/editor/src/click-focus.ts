import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { isModifiedClick, isRenderedNavigablePointer } from "./link-navigation.ts";
import {
  clampSelectionPointer,
  isOutsideSelectionSurface,
} from "./selection-edge.ts";
import {
  clampPosAwayFromSentinel,
  editableEndPos,
  isEmptyParagraph,
  posInTrailingSentinel,
  trailingSentinelStart,
} from "./trailing-sentinel.ts";

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
  if (target.closest(".cb-chrome, .cb-lang-input, .cb-lang-menu")) return true;
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
  forSelection = false,
): boolean {
  const sentinelStart = trailingSentinelStart(view.state.doc);
  if (sentinelStart == null || blocks.length === 0) return false;

  const last = blocks[blocks.length - 1]!;
  if (!isEmptyParagraph(last.node)) return false;

  // Target-based hit is for caret placement only. During drag-select the pointer
  // Y is authoritative — elementFromPoint can still report the sentinel <p>.
  if (!forSelection && clickTargetIsSentinelParagraph(view, target)) return true;

  const contentBottom = contentBottomBeforeSentinel(view);
  if (contentBottom != null && clientY > contentBottom + 2) return true;

  if (clientY >= last.top - 2 && clientY <= last.bottom + 2) {
    if (blocks.length < 2) return true;
    const prev = blocks[blocks.length - 2]!;
    if (clientY > prev.bottom - 2) return true;
  }

  return false;
}

/** Sentinel-zone target: caret → sentinel start; drag-select → editable end. */
function posForTrailingSentinelZone(doc: PMNode, forSelection: boolean): number {
  const sentinelStart = trailingSentinelStart(doc);
  if (sentinelStart == null) return editableEndPos(doc);
  return forSelection ? editableEndPos(doc) : sentinelStart;
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
  forSelection: boolean,
): number | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (!hit || hitIsInsideOpaqueBlock(view, hit.pos)) return null;
  if (shouldFocusTrailingSentinel(view, clientY, blocks, target, forSelection)) {
    // Native coords often resolve to the previous line; force the sentinel zone.
    if (!posInTrailingSentinel(view.state.doc, hit.pos)) return null;
    if (forSelection) return editableEndPos(view.state.doc);
  } else if (forSelection && posInTrailingSentinel(view.state.doc, hit.pos)) {
    return editableEndPos(view.state.doc);
  }
  return hit.pos;
}

export type FocusPosOptions = {
  /**
   * When true, map the trailing-sentinel zone to the end of editable content
   * so drag-select never anchors inside the empty sentinel paragraph.
   */
  forSelection?: boolean;
};

/** Map a screen click to the nearest prose caret / selection position. */
export function focusPosFromClick(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element | null = null,
  options: FocusPosOptions = {},
): number | null {
  const forSelection = options.forSelection === true;
  // Host / wrap margin clicks are outside `view.dom`. Do not force the trailing
  // sentinel — map by Y (and clamp X into the content column) like Typora.
  const inEditorTarget =
    target && view.dom.contains(target) ? target : null;

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return 1;

  const doc = view.state.doc;
  const sentinelStart = trailingSentinelStart(doc);
  if (
    sentinelStart != null &&
    shouldFocusTrailingSentinel(view, clientY, blocks, inEditorTarget, forSelection)
  ) {
    return posForTrailingSentinelZone(doc, forSelection);
  }

  const opaqueChrome = inEditorTarget ? isOpaqueChromeClick(inEditorTarget) : false;

  if (!opaqueChrome) {
    const hit = posFromCoordsHit(view, clientX, clientY, blocks, inEditorTarget, forSelection);
    if (hit != null) return forSelection ? clampPosAwayFromSentinel(doc, hit) : hit;
  }

  for (const dy of [0, -8, 8, -16, 16, -32, 32]) {
    const probe = posFromCoordsHit(
      view,
      clientX,
      clientY + dy,
      blocks,
      inEditorTarget,
      forSelection,
    );
    if (probe != null) return forSelection ? clampPosAwayFromSentinel(doc, probe) : probe;
  }

  const editorRect = view.dom.getBoundingClientRect();
  const x = Math.max(editorRect.left + 4, Math.min(clientX, editorRect.right - 4));

  for (const dy of [0, -8, 8, -16, 16]) {
    const probe = posFromCoordsHit(view, x, clientY + dy, blocks, inEditorTarget, forSelection);
    if (probe != null) return forSelection ? clampPosAwayFromSentinel(doc, probe) : probe;
  }

  if (clientY < blocks[0]!.top) {
    return nearestEditablePos(blocks, 0, -1) ?? blocks[0]!.from;
  }

  const last = blocks[blocks.length - 1]!;
  if (clientY > last.bottom) {
    if (sentinelStart != null) return posForTrailingSentinelZone(doc, forSelection);
    return nearestEditablePos(blocks, blocks.length - 1, 1, true) ?? last.to;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (clientY >= block.top && clientY <= block.bottom) {
      // The last empty paragraph is the sentinel — never use it as a selection head.
      if (forSelection && i === blocks.length - 1 && isEmptyParagraph(block.node) && sentinelStart != null) {
        return editableEndPos(doc);
      }
      if (block.opaque) {
        const mid = (block.top + block.bottom) / 2;
        if (clientY >= mid) {
          return (
            nearestEditablePos(blocks, i, 1) ??
            TextSelection.atEnd(doc).from
          );
        }
        return (
          nearestEditablePos(blocks, i, -1) ??
          nearestEditablePos(blocks, i, 1) ??
          TextSelection.atEnd(doc).from
        );
      }
      const pos = posInBlock(block, clientY);
      return forSelection ? clampPosAwayFromSentinel(doc, pos) : pos;
    }
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i]!;
    const next = blocks[i + 1]!;
    if (clientY > cur.bottom && clientY < next.top) {
      const gapMid = (cur.bottom + next.top) / 2;
      if (clientY >= gapMid) {
        if (
          forSelection &&
          i + 1 === blocks.length - 1 &&
          isEmptyParagraph(next.node) &&
          sentinelStart != null
        ) {
          return editableEndPos(doc);
        }
        return nearestEditablePos(blocks, i, 1, true) ?? next.from;
      }
      return nearestEditablePos(blocks, i + 1, -1) ?? cur.to;
    }
  }

  let best: { dist: number; pos: number } | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.opaque) continue;
    if (forSelection && i === blocks.length - 1 && isEmptyParagraph(block.node) && sentinelStart != null) {
      continue;
    }
    const mid = (block.top + block.bottom) / 2;
    const dist = Math.abs(clientY - mid);
    const pos = posInBlock(block, clientY);
    if (!best || dist < best.dist) best = { dist, pos };
  }
  const fallback = best?.pos ?? TextSelection.atEnd(doc).from;
  return forSelection ? clampPosAwayFromSentinel(doc, fallback) : fallback;
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

  // Sentinel zone: always own caret + drag. Native selection from an empty
  // sentinel paragraph gets stuck when dragging upward into content.
  if (shouldFocusTrailingSentinel(view, clientY, blocks, target)) return true;

  if (clientY < first.top - 2 || clientY > last.bottom + 2) return true;
  if (hit && hitIsInsideOpaqueBlock(view, hit.pos)) return true;
  return hit == null;
}

type SelectionDrag = {
  view: EditorView;
  /** Fixed anchor for owned drags; null means read `view.state.selection.anchor` when taking over. */
  anchor: number | null;
  /** When true, only update selection once the pointer leaves the editor/window edge. */
  edgeOnly: boolean;
  moved: boolean;
  /** Caret to restore on click-without-drag (e.g. sentinel) when mousedown used a selection anchor. */
  clickPos: number | null;
  pointerId: number | null;
  captureEl: Element | null;
  onMove: (event: MouseEvent) => void;
  onUp: (event: MouseEvent) => void;
};

let activeDrag: SelectionDrag | null = null;
/** Primary pointer id from the latest pointerdown — used when drag starts on mousedown. */
let lastPrimaryPointerId: number | null = null;

function clearSelectionDrag(): void {
  if (!activeDrag) return;
  const drag = activeDrag;
  activeDrag = null;
  window.removeEventListener("mousemove", drag.onMove, true);
  window.removeEventListener("pointermove", drag.onMove, true);
  window.removeEventListener("mouseup", drag.onUp, true);
  window.removeEventListener("pointerup", drag.onUp, true);
  window.removeEventListener("pointercancel", drag.onUp, true);
  if (
    drag.captureEl &&
    drag.pointerId != null &&
    drag.captureEl.hasPointerCapture?.(drag.pointerId)
  ) {
    try {
      drag.captureEl.releasePointerCapture(drag.pointerId);
    } catch {
      // Element may already be gone.
    }
  }
}

function tryCapturePointer(event: Event | undefined, el: Element): number | null {
  if (typeof el.setPointerCapture !== "function") return null;
  if (event instanceof PointerEvent) {
    try {
      el.setPointerCapture(event.pointerId);
      return event.pointerId;
    } catch {
      return null;
    }
  }
  // mousedown follows pointerdown; reuse the primary pointer id for capture.
  if (lastPrimaryPointerId != null) {
    try {
      el.setPointerCapture(lastPrimaryPointerId);
      return lastPrimaryPointerId;
    } catch {
      return null;
    }
  }
  return null;
}

function pointerIsOutside(view: EditorView, clientX: number, clientY: number): boolean {
  return (
    isOutsideSelectionSurface(view, clientX, clientY) ||
    clientX < 0 ||
    clientY < 0 ||
    clientX >= window.innerWidth ||
    clientY >= window.innerHeight
  );
}

function applyNearestSelection(view: EditorView, anchor: number, clientX: number, clientY: number): void {
  if (!view.editable || view.isDestroyed) return;
  const { x, y } = clampSelectionPointer(view, clientX, clientY);
  const el = document.elementFromPoint(x, y);
  // Only pass in-editor targets so host/chrome hits use Y-based nearest mapping.
  const target = el && view.dom.contains(el) ? el : null;
  const doc = view.state.doc;
  const safeAnchor = clampPosAwayFromSentinel(doc, anchor);
  const head =
    focusPosFromClick(view, x, y, target, { forSelection: true }) ?? safeAnchor;
  if (head === safeAnchor) {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(doc, safeAnchor)).scrollIntoView(),
    );
    return;
  }
  const sel = TextSelection.create(doc, safeAnchor, head);
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
}

/**
 * Install window-level drag listeners so selection continues when the pointer
 * leaves the editor or the OS window (coords clamp to the matching edge).
 */
function startSelectionDrag(
  view: EditorView,
  options: {
    anchor: number | null;
    edgeOnly: boolean;
    event?: Event;
    /** If set, restore this caret when the user clicks without dragging. */
    clickPos?: number | null;
  },
): void {
  clearSelectionDrag();
  const captureEl = view.dom;
  const pointerId = tryCapturePointer(options.event, captureEl);

  const drag: SelectionDrag = {
    view,
    anchor: options.anchor,
    edgeOnly: options.edgeOnly,
    moved: false,
    clickPos: options.clickPos ?? null,
    pointerId,
    captureEl,
    onMove: (moveEvent: MouseEvent) => {
      const hasButton = (moveEvent.buttons & 1) !== 0;
      const outside = pointerIsOutside(view, moveEvent.clientX, moveEvent.clientY);
      // Some platforms report buttons=0 for moves outside the OS window while
      // the button is still held. Only end the drag when the pointer is inside
      // and the button is clearly up; pointerup/mouseup always clear.
      if (!hasButton && !outside) {
        clearSelectionDrag();
        return;
      }
      if (drag.edgeOnly && !outside) {
        return;
      }

      drag.moved = true;
      const anchor = drag.anchor ?? view.state.selection.anchor;
      if (drag.anchor == null) drag.anchor = anchor;
      applyNearestSelection(view, anchor, moveEvent.clientX, moveEvent.clientY);
    },
    onUp: (upEvent: MouseEvent) => {
      if (!drag.moved) {
        if (
          drag.clickPos != null &&
          !view.isDestroyed &&
          view.state.selection.from !== drag.clickPos
        ) {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(view.state.doc, drag.clickPos))
              .scrollIntoView(),
          );
        }
        clearSelectionDrag();
        return;
      }
      if (!drag.edgeOnly || pointerIsOutside(view, upEvent.clientX, upEvent.clientY)) {
        const anchor = drag.anchor ?? view.state.selection.anchor;
        applyNearestSelection(view, anchor, upEvent.clientX, upEvent.clientY);
      }
      clearSelectionDrag();
    },
  };
  activeDrag = drag;
  window.addEventListener("mousemove", drag.onMove, true);
  window.addEventListener("pointermove", drag.onMove, true);
  window.addEventListener("mouseup", drag.onUp, true);
  window.addEventListener("pointerup", drag.onUp, true);
  window.addEventListener("pointercancel", drag.onUp, true);
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

  const mouse = event as MouseEvent | undefined;
  const isDragStart = !!(mouse && mouse.type === "mousedown" && mouse.button === 0);
  const selectAnchor = clampPosAwayFromSentinel(view.state.doc, pos);
  // Only when the pointer is in the trailing-sentinel zone do we avoid painting
  // the empty line during a drag. Other redirects (e.g. code-block chrome) may
  // also resolve to the sentinel caret and must keep that placement.
  const blocks = collectBlockRects(view);
  const sentinelZone = shouldFocusTrailingSentinel(view, clientY, blocks, target);
  const placePos = isDragStart && sentinelZone ? selectAnchor : pos;

  const tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, placePos))
    .scrollIntoView();
  view.dispatch(tr);
  view.focus();

  if (isDragStart) {
    startSelectionDrag(view, {
      anchor: selectAnchor,
      edgeOnly: false,
      event,
      clickPos: sentinelZone && selectAnchor !== pos ? pos : null,
    });
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
  forSelection = false,
): number | null {
  if (!forSelection) {
    const hit = view.posAtCoords({ left: clientX, top: clientY });
    if (hit) return hit.pos;
  }
  return focusPosFromClick(view, clientX, clientY, target, { forSelection });
}

function applyPreciseSelection(
  view: EditorView,
  anchor: number,
  clientX: number,
  clientY: number,
  target: Element | null = null,
): void {
  const { x, y } = clampSelectionPointer(view, clientX, clientY);
  const el = document.elementFromPoint(x, y);
  const resolvedTarget =
    target && view.dom.contains(target)
      ? target
      : el && view.dom.contains(el)
        ? el
        : null;
  const doc = view.state.doc;
  const safeAnchor = clampPosAwayFromSentinel(doc, anchor);
  const head = posAtPoint(view, x, y, resolvedTarget, true) ?? safeAnchor;
  const sel =
    head === safeAnchor
      ? TextSelection.create(doc, safeAnchor)
      : TextSelection.create(doc, safeAnchor, head);
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
    startSelectionDrag(view, {
      anchor: clampPosAwayFromSentinel(view.state.doc, view.state.selection.anchor),
      edgeOnly: false,
      event,
    });
  }

  return true;
}

/**
 * For normal (browser-owned) drag-select: keep updating once the pointer
 * leaves the editor or OS window, treating the position as the matching edge.
 */
function armNativeEdgeContinuation(view: EditorView, event: Event): void {
  if (activeDrag) return;
  startSelectionDrag(view, { anchor: null, edgeOnly: true, event });
}

function shouldArmNativeEdgeContinuation(view: EditorView, event: MouseEvent): boolean {
  if (!view.editable || event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!view.dom.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (shouldPreserveSelectionOnClick(target)) return false;
  if (isRenderedNavigablePointer(view, event)) return false;
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
    armNativeEdgeContinuation(view, event);
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
        pointerdown(view, event) {
          if (event.isPrimary && event.button === 0) {
            lastPrimaryPointerId = event.pointerId;
          }
          return false;
        },
        mousedown(view, event) {
          if (isRenderedNavigablePointer(view, event)) return false;
          if (shouldNeutralizeModifiedClick(view, event)) {
            return startPreciseSelectionAtClick(view, event);
          }
          if (shouldCaptureClick(view, event)) {
            return focusEditorAtPoint(view, event.clientX, event.clientY, event);
          }
          if (shouldArmNativeEdgeContinuation(view, event)) {
            armNativeEdgeContinuation(view, event);
          }
          return false;
        },
      },
    },
  });
}
