import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { createEditor } from "../../src/lib.ts";

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

/** Flush the post-mouseup syntax-chrome refresh microtask. */
function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

function strongDelimClasses(host: HTMLElement): string[] {
  const classes: string[] = [];
  for (const el of host.querySelectorAll(".syntax-hint, .syntax-hidden")) {
    const text = el.textContent ?? "";
    if (text.includes("*")) {
      classes.push(el.className);
    }
  }
  return classes;
}

describe("syntax chrome during drag-select", () => {
  test("pointer drag does not collapse visible ** delimiters mid-selection", async () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent:
        "- **栏杆创建**：栏杆创建时，栏杆扶手、立柱等子构件类型均为BICU_GAP_RAILING",
    });

    try {
      const view = editor.view;
      // Caret inside the strong span so opening/closing ** render as hints.
      let strongTextFrom: number | null = null;
      let strongTextTo: number | null = null;
      view.state.doc.descendants((node, pos) => {
        if (strongTextFrom != null) return false;
        if (!node.isText || !node.text) return;
        if (node.marks.some((m) => m.type.name === "strong") && node.text.includes("栏杆")) {
          strongTextFrom = pos;
          strongTextTo = pos + node.nodeSize;
        }
      });
      expect(strongTextFrom).not.toBeNull();
      expect(strongTextTo).not.toBeNull();
      const insidePos = strongTextFrom! + 1;
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, insidePos)),
      );

      expect(strongDelimClasses(host).some((c) => c.includes("syntax-hint"))).toBe(true);
      expect(strongDelimClasses(host).every((c) => !c.includes("syntax-hidden"))).toBe(
        true,
      );

      view.dom.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          isPrimary: true,
          pointerId: 1,
          clientX: 40,
          clientY: 20,
        }),
      );

      // Simulate the first non-empty selection of a leftward drag. Without the
      // freeze, chrome would treat this as "cursor outside" and collapse **
      // to font-size:0 mid-drag — Chromium then remaps the selection to the
      // line start. Keep both endpoints inside the strong text node.
      const from = strongTextFrom!;
      const to = Math.min(strongTextTo!, insidePos + 2);
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
      );

      expect(view.state.selection.empty).toBe(false);
      expect(strongDelimClasses(host).some((c) => c.includes("syntax-hint"))).toBe(true);
      expect(strongDelimClasses(host).some((c) => c.includes("syntax-hidden"))).toBe(
        false,
      );

      document.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          isPrimary: true,
          pointerId: 1,
        }),
      );
      await flushMicrotasks();

      // After release, non-empty selection → delims collapse to hidden.
      expect(strongDelimClasses(host).some((c) => c.includes("syntax-hidden"))).toBe(
        true,
      );
      // Settled PM selection must not jump to the block/list start.
      expect(view.state.selection.from).toBe(from);
      expect(view.state.selection.to).toBe(to);
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
