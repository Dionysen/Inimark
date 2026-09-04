/** Shared vertical column-resize handle for left/right side panels. */

export type ColumnSide = "left" | "right";

export interface ColumnResizeOptions {
  /** Which edge of `container` the handle sits on. Default: `"left"` (handle on the right edge). */
  side?: ColumnSide;
  minWidth?: number;
  maxWidth?: number;
  getWidth: () => number;
  onWidthChange: (width: number) => void;
  className?: string;
}

export interface ColumnResizeController {
  el: HTMLElement;
  destroy(): void;
}

const BODY_RESIZING_CLASS = "is-column-resizing";

export function attachColumnResize(
  container: HTMLElement,
  options: ColumnResizeOptions,
): ColumnResizeController {
  const side = options.side ?? "left";
  const minWidth = options.minWidth ?? 180;
  const maxWidth = options.maxWidth ?? 800;

  const handle = document.createElement("div");
  handle.className = options.className ?? "inimark-resize-handle";
  handle.classList.add(`inimark-resize-handle--${side}`);
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.title = "Drag to resize";

  let startX = 0;
  let startWidth = 0;
  let resizing = false;

  function onMouseMove(event: MouseEvent): void {
    if (!resizing) return;
    const delta = side === "left" ? event.clientX - startX : startX - event.clientX;
    const next = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
    options.onWidthChange(next);
  }

  function stopResize(): void {
    if (!resizing) return;
    resizing = false;
    container.classList.remove("is-resizing");
    document.body.classList.remove(BODY_RESIZING_CLASS);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopResize);
  }

  function onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    resizing = true;
    startX = event.clientX;
    startWidth = options.getWidth();
    container.classList.add("is-resizing");
    document.body.classList.add(BODY_RESIZING_CLASS);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopResize);
  }

  handle.addEventListener("mousedown", onMouseDown);
  container.append(handle);

  return {
    el: handle,
    destroy() {
      stopResize();
      handle.removeEventListener("mousedown", onMouseDown);
      handle.remove();
    },
  };
}

export function loadPersistedWidth(
  key: string,
  fallback: number,
  minWidth: number,
  maxWidth: number,
): number {
  try {
    const saved = Number(localStorage.getItem(key));
    if (Number.isFinite(saved)) {
      return Math.max(minWidth, Math.min(maxWidth, saved));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function persistWidth(key: string, width: number): void {
  try {
    localStorage.setItem(key, String(Math.round(width)));
  } catch {
    /* ignore */
  }
}
