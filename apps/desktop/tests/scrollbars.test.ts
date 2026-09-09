import { describe, expect, test, vi } from "vitest";

import {
  FLOATING_MENU_MIN_Z_INDEX,
  initAutoHideScrollbars,
  isPointerInScrollbarGutter,
  SCROLLBAR_CLASS,
  SCROLLBAR_LAYER_Z_INDEX,
} from "../src/platform/scrollbars.ts";
import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../src/ui/exclusive-layer.ts";

function mockScrollMetrics(
  host: HTMLElement,
  metrics: {
    scrollHeight: number;
    clientHeight: number;
    scrollWidth?: number;
    clientWidth?: number;
    rect?: Partial<DOMRect>;
  },
) {
  Object.defineProperty(host, "scrollHeight", {
    value: metrics.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(host, "clientHeight", {
    value: metrics.clientHeight,
    configurable: true,
  });
  Object.defineProperty(host, "scrollWidth", {
    value: metrics.scrollWidth ?? metrics.clientWidth ?? 100,
    configurable: true,
  });
  Object.defineProperty(host, "clientWidth", {
    value: metrics.clientWidth ?? 100,
    configurable: true,
  });
  host.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 10,
      right: 110,
      bottom: 110,
      width: 100,
      height: 100,
      x: 10,
      y: 10,
      toJSON: () => ({}),
      ...metrics.rect,
    }) as DOMRect;
}

describe("custom overlay scrollbars", () => {
  test("attaches rails for marked scroll roots and flashes on scroll", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.className = SCROLLBAR_CLASS;
    host.style.height = "40px";
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 400, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    const rail = document.querySelector(".inimark-scrollbar-rail--y");
    expect(rail).not.toBeNull();

    host.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(rail?.classList.contains("is-visible")).toBe(true);

    vi.advanceTimersByTime(700);
    expect(rail?.classList.contains("is-visible")).toBe(false);

    teardown();
    host.remove();
    vi.useRealTimers();
  });

  test("ignores unmarked overflow roots", () => {
    const host = document.createElement("div");
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 400, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    expect(document.querySelector(".inimark-scrollbar-rail--y")).toBeNull();

    teardown();
    host.remove();
  });

  test("detects pointer in vertical scrollbar gutter only", () => {
    const host = document.createElement("div");
    mockScrollMetrics(host, { scrollHeight: 200, clientHeight: 100 });
    host.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(isPointerInScrollbarGutter(host, 95, 50, 8)).toBe(true);
    expect(isPointerInScrollbarGutter(host, 80, 50, 8)).toBe(false);
  });

  test("flashes on wheel before scroll event", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.className = SCROLLBAR_CLASS;
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 400, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    const rail = document.querySelector(".inimark-scrollbar-rail--y");

    host.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true }));
    expect(rail?.classList.contains("is-visible")).toBe(true);
    expect(rail?.classList.contains("is-scrolling")).toBe(true);

    vi.advanceTimersByTime(700);
    expect(rail?.classList.contains("is-visible")).toBe(false);
    expect(rail?.classList.contains("is-scrolling")).toBe(false);

    teardown();
    host.remove();
    vi.useRealTimers();
  });

  test("shows rail when pointer enters the gutter", () => {
    const host = document.createElement("div");
    host.className = SCROLLBAR_CLASS;
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 300, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    const rail = document.querySelector(".inimark-scrollbar-rail--y");

    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 105, clientY: 50, bubbles: true }),
    );
    expect(rail?.classList.contains("is-visible")).toBe(true);
    expect(rail?.classList.contains("is-interactive")).toBe(true);

    document.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 50, clientY: 50, bubbles: true }),
    );
    expect(rail?.classList.contains("is-visible")).toBe(false);

    teardown();
    host.remove();
  });

  test("keeps overlay layer below floating menus for normal scroll hosts", () => {
    const host = document.createElement("div");
    host.className = SCROLLBAR_CLASS;
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 400, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    const layer = document.getElementById("inimark-scrollbar-layer");
    const layerZ = Number.parseInt(layer?.style.zIndex || String(SCROLLBAR_LAYER_Z_INDEX), 10);

    expect(layerZ).toBeLessThan(FLOATING_MENU_MIN_Z_INDEX);

    teardown();
    host.remove();
  });

  test("hides overlay scrollbars while an exclusive floating layer is open", () => {
    vi.useFakeTimers();
    const layerId = Symbol("test-menu");
    const host = document.createElement("div");
    host.className = SCROLLBAR_CLASS;
    host.style.overflow = "auto";
    document.body.append(host);
    mockScrollMetrics(host, { scrollHeight: 400, clientHeight: 100 });

    const teardown = initAutoHideScrollbars();
    const layer = document.getElementById("inimark-scrollbar-layer");
    const rail = document.querySelector(".inimark-scrollbar-rail--y");

    host.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(rail?.classList.contains("is-visible")).toBe(true);
    expect(layer?.classList.contains("is-suppressed")).toBe(false);

    acquireExclusiveLayer(layerId, () => releaseExclusiveLayer(layerId));
    expect(layer?.classList.contains("is-suppressed")).toBe(true);
    expect(rail?.classList.contains("is-visible")).toBe(false);

    releaseExclusiveLayer(layerId);
    expect(layer?.classList.contains("is-suppressed")).toBe(false);

    host.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(rail?.classList.contains("is-visible")).toBe(true);

    teardown();
    host.remove();
    vi.useRealTimers();
  });
});
