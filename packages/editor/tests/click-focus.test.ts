import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { focusEditorAtPoint, focusPosFromClick, handleEditorSurfaceMouseDown, needsClickRedirect } from "../src/click-focus.ts";
import { createEditor } from "../src/lib.ts";
import { setup } from "./utils.ts";

/** happy-dom often returns zero-size rects; stub vertical geometry for Y-nearest tests. */
function stubVerticalLayout(view: EditorView, lineHeight = 36): void {
  const doc = view.state.doc;
  const ranges: Array<{ from: number; to: number; top: number; bottom: number }> = [];
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const top = 20 + i * lineHeight;
    ranges.push({
      from: pos + 1,
      to: pos + node.nodeSize - 1,
      top,
      bottom: top + lineHeight - 8,
    });
    pos += node.nodeSize;
  }

  view.coordsAtPos = ((p: number) => {
    const range =
      ranges.find((r) => p >= r.from && p <= r.to) ??
      ranges.find((r) => p >= r.from - 1 && p <= r.to + 1) ??
      ranges[ranges.length - 1]!;
    return {
      top: range.top,
      bottom: range.bottom,
      left: 100,
      right: 520,
    };
  }) as EditorView["coordsAtPos"];

  view.posAtCoords = ((coords: { left: number; top: number }) => {
    const range =
      ranges.find((r) => coords.top >= r.top && coords.top <= r.bottom) ?? null;
    if (!range) return null;
    const atEnd = coords.left >= 300;
    return { pos: atEnd ? range.to : range.from, inside: range.from };
  }) as EditorView["posAtCoords"];

  view.dom.getBoundingClientRect = () =>
    ({
      top: 20,
      bottom: 20 + ranges.length * lineHeight,
      left: 100,
      right: 520,
      width: 420,
      height: ranges.length * lineHeight,
      x: 100,
      y: 20,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

function click(view: EditorView, clientX: number, clientY: number): void {
  view.dom.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
    }),
  );
}

