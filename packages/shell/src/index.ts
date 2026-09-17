export {
  detectPlatform,
  initPlatform,
  usesNativeWindowControls,
  type Platform,
} from "./platform.ts";

export { isTauri } from "./env.ts";

export {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
  onWindowMaximizedChange,
  onWindowFullscreenChange,
  FULLSCREEN_CHANGE_EVENT,
  initFullscreenChrome,
  supportsWindowChrome,
  type InitFullscreenChromeOptions,
} from "./window-chrome.ts";

export {
  DEFAULT_EDITABLE_SELECTOR,
  isEditableChromeTarget,
  installChromeGuards,
  type ChromeGuardsOptions,
} from "./chrome-guards.ts";

export {
  SCROLLBAR_CLASS,
  SCROLLBAR_LAYER_Z_INDEX,
  FLOATING_MENU_MIN_Z_INDEX,
  SCROLLBAR_SELECTOR,
  getHoverGutterSize,
  isScrollableY,
  isScrollableX,
  isScrollbarHostVisible,
  isPointerInScrollbarGutter,
  applyScrollbar,
  requestOverlayScrollbarRefresh,
  initAutoHideScrollbars,
} from "./scrollbars.ts";

export {
  bootShellChrome,
  type BootShellChromeOptions,
} from "./boot.ts";
