/**
 * Keep the OS IME candidate window aligned with the caret in embedded
 * WebViews (WebView2 / WKWebView).
 *
 * WebView2 caches absolute screen coordinates for TSF. Scrolling while a
 * composition is active, or moving/resizing the host window via a custom
 * titlebar (without a real click into the page), leaves the candidate popup
 * at a stale corner until the window loses and regains focus — refresh or
 * re-anchor caret geometry on those moves.
 */

export type ImePositionGuardOptions = {
  /** Root that receives composition events (often `document.documentElement`). */
  root: HTMLElement;
  /** Scroll container to watch; defaults to `root`. May be a getter when dynamic. */
  scrollRoot?: HTMLElement | (() => HTMLElement);
  /** Active editable surface, when the guard should target a specific editor. */
  getActiveEditable?: () => HTMLElement | null;
  /**
   * Subscribe to host geometry changes that do not surface as a DOM `resize`
   * (e.g. Tauri `onMoved` after dragging a custom titlebar). Return unsubscribe.
   */
  subscribeHostGeometryChange?: (onChange: () => void) => () => void;
  /** Debounce for host geometry re-anchor (ms). Default 120. */
  hostGeometryDebounceMs?: number;
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

/**
 * Force WebView2 / TSF to drop a stale IME screen-coordinate cache after the
 * host window moved or resized. Mirrors Alt+Tab: blur then refocus the
 * focused editable so the next composition reads fresh caret bounds.
 * No-op while composing (would cancel the session) — callers should refresh
 * instead.
 */
export function reanchorImeHostGeometry(editable: HTMLElement): void {
  if (!editable.isConnected) return;
  if (composingDepth > 0) {
    refreshImeCaretPosition(editable);
    return;
  }
  if (document.activeElement !== editable) return;

  const isTextField =
    editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement;

  let selectionStart = 0;
  let selectionEnd = 0;
  let range: Range | null = null;
  if (isTextField) {
    selectionStart = editable.selectionStart ?? 0;
    selectionEnd = editable.selectionEnd ?? 0;
  } else {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editable.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0).cloneRange();
    }
  }

  editable.blur();
  requestAnimationFrame(() => {
    if (!editable.isConnected) return;
    editable.focus({ preventScroll: true });
    if (isTextField) {
      try {
        editable.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // Some input types reject setSelectionRange.
      }
    } else if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      try {
        sel?.addRange(range);
      } catch {
        // Range may be invalid after DOM mutations during the blur frame.
      }
    }
    refreshImeCaretPosition(editable);
  });
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
  let geometryTimer: ReturnType<typeof setTimeout> | null = null;
  const geometryDebounceMs = options.hostGeometryDebounceMs ?? 120;

  const scheduleRefresh = () => {
    if (!isImeComposing()) return;
    cancelAnimationFrame(refreshRaf);
    refreshRaf = requestAnimationFrame(() => {
      const editable = resolveEditable(root, getActiveEditable);
      if (editable) refreshImeCaretPosition(editable);
    });
  };

  /** After host move/resize settles: refresh mid-composition, else re-anchor. */
  const flushHostGeometry = () => {
    const editable = resolveEditable(root, getActiveEditable);
    if (!editable) return;
    if (isImeComposing()) {
      refreshImeCaretPosition(editable);
      return;
    }
    reanchorImeHostGeometry(editable);
  };

  const scheduleHostGeometrySync = () => {
    if (geometryTimer != null) clearTimeout(geometryTimer);
    geometryTimer = setTimeout(() => {
      geometryTimer = null;
      flushHostGeometry();
    }, geometryDebounceMs);
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
  // DOM resize covers size changes; host move needs subscribeHostGeometryChange.
  window.addEventListener("resize", scheduleHostGeometrySync, { passive: true });
  window.addEventListener("focus", scheduleRefresh);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") scheduleRefresh();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const unsubscribeHostGeometry = options.subscribeHostGeometryChange?.(
    scheduleHostGeometrySync,
  );

  return () => {
    cancelAnimationFrame(refreshRaf);
    if (geometryTimer != null) clearTimeout(geometryTimer);
    root.removeEventListener("compositionstart", onCompositionStart, true);
    root.removeEventListener("compositionupdate", onCompositionUpdate, true);
    root.removeEventListener("compositionend", onCompositionEnd, true);
    scrollRoot.removeEventListener("scroll", onScroll, scrollOptions);
    window.removeEventListener("scroll", onScroll, scrollOptions);
    window.removeEventListener("resize", scheduleHostGeometrySync);
    window.removeEventListener("focus", scheduleRefresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    unsubscribeHostGeometry?.();
  };
}
