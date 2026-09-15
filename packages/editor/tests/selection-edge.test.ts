import { describe, expect, test } from "vitest";
import { EditorView } from "prosemirror-view";

import {
  clampSelectionPointer,
  isOutsideSelectionSurface,
} from "../src/selection-edge.ts";
import { setup } from "./utils.ts";

function stubSurface(view: EditorView, rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): void {
  view.dom.getBoundingClientRect = () =>
    ({
      ...rect,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return this;
      },
    }) as DOMRect;
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
});
