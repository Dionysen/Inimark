import { describe, expect, test, vi } from "vitest";

import {
  initAutoHideScrollbars,
  isPointerInScrollbarGutter,
} from "../src/platform/scrollbars.ts";

describe("auto-hide scrollbars", () => {
  test("sets data-scrolling on scroll target and clears after idle", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.style.height = "40px";
    host.style.overflow = "auto";
    document.body.append(host);

    const teardown = initAutoHideScrollbars();
    host.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(host.getAttribute("data-scrolling")).toBe("");

    vi.advanceTimersByTime(400);
    expect(host.hasAttribute("data-scrolling")).toBe(false);

    teardown();
    host.remove();
    vi.useRealTimers();
  });

  test("detects pointer in vertical scrollbar gutter only", () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "scrollHeight", { value: 200, configurable: true });
    Object.defineProperty(host, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(host, "scrollWidth", { value: 100, configurable: true });
    Object.defineProperty(host, "clientWidth", { value: 100, configurable: true });
    host.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      }) as DOMRect;

    expect(isPointerInScrollbarGutter(host, 95, 50, 8)).toBe(true);
    expect(isPointerInScrollbarGutter(host, 80, 50, 8)).toBe(false);
  });

  test("sets data-scrollbar-hover when pointer moves into gutter", () => {
    const host = document.createElement("div");
    host.className = "inimark-tree";
    host.style.height = "100px";
    host.style.overflow = "auto";
    document.body.append(host);

    Object.defineProperty(host, "scrollHeight", { value: 300, configurable: true });
    host.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 10,
        right: 110,
        bottom: 110,
        width: 100,
        height: 100,
      }) as DOMRect;

    const teardown = initAutoHideScrollbars();
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 105, clientY: 50, bubbles: true }),
    );
    expect(host.getAttribute("data-scrollbar-hover")).toBe("");

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 50, clientY: 50, bubbles: true }),
    );
    expect(host.hasAttribute("data-scrollbar-hover")).toBe(false);

    teardown();
    host.remove();
  });
});
