import type { EditorView } from "prosemirror-view";

/**
 * Visible surface used when clamping drag-select pointers.
 * Prefer the scrollable editor host so the edge matches what the user sees.
 */
export function selectionSurfaceEl(view: EditorView): HTMLElement {
  return (
    (view.dom.closest(
      ".inimark-editor-host, .typora-web-editor-host, .typora-web-wrap",
    ) as HTMLElement | null) ?? view.dom
  );
}

export function selectionSurfaceRect(view: EditorView): DOMRect {
  return selectionSurfaceEl(view).getBoundingClientRect();
}

/** Scroll container that owns the editor surface (host or nearest overflow). */
export function selectionScrollContainer(view: EditorView): HTMLElement {
  let el: HTMLElement | null = selectionSurfaceEl(view);
  while (el && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return el;
    }
    el = el.parentElement;
  }
  return selectionSurfaceEl(view);
}

export function isOutsideSelectionSurface(
  view: EditorView,
  clientX: number,
  clientY: number,
): boolean {
  const rect = selectionSurfaceRect(view);
  return (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  );
}

/**
 * Map a pointer that may be outside the OS window (or editor) onto the
 * corresponding edge of the selection surface so drag-select can continue.
 *
 * Off-window coordinates are first treated as the matching window edge,
 * then clamped into the editor surface so `posAtCoords` / nearest-pos
 * mapping still resolve inside the document.
 */
export function clampSelectionPointer(
  view: EditorView,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - 1);
  const maxY = Math.max(0, window.innerHeight - 1);
  const winX = Math.max(0, Math.min(maxX, clientX));
  const winY = Math.max(0, Math.min(maxY, clientY));

  const rect = selectionSurfaceRect(view);
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: winX, y: winY };
  }

  const inset = 1;
  const left = rect.left + inset;
  const right = Math.max(left, rect.right - inset);
  const top = rect.top + inset;
  const bottom = Math.max(top, rect.bottom - inset);
  return {
    x: Math.max(left, Math.min(right, winX)),
    y: Math.max(top, Math.min(bottom, winY)),
  };
}

/** Distance from the scroll-surface edge that triggers auto-scroll while dragging. */
export const SELECTION_AUTO_SCROLL_MARGIN = 40;
const SELECTION_AUTO_SCROLL_MAX_STEP = 28;

/**
 * Native-like edge auto-scroll for owned drag-select.
 * Scrolls the editor surface when the pointer sits near its top/bottom edge
 * (including the empty bottom pad and side gutters). Returns true when the
 * scroll position changed.
 */
export function autoScrollSelectionSurface(
  view: EditorView,
  clientX: number,
  clientY: number,
  options: { margin?: number; maxStep?: number } = {},
): boolean {
  const sc = selectionScrollContainer(view);
  const rect = sc.getBoundingClientRect();
  if (rect.height <= 0) return false;

  const margin = options.margin ?? SELECTION_AUTO_SCROLL_MARGIN;
  const maxStep = options.maxStep ?? SELECTION_AUTO_SCROLL_MAX_STEP;
  const maxX = Math.max(0, window.innerWidth - 1);
  const maxY = Math.max(0, window.innerHeight - 1);
  const x = Math.max(0, Math.min(maxX, clientX));
  const y = Math.max(0, Math.min(maxY, clientY));

  // Ignore pointers far sideways of the surface — vertical edge scroll only
  // when the pointer is horizontally over the editor (or just outside).
  if (x < rect.left - margin || x > rect.right + margin) return false;

  let delta = 0;
  if (y < rect.top + margin) {
    const t = Math.min(1, (rect.top + margin - y) / margin);
    delta = -Math.ceil(maxStep * t);
  } else if (y > rect.bottom - margin) {
    const t = Math.min(1, (y - (rect.bottom - margin)) / margin);
    delta = Math.ceil(maxStep * t);
  }
  if (delta === 0) return false;

  const before = sc.scrollTop;
  const maxScroll = Math.max(0, sc.scrollHeight - sc.clientHeight);
  sc.scrollTop = Math.max(0, Math.min(maxScroll, before + delta));
  return sc.scrollTop !== before;
}
