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

/** Fired on `document` when macOS fullscreen chrome inset should refresh. */
export const FULLSCREEN_CHANGE_EVENT = "inimark:fullscreenchange";

/**
 * Track native fullscreen and toggle `is-fullscreen` on `<html>`.
 * macOS hides traffic lights in fullscreen — CSS zeroes the inset via this class.
 */
export function initFullscreenChrome(): () => void {
  if (typeof document === "undefined") return () => {};
  if (!usesNativeWindowControls()) return () => {};

  let unlisten: (() => void) | null = null;
  let cancelled = false;

  function apply(fullscreen: boolean): void {
    document.documentElement.classList.toggle("is-fullscreen", fullscreen);
    document.dispatchEvent(
      new CustomEvent(FULLSCREEN_CHANGE_EVENT, { detail: { fullscreen } }),
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
