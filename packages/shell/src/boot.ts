import { installChromeGuards, type ChromeGuardsOptions } from "./chrome-guards.ts";
import { initAutoHideScrollbars } from "./scrollbars.ts";
import {
  initFullscreenChrome,
  type InitFullscreenChromeOptions,
} from "./window-chrome.ts";

export interface BootShellChromeOptions
  extends ChromeGuardsOptions,
    InitFullscreenChromeOptions {
  /** Document for chrome guards. Default: `document`. */
  doc?: Document;
}

/**
 * Install shared shell chrome: selection/context guards, overlay scrollbars,
 * and macOS fullscreen inset tracking. Returns a single teardown.
 *
 * Product-specific IME / theme / i18n stay in the app.
 */
export function bootShellChrome(
  options: BootShellChromeOptions = {},
): () => void {
  const { doc = document, editableSelector, eventName } = options;
  const teardownGuards = installChromeGuards(doc, { editableSelector });
  const teardownFullscreen = initFullscreenChrome({ eventName });
  const teardownScrollbars = initAutoHideScrollbars();
  return () => {
    teardownGuards();
    teardownFullscreen();
    teardownScrollbars();
  };
}