describe("click focus", () => {
  test("click below empty document content focuses the last paragraph", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "" });

    try {
      const rect = host.getBoundingClientRect();
      host.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 40,
          clientY: rect.bottom - 20,
          button: 0,
        }),
      );
      expect(editor.view.hasFocus()).toBe(true);
      expect(editor.view.state.selection.empty).toBe(true);
      expect(editor.view.state.doc.lastChild?.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("click on host padding outside ProseMirror still focuses the editor", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    host.style.padding = "24px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "" });

    try {
      expect(handleEditorSurfaceMouseDown(editor.view, {
        button: 0,
        target: host,
        clientX: host.getBoundingClientRect().left + 8,
        clientY: host.getBoundingClientRect().bottom - 8,
        preventDefault() {},
      } as unknown as MouseEvent, host)).toBe(true);
      expect(editor.view.hasFocus()).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("click on code block padding focuses the nearest prose block", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });

    try {
      const block = host.querySelector(".code-block-node") as HTMLElement;
      expect(block).not.toBeNull();
      const rect = block.getBoundingClientRect();
      block.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 12,
          clientY: rect.top + 4,
          button: 0,
        }),
      );
      const pos = editor.view.state.selection.from;
      const $pos = editor.view.state.doc.resolve(pos);
      expect($pos.parent.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("focusPosFromClick maps gaps between blocks to a nearby caret", () => {
    const state = setup("one\n\ntwo");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      const first = view.dom.children[0]!.getBoundingClientRect();
      const second = view.dom.children[1]!.getBoundingClientRect();
      const gapY = (first.bottom + second.top) / 2;
      const pos = focusPosFromClick(view, first.left + 8, gapY);
      expect(pos).not.toBeNull();
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos!)));
      expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("focusEditorAtPoint returns false for non-editable views", () => {
    const state = setup("hello");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state, editable: () => false });

    try {
      const rect = view.dom.getBoundingClientRect();
      expect(focusEditorAtPoint(view, rect.left + 8, rect.bottom - 8)).toBe(false);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("needsClickRedirect is true when clicking below the last block", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const last = view.dom.lastElementChild as HTMLElement;
      expect(last?.tagName).toBe("P");
      expect(needsClickRedirect(view, 120, 20 + 3 * 36, last)).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("focusPosFromClick below the last block maps to the end of content", () => {
    const state = setup("alpha\n\nbeta");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      stubVerticalLayout(view, 36);
      // "alpha" / "beta" → last block index 1 ends near y=76; probe below it.
      const belowY = 20 + 2 * 36 + 10;
      const caretPos = focusPosFromClick(view, 120, belowY);
      expect(caretPos).not.toBeNull();
      expect(caretPos).toBe(TextSelection.atEnd(view.state.doc).from);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("click beside content width maps caret to the same-Y text line", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "first line of the note\n\nsecond line of the note\n\nthird line of the note",
    });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      // Mid of first paragraph (index 0 → top 20, bottom 48 → mid 34).
      const clientY = 34;
      const clientX = 640; // to the right of stubbed content (right=520)
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
      });
      Object.defineProperty(down, "target", { value: host });

      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      const $pos = view.state.doc.resolve(view.state.selection.from);
      expect($pos.parent.type.name).toBe("paragraph");
      expect($pos.parent.textContent).toContain("first line");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("focusPosFromClick with host target beside mid content stays on that line", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "alpha paragraph here\n\nbeta paragraph here",
    });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const pos = focusPosFromClick(view, 640, 34, host);
      expect(pos).not.toBeNull();
      const $pos = view.state.doc.resolve(pos!);
      expect($pos.parent.textContent).toContain("alpha");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("ctrl+click places a caret instead of selecting the whole paragraph", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "Callout, Mermaid, math formulas, and other rich elements render correctly after publishing.",
    });

    try {
      const view = editor.view;
      const paragraph = view.dom.querySelector("p");
      expect(paragraph).not.toBeNull();
      const mid = Math.floor(view.state.doc.textContent.length / 2) + 1;
      const coords = view.coordsAtPos(mid);
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: coords.left + 2,
        clientY: coords.top + 2,
        button: 0,
        ctrlKey: true,
      });
      Object.defineProperty(down, "target", { value: paragraph });

      const textLen = view.state.doc.firstChild!.content.size;
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, 1, 1 + textLen),
        ),
      );
      expect(view.state.selection.empty).toBe(false);

      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      expect(view.state.selection.empty).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("redirected mousedown from host padding starts nearest-pos drag tracking", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      const hostRect = host.getBoundingClientRect();
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: hostRect.left + 40,
        clientY: hostRect.bottom - 12,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });

      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      expect(view.hasFocus()).toBe(true);
      expect(view.state.selection.empty).toBe(true);

      // End the drag session started by focusEditorAtPoint.
      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: hostRect.left + 40,
          clientY: hostRect.bottom - 12,
          button: 0,
          buttons: 0,
        }),
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("drag-select continues when the pointer leaves the window", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "first line of the note\n\nsecond line of the note\n\nthird line of the note",
    });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const surfaceBottom = 20 + 3 * 36;
      host.getBoundingClientRect = () =>
        ({
          top: 20,
          bottom: surfaceBottom,
          left: 100,
          right: 520,
          width: 420,
          height: surfaceBottom - 20,
          x: 100,
          y: 20,
          toJSON() {
            return this;
          },
        }) as DOMRect;

      // Anchor in the first paragraph (mid Y = 34).
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 34,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });
      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      const anchor = view.state.selection.anchor;
      expect(view.state.selection.empty).toBe(true);

      // Drag below the OS window — clamp to the bottom edge and extend the selection.
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: 5000,
          buttons: 1,
        }),
      );

      expect(view.state.selection.empty).toBe(false);
      expect(view.state.selection.anchor).toBe(anchor);
      expect(view.state.selection.head).not.toBe(anchor);
      expect(Math.abs(view.state.selection.head - anchor)).toBeGreaterThan(10);

      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: 5000,
          button: 0,
          buttons: 0,
        }),
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("drag-select from below the last block anchors at content end", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const belowY = 20 + 2 * 36 + 10;
      const contentY = 20 + 1 * 36 + 10; // mid of "beta"
      const end = TextSelection.atEnd(view.state.doc).from;

      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: belowY,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });
      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      expect(view.state.selection.from).toBe(end);
      expect(view.state.selection.empty).toBe(true);

      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: contentY,
          button: 0,
          buttons: 1,
        }),
      );

      const { from, to, empty } = view.state.selection;
      expect(empty).toBe(false);
      expect(Math.max(from, to)).toBe(end);

      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: contentY,
          button: 0,
          buttons: 0,
        }),
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("click without drag below the last block keeps the caret at content end", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const belowY = 20 + 2 * 36 + 10;
      const end = TextSelection.atEnd(view.state.doc).from;

      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: belowY,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });
      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      expect(view.state.selection.from).toBe(end);

      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: belowY,
          button: 0,
          buttons: 0,
        }),
      );
      expect(view.state.selection.from).toBe(end);
      expect(view.state.selection.empty).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("drag-select from below content then outside the window stays live", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      stubVerticalLayout(view, 36);
      const surfaceBottom = 20 + 3 * 36;
      host.getBoundingClientRect = () =>
        ({
          top: 20,
          bottom: surfaceBottom,
          left: 100,
          right: 520,
          width: 420,
          height: surfaceBottom - 20,
          x: 100,
          y: 20,
          toJSON() {
            return this;
          },
        }) as DOMRect;

      const belowY = 20 + 2 * 36 + 10;
      const contentY = 20 + 1 * 36 + 10;
      const end = TextSelection.atEnd(view.state.doc).from;

      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: belowY,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });
      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);

      // Platforms often report buttons=0 once the pointer leaves the window.
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: -40,
          button: 0,
          buttons: 0,
        }),
      );

      expect(view.state.selection.empty).toBe(false);
      expect(Math.max(view.state.selection.from, view.state.selection.to)).toBe(end);

      // Still dragging: move back over content — must keep updating.
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: contentY,
          button: 0,
          buttons: 0,
        }),
      );
      expect(view.state.selection.empty).toBe(false);
      expect(Math.max(view.state.selection.from, view.state.selection.to)).toBe(end);

      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: contentY,
          button: 0,
          buttons: 0,
        }),
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
