import {
  EDITOR_WIDTH_MAX,
  EDITOR_WIDTH_MIN,
  type AppSettings,
} from "../settings/store.ts";
import { t } from "../i18n/index.ts";

const BODY_RESIZING_CLASS = "is-editor-width-resizing";

export interface EditorWidthResizeOptions {
  editorHost: HTMLElement;
  overlayHost: HTMLElement;
  getSettings: () => AppSettings;
  onWidthChange: (width: number, persist: boolean) => void;
}

function clampWidth(value: number): number {
  return Math.min(EDITOR_WIDTH_MAX, Math.max(EDITOR_WIDTH_MIN, Math.round(value)));
}

export function mountEditorWidthResize(options: EditorWidthResizeOptions): () => void {
  const { editorHost, overlayHost, getSettings, onWidthChange } = options;

  const overlay = document.createElement("div");
  overlay.className = "inimark-editor-width-resize";
  overlay.setAttribute("aria-hidden", "true");

  const leftHandle = document.createElement("div");
  leftHandle.className = "inimark-editor-width-handle inimark-editor-width-handle--left";
  leftHandle.setAttribute("role", "separator");
  leftHandle.setAttribute("aria-orientation", "vertical");
  leftHandle.title = t("settings.editor.editorWidth");

  const rightHandle = document.createElement("div");
  rightHandle.className = "inimark-editor-width-handle inimark-editor-width-handle--right";
  rightHandle.setAttribute("role", "separator");
  rightHandle.setAttribute("aria-orientation", "vertical");
  rightHandle.title = t("settings.editor.editorWidth");

  overlay.append(leftHandle, rightHandle);
  overlayHost.append(overlay);

  let rafId: number | null = null;

  function syncHandles(): void {
    const wrap = editorHost.querySelector<HTMLElement>(".typora-web-wrap");
    if (!wrap) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const hostRect = overlayHost.getBoundingClientRect();
    const top = wrapRect.top - hostRect.top;
    const height = Math.max(wrapRect.height, editorHost.clientHeight);
    const left = wrapRect.left - hostRect.left;
    const right = wrapRect.right - hostRect.left;

    overlay.style.top = `${top}px`;
    overlay.style.height = `${height}px`;
    leftHandle.style.left = `${left - 4}px`;
    rightHandle.style.left = `${right - 4}px`;
  }

  function scheduleSync(): void {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncHandles();
    });
  }

  function startDrag(side: "left" | "right", event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const handle = side === "left" ? leftHandle : rightHandle;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = getSettings().editorWidth;
    handle.setPointerCapture(pointerId);
    document.body.classList.add(BODY_RESIZING_CLASS);

    function onMove(moveEvent: PointerEvent): void {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = moveEvent.clientX - startX;
      const next =
        side === "left" ? startWidth - delta : startWidth + delta;
      onWidthChange(clampWidth(next), false);
      scheduleSync();
    }

    function onUp(upEvent: PointerEvent): void {
      if (upEvent.pointerId !== pointerId) return;
      handle.releasePointerCapture(pointerId);
      document.body.classList.remove(BODY_RESIZING_CLASS);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      onWidthChange(getSettings().editorWidth, true);
      scheduleSync();
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  leftHandle.addEventListener("pointerdown", (event) => startDrag("left", event));
  rightHandle.addEventListener("pointerdown", (event) => startDrag("right", event));

  editorHost.addEventListener("scroll", scheduleSync, { passive: true });
  window.addEventListener("resize", scheduleSync, { passive: true });

  const wrap = editorHost.querySelector(".typora-web-wrap");
  const resizeObserver =
    wrap && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => scheduleSync())
      : null;
  if (wrap && resizeObserver) resizeObserver.observe(wrap);

  scheduleSync();

  return () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    document.body.classList.remove(BODY_RESIZING_CLASS);
    editorHost.removeEventListener("scroll", scheduleSync);
    window.removeEventListener("resize", scheduleSync);
    resizeObserver?.disconnect();
    overlay.remove();
  };
}
