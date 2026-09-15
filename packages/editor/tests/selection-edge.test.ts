import { describe, expect, test } from "vitest";
import { EditorView } from "prosemirror-view";

import {
  autoScrollSelectionSurface,
  clampSelectionPointer,
  isOutsideSelectionSurface,
  SELECTION_AUTO_SCROLL_MARGIN,
} from "../src/selection-edge.ts";
import { setup } from "./utils.ts";

function stubSurface(view: EditorView, rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): void {
  const box = {
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return this;
    },
  } as DOMRect;
  view.dom.getBoundingClientRect = () => box;
}

describe("selection edge clamp", () => {
  test("clamps off-window pointers onto the editor surface edge", () => {
    const state = setup("hello");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      stubSurface(view, { left: 100, top: 80, right: 500, bottom: 400 });

      const above = clampSelectionPointer(view, 200, -40);
      expect(above.y).toBe(81);
      expect(above.x).toBe(200);

      const left = clampSelectionPointer(view, -20, 200);
      expect(left.x).toBe(101);
      expect(left.y).toBe(200);

      const belowRight = clampSelectionPointer(view, 9000, 9000);
      expect(belowRight.x).toBe(499);
      expect(belowRight.y).toBe(399);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("detects pointers outside the selection surface", () => {
    const state = setup("hello");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      stubSurface(view, { left: 100, top: 80, right: 500, bottom: 400 });
      expect(isOutsideSelectionSurface(view, 200, 200)).toBe(false);
      expect(isOutsideSelectionSurface(view, 50, 200)).toBe(true);
      expect(isOutsideSelectionSurface(view, 200, -10)).toBe(true);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("auto-scrolls toward document end when the pointer sits on the bottom edge", () => {
    const state = setup("hello");
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 120 });
    Object.defineProperty(host, "scrollHeight", { configurable: true, value: 800 });
    let scrollTop = 40;
    Object.defineProperty(host, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
    document.body.appendChild(host);
    const view = new EditorView(host, { state });

    try {
      host.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          right: 400,
          bottom: 120,
          width: 400,
          height: 120,
          x: 0,
          y: 0,
          toJSON() {
            return this;
          },
        }) as DOMRect;

      // Force the host itself to be the scroll container.
      const style = { overflowY: "auto" } as CSSStyleDeclaration;
      const originalGet = window.getComputedStyle;
      window.getComputedStyle = ((el: Element) =>
        el === host ? style : originalGet(el)) as typeof getComputedStyle;

      try {
        const before = host.scrollTop;
        const scrolled = autoScrollSelectionSurface(
          view,
          200,
          120 - SELECTION_AUTO_SCROLL_MARGIN / 2,
        );
        expect(scrolled).toBe(true);
        expect(host.scrollTop).toBeGreaterThan(before);

        const topBefore = host.scrollTop;
        const scrolledUp = autoScrollSelectionSurface(
          view,
          200,
          SELECTION_AUTO_SCROLL_MARGIN / 2,
        );
        expect(scrolledUp).toBe(true);
        expect(host.scrollTop).toBeLessThan(topBefore);
      } finally {
        window.getComputedStyle = originalGet;
      }
    } finally {
      view.destroy();
      host.remove();
    }
  });
});
