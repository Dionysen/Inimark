import { afterEach, describe, expect, it, vi } from "vitest";
import { isMobileShell } from "../src/platform/platform.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isMobileShell", () => {
  it("detects Android WebView UA", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    });
    expect(isMobileShell()).toBe(true);
  });

  it("detects iPhone UA", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      platform: "iPhone",
      maxTouchPoints: 5,
    });
    expect(isMobileShell()).toBe(true);
  });

  it("is false on desktop macOS", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    });
    expect(isMobileShell()).toBe(false);
  });

  it("is false on desktop Windows", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      platform: "Win32",
      maxTouchPoints: 0,
    });
    expect(isMobileShell()).toBe(false);
  });
});
