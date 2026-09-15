import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { isModifiedClick, isRenderedNavigablePointer } from "./link-navigation.ts";
import {
  autoScrollSelectionSurface,
  clampSelectionPointer,
  isOutsideSelectionSurface,
} from "./selection-edge.ts";

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

function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === "paragraph" && node.content.size === 0;
}

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

function posFromCoordsHit(view: EditorView, clientX: number, clientY: number): number | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (!hit || hitIsInsideOpaqueBlock(view, hit.pos)) return null;
  return hit.pos;
}

/** Map a screen click to the nearest prose caret / selection position. */
export function focusPosFromClick(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element | null = null,
): number | null {
  // Host / wrap margin clicks are outside `view.dom`. Map by Y (and clamp X
  // into the content column) like Typora.
  const inEditorTarget =
    target && view.dom.contains(target) ? target : null;

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return 1;

  const last = blocks[blocks.length - 1]!;
  if (clientY > last.bottom) {
    return nearestEditablePos(blocks, blocks.length - 1, 1, true) ?? last.to;
  }
  if (clientY < blocks[0]!.top) {
    return nearestEditablePos(blocks, 0, -1) ?? blocks[0]!.from;
  }

  const doc = view.state.doc;
  const opaqueChrome = inEditorTarget ? isOpaqueChromeClick(inEditorTarget) : false;

  if (!opaqueChrome) {
    const hit = posFromCoordsHit(view, clientX, clientY);
    if (hit != null) return hit;
  }

  for (const dy of [0, -8, 8, -16, 16, -32, 32]) {
    const probe = posFromCoordsHit(view, clientX, clientY + dy);
    if (probe != null) return probe;
  }

  const editorRect = view.dom.getBoundingClientRect();
  const x = Math.max(editorRect.left + 4, Math.min(clientX, editorRect.right - 4));

  for (const dy of [0, -8, 8, -16, 16]) {
    const probe = posFromCoordsHit(view, x, clientY + dy);
    if (probe != null) return probe;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (clientY >= block.top && clientY <= block.bottom) {
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
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.opaque) continue;
    const mid = (block.top + block.bottom) / 2;
    const dist = Math.abs(clientY - mid);
    const pos = posInBlock(block, clientY);
    if (!best || dist < best.dist) best = { dist, pos };
  }
  return best?.pos ?? TextSelection.atEnd(doc).from;
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
  lastX: number;
  lastY: number;
  raf: number | null;
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
  if (drag.raf != null) cancelAnimationFrame(drag.raf);
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

/**
 * Map the pointer to a selection head by screen coordinates.
 * Does not call scrollIntoView — scrolling is driven by edge auto-scroll so
 * empty gutters / bottom pad behave like native drag-select.
 */
function applyNearestSelection(view: EditorView, anchor: number, clientX: number, clientY: number): void {
  if (!view.editable || view.isDestroyed) return;
  autoScrollSelectionSurface(view, clientX, clientY);
  const { x, y } = clampSelectionPointer(view, clientX, clientY);
  const el = document.elementFromPoint(x, y);
  // Only pass in-editor targets so host/chrome hits use Y-based nearest mapping.
  const target = el && view.dom.contains(el) ? el : null;
  const doc = view.state.doc;
  const head = focusPosFromClick(view, x, y, target) ?? anchor;
  const next =
    head === anchor
      ? TextSelection.create(doc, anchor)
      : TextSelection.create(doc, anchor, head);
  if (next.eq(view.state.selection)) return;
  view.dispatch(view.state.tr.setSelection(next));
}

function scheduleEdgeAutoScroll(drag: SelectionDrag): void {
  if (drag.raf != null) return;
  const tick = () => {
    drag.raf = null;
    if (activeDrag !== drag || drag.view.isDestroyed) return;
    const scrolled = autoScrollSelectionSurface(drag.view, drag.lastX, drag.lastY);
    if (!scrolled) return;
    const anchor = drag.anchor ?? drag.view.state.selection.anchor;
    if (drag.anchor == null) drag.anchor = anchor;
    applyNearestSelection(drag.view, anchor, drag.lastX, drag.lastY);
    drag.raf = requestAnimationFrame(tick);
  };
  drag.raf = requestAnimationFrame(tick);
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
    clientX?: number;
    clientY?: number;
  },
): void {
  clearSelectionDrag();
  const captureEl = view.dom;
  const pointerId = tryCapturePointer(options.event, captureEl);
  const mouse = options.event as MouseEvent | undefined;

  const drag: SelectionDrag = {
    view,
    anchor: options.anchor,
    edgeOnly: options.edgeOnly,
    moved: false,
    lastX: options.clientX ?? mouse?.clientX ?? 0,
    lastY: options.clientY ?? mouse?.clientY ?? 0,
    raf: null,
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
      drag.lastX = moveEvent.clientX;
      drag.lastY = moveEvent.clientY;
      const anchor = drag.anchor ?? view.state.selection.anchor;
      if (drag.anchor == null) drag.anchor = anchor;
      applyNearestSelection(view, anchor, moveEvent.clientX, moveEvent.clientY);
      scheduleEdgeAutoScroll(drag);
    },
    onUp: (upEvent: MouseEvent) => {
      if (!drag.moved) {
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
 * with the same mapping so editor-chrome clicks can select text.
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

  // Place the caret by coordinate mapping only — do not scrollIntoView here.
  // Owned drags scroll via edge auto-scroll so empty gutters/pad can roll back.
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
  view.focus();

  if (isDragStart) {
    startSelectionDrag(view, {
      anchor: pos,
      edgeOnly: false,
      event,
      clientX,
      clientY,
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
  nearest = false,
): number | null {
  if (!nearest) {
    const hit = view.posAtCoords({ left: clientX, top: clientY });
    if (hit) return hit.pos;
  }
  return focusPosFromClick(view, clientX, clientY, target);
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
  autoScrollSelectionSurface(view, clientX, clientY);
  const head = posAtPoint(view, x, y, resolvedTarget, true) ?? anchor;
  const sel =
    head === anchor
      ? TextSelection.create(doc, anchor)
      : TextSelection.create(doc, anchor, head);
  if (!sel.eq(view.state.selection)) {
    view.dispatch(view.state.tr.setSelection(sel));
  }
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
      anchor: view.state.selection.anchor,
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
