/** Full-pane image preview shown when a vault image is opened. */

import { createIconButton } from "./ui/widgets/index.ts";
import { onLocaleChange, t } from "./i18n/index.ts";

export interface ImageViewerController {
  el: HTMLElement;
  /** Show an image; `src` should already be a loadable URL (asset / blob). */
  show(options: { src: string; name: string }): void;
  hide(): void;
  isVisible(): boolean;
  destroy(): void;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.15;

function zoomInIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.25" stroke="currentColor" stroke-width="1.75"/><path d="M11 8.5v5M8.5 11h5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="m16 16 3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`;
}

function zoomOutIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.25" stroke="currentColor" stroke-width="1.75"/><path d="M8.5 11h5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="m16 16 3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`;
}

function zoomResetIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5.5H5.5V8M16 5.5h2.5V8M8 18.5H5.5V16M16 18.5h2.5V16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.25" stroke="currentColor" stroke-width="1.75"/></svg>`;
}

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function mountImageViewer(host: HTMLElement): ImageViewerController {
  const el = document.createElement("div");
  el.className = "inimark-image-viewer";
  el.hidden = true;
  el.setAttribute("role", "img");
  el.tabIndex = 0;

  const frame = document.createElement("div");
  frame.className = "inimark-image-viewer__frame";

  const stage = document.createElement("div");
  stage.className = "inimark-image-viewer__stage";

  const img = document.createElement("img");
  img.className = "inimark-image-viewer__img";
  img.draggable = false;
  img.decoding = "async";

  const error = document.createElement("div");
  error.className = "inimark-image-viewer__error";
  error.hidden = true;
  error.textContent = t("editor.imageLoadError");

  const toolbar = document.createElement("div");
  toolbar.className = "inimark-image-viewer__toolbar";

  const zoomOutBtn = createIconButton({
    label: t("editor.imageZoomOut"),
    title: t("editor.imageZoomOut"),
    onClick: () => zoomBy(1 / ZOOM_STEP),
  });
  zoomOutBtn.innerHTML = zoomOutIcon();

  const zoomResetBtn = createIconButton({
    label: t("editor.imageZoomReset"),
    title: t("editor.imageZoomReset"),
    onClick: () => resetView(),
  });
  zoomResetBtn.innerHTML = zoomResetIcon();

  const zoomInBtn = createIconButton({
    label: t("editor.imageZoomIn"),
    title: t("editor.imageZoomIn"),
    onClick: () => zoomBy(ZOOM_STEP),
  });
  zoomInBtn.innerHTML = zoomInIcon();

  toolbar.append(zoomOutBtn, zoomResetBtn, zoomInBtn);
  stage.append(img);
  frame.append(stage, error);
  el.append(frame, toolbar);
  host.append(el);

  let objectUrl: string | null = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragPointerId: number | null = null;
  let dragLastX = 0;
  let dragLastY = 0;

  function revokeObjectUrl(): void {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  function trackIfBlob(src: string): void {
    revokeObjectUrl();
    if (src.startsWith("blob:")) objectUrl = src;
  }

  function applyTransform(): void {
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    frame.classList.toggle("is-zoomed", scale > 1.001);
    frame.classList.toggle("is-panning", dragging);
  }

  function resetView(): void {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function zoomBy(factor: number, originX?: number, originY?: number): void {
    const next = clampZoom(scale * factor);
    if (next === scale) return;

    if (originX != null && originY != null) {
      const rect = frame.getBoundingClientRect();
      const cx = originX - (rect.left + rect.width / 2);
      const cy = originY - (rect.top + rect.height / 2);
      // Keep the point under the cursor stable while scaling.
      panX = cx - ((cx - panX) * next) / scale;
      panY = cy - ((cy - panY) * next) / scale;
    }

    scale = next;
    if (scale <= 1.001) {
      scale = 1;
      panX = 0;
      panY = 0;
    }
    applyTransform();
  }

  function syncToolbarLabels(): void {
    zoomOutBtn.title = t("editor.imageZoomOut");
    zoomOutBtn.setAttribute("aria-label", t("editor.imageZoomOut"));
    zoomResetBtn.title = t("editor.imageZoomReset");
    zoomResetBtn.setAttribute("aria-label", t("editor.imageZoomReset"));
    zoomInBtn.title = t("editor.imageZoomIn");
    zoomInBtn.setAttribute("aria-label", t("editor.imageZoomIn"));
  }

  img.addEventListener("load", () => {
    error.hidden = true;
    img.hidden = false;
    resetView();
  });
  img.addEventListener("error", () => {
    img.hidden = true;
    error.hidden = false;
    resetView();
  });

  frame.addEventListener(
    "wheel",
    (event) => {
      if (el.hidden) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomBy(factor, event.clientX, event.clientY);
    },
    { passive: false },
  );

  frame.addEventListener("pointerdown", (event) => {
    if (el.hidden || event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.("button")) return;
    dragging = true;
    dragPointerId = event.pointerId;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    frame.setPointerCapture(event.pointerId);
    applyTransform();
  });

  frame.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== dragPointerId) return;
    panX += event.clientX - dragLastX;
    panY += event.clientY - dragLastY;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    applyTransform();
  });

  function endDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    if (frame.hasPointerCapture(event.pointerId)) {
      frame.releasePointerCapture(event.pointerId);
    }
    applyTransform();
  }

  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);
  frame.addEventListener("lostpointercapture", () => {
    dragging = false;
    dragPointerId = null;
    applyTransform();
  });

  const unsubLocale = onLocaleChange(() => {
    error.textContent = t("editor.imageLoadError");
    syncToolbarLabels();
  });

  return {
    el,
    show({ src, name }) {
      trackIfBlob(src);
      error.hidden = true;
      img.hidden = false;
      img.removeAttribute("src");
      img.alt = name;
      img.src = src;
      el.setAttribute("aria-label", name);
      el.hidden = false;
      resetView();
    },
    hide() {
      el.hidden = true;
      img.removeAttribute("src");
      img.alt = "";
      error.hidden = true;
      dragging = false;
      dragPointerId = null;
      resetView();
      revokeObjectUrl();
    },
    isVisible() {
      return !el.hidden;
    },
    destroy() {
      unsubLocale();
      revokeObjectUrl();
      el.remove();
    },
  };
}
