/**
 * Custom overlay scrollbars — one implementation for the whole app.
 *
 * Native auto-hide fails in WKWebView: the real track steals pointer events, so
 * JS never sees “hover the track”, and container `:hover` shows the bar too early.
 *
 * Approach: hide native scrollbars, paint a fixed overlay rail/thumb, reveal on
 * scroll or when the pointer enters the edge gutter, and drag the thumb to scroll.
 * Theme via `--inimark-scrollbar-*` / `--scrollbar-*`.
 */

export const SCROLLBAR_CLASS = "inimark-scrollbar";

/** Marked roots + CodeMirror scroller (created by CM, hard to class at mount). */
export const SCROLLBAR_SELECTOR = [
  `.${SCROLLBAR_CLASS}`,
  ".cm-editor .cm-scroller",
].join(",");

const SCROLL_HIDE_DELAY_MS = 700;
const MIN_THUMB_PX = 24;
const LAYER_ID = "inimark-scrollbar-layer";

function readCssPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getThumbSize(): number {
  return readCssPx("--inimark-scrollbar-size", 8);
}

/** Hit gutter — slightly wider than the painted thumb. */
export function getHoverGutterSize(): number {
  return Math.max(getThumbSize() + 6, 14);
}

export function isScrollableY(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

export function isScrollableX(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

function matchesScrollbarRoot(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.classList.contains(SCROLLBAR_CLASS)) return true;
  return el.classList.contains("cm-scroller") && !!el.closest(".cm-editor");
}

/** True when the pointer is over the vertical/horizontal scrollbar gutter. */
export function isPointerInScrollbarGutter(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  gutterSize = getHoverGutterSize(),
): boolean {
  const rect = el.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return false;
  }

  if (isScrollableY(el) && clientX >= rect.right - gutterSize) return true;
  if (isScrollableX(el) && clientY >= rect.bottom - gutterSize) return true;
  return false;
}

/** Opt an overflow container into the shared scrollbar contract. */
export function applyScrollbar(el: HTMLElement): HTMLElement {
  el.classList.add(SCROLLBAR_CLASS);
  return el;
}

type DragState = {
  axis: "y" | "x";
  pointerId: number;
  startPointer: number;
  startScroll: number;
};

type ScrollbarInstance = {
  host: HTMLElement;
  railY: HTMLElement;
  thumbY: HTMLElement;
  railX: HTMLElement;
  thumbX: HTMLElement;
  hover: boolean;
  scrolling: boolean;
  drag: DragState | null;
  hideTimer: ReturnType<typeof setTimeout> | undefined;
  ro: ResizeObserver;
  contentMo: MutationObserver;
  abort: AbortController;
};

