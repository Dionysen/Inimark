/**
 * Keep the OS IME candidate window aligned with the caret in embedded
 * WebViews (WebView2 / WKWebView). Scrolling or layout shifts while a
 * composition is active can leave the candidate popup at (0, 0) until the
 * window loses and regains focus — refresh caret geometry on those moves.
 */

export type ImePositionGuardOptions = {
  /** Root that receives composition events (often `document.documentElement`). */
  root: HTMLElement;
  /** Scroll container to watch; defaults to `root`. May be a getter when dynamic. */
  scrollRoot?: HTMLElement | (() => HTMLElement);
  /** Active editable surface, when the guard should target a specific editor. */
  getActiveEditable?: () => HTMLElement | null;
};

let composingDepth = 0;
let lastCompositionData = "";

/** True while any tracked surface is in an IME composition session. */
export function isImeComposing(): boolean {
  return composingDepth > 0;
}

/** Ask the browser / IME to re-read the caret's screen coordinates. */
export function refreshImeCaretPosition(editable: HTMLElement): void {
  if (!editable.isConnected) return;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.getClientRects();
    range.getBoundingClientRect();
  }
  editable.getBoundingClientRect();

  if (composingDepth > 0 && lastCompositionData !== "") {
    editable.dispatchEvent(
      new CompositionEvent("compositionupdate", {
        bubbles: true,
        cancelable: false,
        data: lastCompositionData,
      }),
    );
  }
}

function resolveScrollRoot(
  root: HTMLElement,
  scrollRoot?: HTMLElement | (() => HTMLElement),
): HTMLElement {
  if (!scrollRoot) return root;
  return typeof scrollRoot === "function" ? scrollRoot() : scrollRoot;
}

function resolveEditable(
  root: HTMLElement,
  getActiveEditable?: () => HTMLElement | null,
): HTMLElement | null {
  const explicit = getActiveEditable?.();
  if (explicit) return explicit;
  const active = document.activeElement;
  if (active instanceof HTMLElement && root.contains(active)) return active;
  return null;
}

/** Install shared IME caret tracking for one window / editor shell. */
export function attachImePositionGuard(options: ImePositionGuardOptions): () => void {
  const { root, getActiveEditable } = options;
  let refreshRaf = 0;

  const scheduleRefresh = () => {
    if (!isImeComposing()) return;
    cancelAnimationFrame(refreshRaf);
    refreshRaf = requestAnimationFrame(() => {
      const editable = resolveEditable(root, getActiveEditable);
      if (editable) refreshImeCaretPosition(editable);
    });
  };

  const onCompositionStart = () => {
    composingDepth += 1;
  };
  const onCompositionUpdate = (event: Event) => {
    if (event instanceof CompositionEvent) lastCompositionData = event.data;
  };
  const onCompositionEnd = () => {
    composingDepth = Math.max(0, composingDepth - 1);
    if (composingDepth === 0) lastCompositionData = "";
  };

  root.addEventListener("compositionstart", onCompositionStart, true);
  root.addEventListener("compositionupdate", onCompositionUpdate, true);
  root.addEventListener("compositionend", onCompositionEnd, true);

  const scrollOptions: AddEventListenerOptions = { passive: true, capture: true };
  const onScroll = () => scheduleRefresh();
  const scrollRoot = resolveScrollRoot(root, options.scrollRoot);
  scrollRoot.addEventListener("scroll", onScroll, scrollOptions);
  window.addEventListener("scroll", onScroll, scrollOptions);
  window.addEventListener("resize", scheduleRefresh, { passive: true });
  window.addEventListener("focus", scheduleRefresh);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") scheduleRefresh();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    cancelAnimationFrame(refreshRaf);
    root.removeEventListener("compositionstart", onCompositionStart, true);
    root.removeEventListener("compositionupdate", onCompositionUpdate, true);
    root.removeEventListener("compositionend", onCompositionEnd, true);
    scrollRoot.removeEventListener("scroll", onScroll, scrollOptions);
    window.removeEventListener("scroll", onScroll, scrollOptions);
    window.removeEventListener("resize", scheduleRefresh);
    window.removeEventListener("focus", scheduleRefresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
