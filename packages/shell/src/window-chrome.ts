import { isTauri } from "./env.ts";
import { usesNativeWindowControls } from "./platform.ts";
export { usesNativeWindowControls } from "./platform.ts";

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  if (await win.isMaximized()) await win.unmaximize();
  else await win.maximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  if (win.label === "main") {
    await win.destroy();
    return;
  }
  await win.close();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauri()) return false;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isMaximized();
}

export async function onWindowMaximizedChange(
  handler: (maximized: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const unlisten = await win.onResized(async () => {
    handler(await win.isMaximized());
  });
  handler(await win.isMaximized());
  return unlisten;
}

export async function onWindowFullscreenChange(
  handler: (fullscreen: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const unlisten = await win.onResized(async () => {
    handler(await win.isFullscreen());
  });
  handler(await win.isFullscreen());
  return unlisten;
}

/** Default event name for fullscreen chrome inset refresh. Apps may alias. */
export const FULLSCREEN_CHANGE_EVENT = "dionysen:fullscreenchange";

export interface InitFullscreenChromeOptions {
  /** CustomEvent name dispatched on `document`. Default: {@link FULLSCREEN_CHANGE_EVENT}. */
  eventName?: string;
}

/**
 * Track native fullscreen and toggle `is-fullscreen` on `<html>`.
 * macOS hides traffic lights in fullscreen — CSS zeroes the inset via this class.
 */
export function initFullscreenChrome(
  options: InitFullscreenChromeOptions = {},
): () => void {
  if (typeof document === "undefined") return () => {};
  if (!usesNativeWindowControls()) return () => {};

  const eventName = options.eventName ?? FULLSCREEN_CHANGE_EVENT;
  let unlisten: (() => void) | null = null;
  let cancelled = false;

  function apply(fullscreen: boolean): void {
    document.documentElement.classList.toggle("is-fullscreen", fullscreen);
    document.dispatchEvent(
      new CustomEvent(eventName, { detail: { fullscreen } }),
    );
  }

  void onWindowFullscreenChange(apply).then((fn) => {
    if (cancelled) {
      fn();
      return;
    }
    unlisten = fn;
  });

  return () => {
    cancelled = true;
    unlisten?.();
    document.documentElement.classList.remove("is-fullscreen");
  };
}

export function supportsWindowChrome(): boolean {
  return isTauri();
}
