/** Desktop injects overlay scrollbar rescan after dynamic popups mount. */

let refresh: (() => void) | null = null;

export function setOverlayScrollbarBridge(fn: (() => void) | null): void {
  refresh = fn;
}

export function notifyOverlayScrollbarRefresh(): void {
  refresh?.();
}
