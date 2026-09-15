import type { EditorView } from "prosemirror-view";

/**
 * Visible surface used when clamping drag-select pointers.
 * Prefer the scrollable editor host so the edge matches what the user sees.
 */
export function selectionSurfaceRect(view: EditorView): DOMRect {
  const host =
    view.dom.closest(
      ".inimark-editor-host, .typora-web-editor-host, .typora-web-wrap",
    ) ?? view.dom;
  return host.getBoundingClientRect();
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
