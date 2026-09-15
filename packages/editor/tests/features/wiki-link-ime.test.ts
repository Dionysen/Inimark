import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { createEditor } from "../../src/lib.ts";
import {
  setWikiLinkBridge,
  type WikiLinkBridge,
} from "../../src/wiki-link-bridge.ts";

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

function mockBridge(): WikiLinkBridge {
  return {
    resolveNote: (noteName) => noteName,
    resolveImage: () => null,
    searchNotes: () => [],
    openNote: () => {},
  };
}

/** Flush the post-compositionend syntax-chrome refresh microtask. */
function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

describe("wiki-link IME chrome", () => {
  test("composition after a wikilink does not collapse source mid-IME", async () => {
    const host = createHost();
    setWikiLinkBridge(mockBridge());
    const editor = createEditor(host, { initialContent: "See [[Alpha]]" });

    try {
      const end = editor.view.state.doc.content.size - 1;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, end)),
      );

      // Caret sits on the wikilink's spanTo → source chrome, no widget yet.
      expect(host.querySelector(".wiki-link-widget")).toBeNull();
      expect(editor.view.state.doc.textContent).toContain("[[Alpha]]");

      editor.view.dom.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );

      // Simulate IME drafting a full-width period right after `]]`:
      // non-empty selection (composition range) + doc change.
      const from = editor.view.state.selection.from;
      let tr = editor.view.state.tr.insertText("。", from);
      tr = tr.setSelection(TextSelection.create(tr.doc, from, from + 1));
      editor.view.dispatch(tr);

      // Without the freeze, chrome would treat the non-empty selection as
      // "cursor outside" and mount the widget over font-size:0 source —
      // the caret then jumps into the wikilink. Source must stay open.
      expect(host.querySelector(".wiki-link-widget")).toBeNull();
      expect(editor.view.state.doc.textContent).toBe("See [[Alpha]]。");

      editor.view.dom.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "。" }),
      );
      // Leave the composition range in place — settleAfterIme must collapse it.
      await flushMicrotasks();

      // After composition settles: widget appears, caret after `。` (not selected).
      expect(host.querySelector(".wiki-link-widget")).not.toBeNull();
      expect(editor.view.state.doc.textContent).toBe("See [[Alpha]]。");
      expect(editor.view.state.selection.empty).toBe(true);
      expect(editor.view.state.selection.from).toBe(from + 1);
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("ASCII punctuation after a wikilink still collapses to the widget", () => {
    const host = createHost();
    setWikiLinkBridge(mockBridge());
    const editor = createEditor(host, { initialContent: "See [[Alpha]]" });

    try {
      const end = editor.view.state.doc.content.size - 1;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, end)),
      );
      expect(host.querySelector(".wiki-link-widget")).toBeNull();

      editor.view.dispatch(editor.view.state.tr.insertText("."));

      expect(host.querySelector(".wiki-link-widget")).not.toBeNull();
      expect(editor.view.state.doc.textContent).toBe("See [[Alpha]].");
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });
});
