const SCROLL_HIDE_DELAY_MS = 400;

const SCROLLABLE_SELECTOR = [
  ".inimark-scroll-target",
  ".inimark-tree",
  ".inimark-editor-host",
  ".inimark-settings-main",
  ".inimark-settings-shortcuts",
  ".ProseMirror",
  ".cm-editor .cm-scroller",
].join(",");

function getScrollbarGutterSize(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--inimark-scrollbar-size")
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 8;
}

function isScrollable(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

/** True when the pointer is over the vertical/horizontal scrollbar gutter (incl. track). */
export function isPointerInScrollbarGutter(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  gutterSize = 8,
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

  const vertical = el.scrollHeight > el.clientHeight;
  const horizontal = el.scrollWidth > el.clientWidth;

  if (vertical && clientX >= rect.right - gutterSize) {
    return true;
  }

  if (horizontal && clientY >= rect.bottom - gutterSize) {
    return true;
  }

  return false;
}

/** Show scrollbars while scrolling or when the pointer is over the gutter. */
export function initAutoHideScrollbars(): () => void {
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let scrollingTarget: HTMLElement | null = null;
  let hoverTarget: HTMLElement | null = null;

  const onScroll = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (scrollingTarget && scrollingTarget !== target) {
      scrollingTarget.removeAttribute("data-scrolling");
    }

    scrollingTarget = target;
    target.setAttribute("data-scrolling", "");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (scrollingTarget) {
        scrollingTarget.removeAttribute("data-scrolling");
        scrollingTarget = null;
      }
    }, SCROLL_HIDE_DELAY_MS);
  };

  const onMouseMove = (event: MouseEvent) => {
    const gutterSize = getScrollbarGutterSize();
    let next: HTMLElement | null = null;

    for (const el of document.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR)) {
      if (!isScrollable(el)) continue;
      if (isPointerInScrollbarGutter(el, event.clientX, event.clientY, gutterSize)) {
        next = el;
        break;
      }
    }

    if (hoverTarget && hoverTarget !== next) {
      hoverTarget.removeAttribute("data-scrollbar-hover");
    }

    if (next) {
      next.setAttribute("data-scrollbar-hover", "");
      hoverTarget = next;
    } else {
      hoverTarget = null;
    }
  };

  const clearHover = () => {
    hoverTarget?.removeAttribute("data-scrollbar-hover");
    hoverTarget = null;
  };

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener("mouseleave", clearHover);

  return () => {
    clearTimeout(scrollTimer);
    document.removeEventListener("scroll", onScroll, { capture: true });
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseleave", clearHover);
    scrollingTarget?.removeAttribute("data-scrolling");
    scrollingTarget = null;
    clearHover();
  };
}
