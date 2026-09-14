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

/**
 * True on phone/tablet WebViews (Tauri Android / iOS).
 * Used to scope mobile-only chrome (safe-area) without changing desktop layout.
 */
export function isMobileShell(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ may report as MacIntel with touch.
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Apply `platform-*` class on `<html>` for shell chrome CSS. Call once per window entry. */
export function initPlatform(): Platform {
  const platform = detectPlatform();
  const root = document.documentElement;
  root.classList.remove("platform-macos", "platform-windows", "platform-linux");
  root.classList.add(`platform-${platform}`);
  root.classList.toggle("platform-mobile", isMobileShell());
  return platform;
}

/** macOS uses system traffic lights; custom caption buttons are hidden in CSS. */
export function usesNativeWindowControls(): boolean {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  // Mobile has no desktop traffic lights / caption buttons.
  if (root?.classList.contains("platform-mobile") || isMobileShell()) return false;
  if (root?.classList.contains("platform-macos")) return true;
  if (
    root?.classList.contains("platform-windows") ||
    root?.classList.contains("platform-linux")
  ) {
    return false;
  }
  return detectPlatform() === "macos";
}
