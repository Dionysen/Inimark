export type Platform = "macos" | "windows" | "linux";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  if (/Mac|iPhone|iPod|iPad/i.test(platform) || ua.includes("Mac OS")) {
    return "macos";
  }
  if (/Win/i.test(platform) || ua.includes("Windows")) {
    return "windows";
  }
  return "linux";
}

/** Apply `platform-*` class on `<html>` for shell chrome CSS. Call once per window entry. */
export function initPlatform(): Platform {
  const platform = detectPlatform();
  const root = document.documentElement;
  root.classList.remove("platform-macos", "platform-windows", "platform-linux");
  root.classList.add(`platform-${platform}`);
  return platform;
}

/** macOS uses system traffic lights; custom caption buttons are hidden in CSS. */
export function usesNativeWindowControls(): boolean {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (root?.classList.contains("platform-macos")) return true;
  if (
    root?.classList.contains("platform-windows") ||
    root?.classList.contains("platform-linux")
  ) {
    return false;
  }
  return detectPlatform() === "macos";
}
