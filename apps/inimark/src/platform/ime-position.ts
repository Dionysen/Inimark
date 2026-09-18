import { attachImePositionGuard } from "@inimark/editor";
import { detectPlatform, isTauri, onWindowMoved } from "@dionysen/shell";

/**
 * App-wide IME caret sync for every editable surface in a desktop window.
 *
 * On Windows WebView2, dragging via the custom titlebar leaves TSF with stale
 * screen coordinates until focus cycles (Alt+Tab). Re-anchor after `onMoved`.
 */
export function initImePositionGuard(): () => void {
  const needsHostMoveSync = isTauri() && detectPlatform() === "windows";

  return attachImePositionGuard({
    root: document.documentElement,
    scrollRoot: document.documentElement,
    subscribeHostGeometryChange: needsHostMoveSync
      ? (onChange) => onWindowMoved(onChange)
      : undefined,
  });
}
