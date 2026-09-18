export {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
  onWindowMaximizedChange,
  onWindowMoved,
  onWindowFullscreenChange,
  supportsWindowChrome,
  usesNativeWindowControls,
  type InitFullscreenChromeOptions,
} from "@dionysen/shell";

import { initFullscreenChrome as initShellFullscreenChrome } from "@dionysen/shell";

/** Inimark alias — shell default is `dionysen:fullscreenchange`. */
export const FULLSCREEN_CHANGE_EVENT = "inimark:fullscreenchange";

/**
 * Track native fullscreen with Inimark's historical event name so existing
 * listeners (sidebar / right-sidebar) keep working.
 */
export function initFullscreenChrome(): () => void {
  return initShellFullscreenChrome({ eventName: FULLSCREEN_CHANGE_EVENT });
}