function ensureLayer(): HTMLElement {
  let layer = document.getElementById(LAYER_ID);
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = LAYER_ID;
  layer.className = "inimark-scrollbar-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

function createRail(axis: "y" | "x"): { rail: HTMLElement; thumb: HTMLElement } {
  const rail = document.createElement("div");
  rail.className = `inimark-scrollbar-rail inimark-scrollbar-rail--${axis}`;
  const thumb = document.createElement("div");
  thumb.className = "inimark-scrollbar-thumb";
  rail.append(thumb);
  return { rail, thumb };
}

function setVisible(inst: ScrollbarInstance, visible: boolean): void {
  const show = visible && (isScrollableY(inst.host) || isScrollableX(inst.host));
  inst.railY.classList.toggle("is-visible", show && isScrollableY(inst.host));
  inst.railX.classList.toggle("is-visible", show && isScrollableX(inst.host));
  inst.railY.classList.toggle("is-interactive", show && isScrollableY(inst.host));
  inst.railX.classList.toggle("is-interactive", show && isScrollableX(inst.host));
}

function setScrolling(inst: ScrollbarInstance, scrolling: boolean): void {
  inst.scrolling = scrolling;
  inst.railY.classList.toggle("is-scrolling", scrolling);
  inst.railX.classList.toggle("is-scrolling", scrolling);
}

function flash(inst: ScrollbarInstance): void {
  setScrolling(inst, true);
  setVisible(inst, true);
  clearTimeout(inst.hideTimer);
  inst.hideTimer = setTimeout(() => {
    setScrolling(inst, false);
    if (!inst.hover && !inst.drag) setVisible(inst, false);
  }, SCROLL_HIDE_DELAY_MS);
}

function layout(inst: ScrollbarInstance): void {
  const { host, railY, thumbY, railX, thumbX } = inst;
  if (!document.contains(host)) return;

  const rect = host.getBoundingClientRect();
  const gutter = getHoverGutterSize();
  const thumbSize = getThumbSize();

  if (isScrollableY(host)) {
    railY.hidden = false;
    railY.style.top = `${rect.top}px`;
    railY.style.left = `${rect.right - gutter}px`;
    railY.style.width = `${gutter}px`;
    railY.style.height = `${rect.height}px`;

    const track = rect.height;
    const thumbH = Math.max(MIN_THUMB_PX, (host.clientHeight / host.scrollHeight) * track);
    const maxTop = Math.max(0, track - thumbH);
    const range = host.scrollHeight - host.clientHeight;
    const top = range <= 0 ? 0 : (host.scrollTop / range) * maxTop;
    thumbY.style.width = `${thumbSize}px`;
    thumbY.style.height = `${thumbH}px`;
    thumbY.style.transform = `translateY(${top}px)`;
  } else {
    railY.hidden = true;
  }

  if (isScrollableX(host)) {
    railX.hidden = false;
    railX.style.left = `${rect.left}px`;
    railX.style.top = `${rect.bottom - gutter}px`;
    railX.style.width = `${rect.width}px`;
    railX.style.height = `${gutter}px`;

    const track = rect.width;
    const thumbW = Math.max(MIN_THUMB_PX, (host.clientWidth / host.scrollWidth) * track);
    const maxLeft = Math.max(0, track - thumbW);
    const range = host.scrollWidth - host.clientWidth;
    const left = range <= 0 ? 0 : (host.scrollLeft / range) * maxLeft;
    thumbX.style.height = `${thumbSize}px`;
    thumbX.style.width = `${thumbW}px`;
    thumbX.style.transform = `translateX(${left}px)`;
  } else {
    railX.hidden = true;
  }

  if (!inst.hover && !inst.scrolling && !inst.drag) {
    setVisible(inst, false);
  } else {
    setVisible(inst, true);
  }
}

function scrollFromThumbPosition(
  host: HTMLElement,
  axis: "y" | "x",
  pointer: number,
  railRect: DOMRect,
  thumbLength: number,
): void {
  if (axis === "y") {
    const track = railRect.height;
    const maxTop = Math.max(0, track - thumbLength);
    const top = Math.min(maxTop, Math.max(0, pointer - railRect.top - thumbLength / 2));
    const range = host.scrollHeight - host.clientHeight;
    host.scrollTop = maxTop <= 0 ? 0 : (top / maxTop) * range;
  } else {
    const track = railRect.width;
    const maxLeft = Math.max(0, track - thumbLength);
    const left = Math.min(maxLeft, Math.max(0, pointer - railRect.left - thumbLength / 2));
    const range = host.scrollWidth - host.clientWidth;
    host.scrollLeft = maxLeft <= 0 ? 0 : (left / maxLeft) * range;
  }
}

/** Show overlay scrollbars while scrolling or when the pointer is over the gutter. */
export function initAutoHideScrollbars(): () => void {
  const instances = new Map<HTMLElement, ScrollbarInstance>();
  const layer = ensureLayer();
  let lastX = 0;
  let lastY = 0;
  let hoveringRail: ScrollbarInstance | null = null;

  const destroy = (host: HTMLElement) => {
    const inst = instances.get(host);
    if (!inst) return;
    clearTimeout(inst.hideTimer);
    inst.abort.abort();
    inst.ro.disconnect();
    inst.contentMo.disconnect();
    inst.railY.remove();
    inst.railX.remove();
    instances.delete(host);
    if (hoveringRail === inst) hoveringRail = null;
  };

  const attach = (host: HTMLElement) => {
    if (instances.has(host) || !matchesScrollbarRoot(host)) return;

    const y = createRail("y");
    const x = createRail("x");
    layer.append(y.rail, x.rail);
    const abort = new AbortController();
    const { signal } = abort;

    const inst: ScrollbarInstance = {
      host,
      railY: y.rail,
      thumbY: y.thumb,
      railX: x.rail,
      thumbX: x.thumb,
      hover: false,
      scrolling: false,
      drag: null,
      hideTimer: undefined,
      ro: new ResizeObserver(() => layout(inst)),
      contentMo: new MutationObserver(() => layout(inst)),
      abort,
    };

    const onScroll = () => {
      layout(inst);
      if (!inst.drag) flash(inst);
    };

    const onWheel = () => {
      if (!inst.drag) flash(inst);
    };

    host.addEventListener("scroll", onScroll, { passive: true, signal });
    host.addEventListener("wheel", onWheel, { passive: true, signal });
    inst.ro.observe(host);
    inst.contentMo.observe(host, { childList: true, subtree: true });

    const startDrag = (axis: "y" | "x", event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const thumb = axis === "y" ? inst.thumbY : inst.thumbX;
      thumb.setPointerCapture(event.pointerId);
      inst.drag = {
        axis,
        pointerId: event.pointerId,
        startPointer: axis === "y" ? event.clientY : event.clientX,
        startScroll: axis === "y" ? host.scrollTop : host.scrollLeft,
      };
      inst.railY.classList.add("is-dragging");
      inst.railX.classList.add("is-dragging");
      setVisible(inst, true);
    };

    const onThumbPointerDown = (axis: "y" | "x") => (event: PointerEvent) => {
      startDrag(axis, event);
    };

    const onRailPointerDown = (axis: "y" | "x") => (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.target !== (axis === "y" ? inst.railY : inst.railX)) return;
      event.preventDefault();
      const rail = axis === "y" ? inst.railY : inst.railX;
      const thumb = axis === "y" ? inst.thumbY : inst.thumbX;
      const thumbLength =
        axis === "y" ? thumb.getBoundingClientRect().height : thumb.getBoundingClientRect().width;
      scrollFromThumbPosition(
        host,
        axis,
        axis === "y" ? event.clientY : event.clientX,
        rail.getBoundingClientRect(),
        thumbLength,
      );
      layout(inst);
      startDrag(axis, event);
    };

    y.thumb.addEventListener("pointerdown", onThumbPointerDown("y"), { signal });
    x.thumb.addEventListener("pointerdown", onThumbPointerDown("x"), { signal });
    y.rail.addEventListener("pointerdown", onRailPointerDown("y"), { signal });
    x.rail.addEventListener("pointerdown", onRailPointerDown("x"), { signal });

    y.rail.addEventListener(
      "pointerenter",
      () => {
        inst.hover = true;
        hoveringRail = inst;
        setVisible(inst, true);
      },
      { signal },
    );
    y.rail.addEventListener(
      "pointerleave",
      () => {
        if (inst.drag) return;
        inst.hover = false;
        if (hoveringRail === inst) hoveringRail = null;
        if (!inst.scrolling) setVisible(inst, false);
      },
      { signal },
    );
    x.rail.addEventListener(
      "pointerenter",
      () => {
        inst.hover = true;
        hoveringRail = inst;
        setVisible(inst, true);
      },
      { signal },
    );
    x.rail.addEventListener(
      "pointerleave",
      () => {
        if (inst.drag) return;
        inst.hover = false;
        if (hoveringRail === inst) hoveringRail = null;
        if (!inst.scrolling) setVisible(inst, false);
      },
      { signal },
    );

    instances.set(host, inst);
    layout(inst);
  };

  const scan = () => {
    for (const host of [...instances.keys()]) {
      if (!document.contains(host)) destroy(host);
    }
    for (const el of document.querySelectorAll(SCROLLBAR_SELECTOR)) {
      if (el instanceof HTMLElement) attach(el);
    }
    for (const inst of instances.values()) layout(inst);
  };

  const onPointerMove = (event: PointerEvent) => {
    lastX = event.clientX;
    lastY = event.clientY;

    // Active drag
    for (const inst of instances.values()) {
      if (!inst.drag || inst.drag.pointerId !== event.pointerId) continue;
      const { axis, startPointer, startScroll } = inst.drag;
      const rail = axis === "y" ? inst.railY : inst.railX;
      const thumb = axis === "y" ? inst.thumbY : inst.thumbX;
      const railRect = rail.getBoundingClientRect();
      const thumbLength =
        axis === "y" ? thumb.getBoundingClientRect().height : thumb.getBoundingClientRect().width;
      const track = axis === "y" ? railRect.height : railRect.width;
      const maxThumb = Math.max(0, track - thumbLength);
      const range =
        axis === "y"
          ? inst.host.scrollHeight - inst.host.clientHeight
          : inst.host.scrollWidth - inst.host.clientWidth;
      const delta = (axis === "y" ? event.clientY : event.clientX) - startPointer;
      const scrolled = maxThumb <= 0 ? 0 : (delta / maxThumb) * range;
      if (axis === "y") inst.host.scrollTop = startScroll + scrolled;
      else inst.host.scrollLeft = startScroll + scrolled;
      layout(inst);
      return;
    }

    // Gutter proximity (native bars are hidden, so mousemove always reaches us).
    let matched: ScrollbarInstance | null = null;
    for (const inst of instances.values()) {
      if (!isScrollableY(inst.host) && !isScrollableX(inst.host)) {
        inst.hover = false;
        continue;
      }
      if (isPointerInScrollbarGutter(inst.host, lastX, lastY)) {
        matched = inst;
        break;
      }
    }

    for (const inst of instances.values()) {
      const next = inst === matched;
      if (inst.hover === next) continue;
      if (inst.drag) continue;
      inst.hover = next;
      if (next) {
        setVisible(inst, true);
        layout(inst);
      } else if (!inst.scrolling) {
        setVisible(inst, false);
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    for (const inst of instances.values()) {
      if (!inst.drag || inst.drag.pointerId !== event.pointerId) continue;
      inst.drag = null;
      inst.railY.classList.remove("is-dragging");
      inst.railX.classList.remove("is-dragging");
      const over =
        isPointerInScrollbarGutter(inst.host, event.clientX, event.clientY) ||
        hoveringRail === inst;
      inst.hover = over;
      if (!over && !inst.scrolling) setVisible(inst, false);
    }
  };

  const onWindowChange = () => {
    for (const inst of instances.values()) layout(inst);
  };

  const mo = new MutationObserver(() => scan());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", onWindowChange);
  // Visual viewport / panel drags move hosts without window resize.
  window.addEventListener("scroll", onWindowChange, true);

  return () => {
    mo.disconnect();
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("resize", onWindowChange);
    window.removeEventListener("scroll", onWindowChange, true);
    for (const host of [...instances.keys()]) destroy(host);
    layer.remove();
  };
}
