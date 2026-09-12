import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { createEditor } from "../../src/lib.ts";
import { executeEditorCommand } from "../../src/commands.ts";
import { detectWikiLinkPartial } from "../../src/features/wiki-link.ts";
import {
  WIKI_AUTOCOMPLETE_HEADING_HEIGHT,
  WIKI_AUTOCOMPLETE_ROW_HEIGHT,
} from "../../src/features/wiki-link-autocomplete-popup.ts";
import { feedKey, feedText } from "../../specs/events.ts";
import {
  setWikiLinkBridge,
  type WikiLinkBridge,
} from "../../src/wiki-link-bridge.ts";

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

function typeText(editor: ReturnType<typeof createEditor>, text: string): void {
  feedText(editor.view, text);
}

function mockBridge(
  notes: Array<{ name: string; path: string }>,
): WikiLinkBridge {
  return {
    resolveNote: (noteName) =>
      notes.find((n) => n.name === noteName)?.path ?? null,
    resolveImage: () => null,
    searchNotes(query, limit?) {
      const q = query.trim().toLowerCase();
      const hits = notes.filter((note) => {
        if (!q) return true;
        const base = (note.name.split("/").pop() ?? note.name).toLowerCase();
        return base.includes(q) || note.name.toLowerCase().includes(q);
      });
      return limit == null ? hits : hits.slice(0, limit);
    },
    recentNotes() {
      return [];
    },
    openNote() {},
  };
}

describe("wiki-link autocomplete", () => {
  test("typing [[ auto-closes and opens the suggestion popup", () => {
    const host = createHost();
    setWikiLinkBridge(
      mockBridge([
        { name: "Daily", path: "Daily.md" },
        { name: "Projects/Plan", path: "Projects/Plan.md" },
      ]),
    );
    const editor = createEditor(host);

    try {
      typeText(editor, "[");
      typeText(editor, "[");

      expect(editor.view.state.doc.textContent).toBe("[[]]");
      expect(document.body.querySelector(".wiki-link-autocomplete")).not.toBeNull();
      expect(
        document.body.querySelectorAll(".wiki-link-autocomplete .inimark-menu-item").length,
      ).toBe(2);
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("Enter commits the selected note inside an auto-closed pair", () => {
    const host = createHost();
    setWikiLinkBridge(
      mockBridge([
        { name: "Alpha", path: "Alpha.md" },
        { name: "Beta", path: "Beta.md" },
      ]),
    );
    const editor = createEditor(host);

    try {
      typeText(editor, "[");
      typeText(editor, "[");
      feedKey(editor.view, "<Enter>");

      expect(editor.view.state.doc.textContent).toBe("[[Alpha]]");
      expect(document.body.querySelector(".wiki-link-autocomplete")).toBeNull();
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("empty query virtualizes long lists instead of rendering every row", () => {
    const host = createHost();
    const notes = Array.from({ length: 12 }, (_, i) => ({
      name: `Note${String(i).padStart(2, "0")}`,
      path: `Note${String(i).padStart(2, "0")}.md`,
    }));
    setWikiLinkBridge(mockBridge(notes));
    const editor = createEditor(host);

    try {
      typeText(editor, "[");
      typeText(editor, "[");
      const spacer = document.body.querySelector(
        ".wiki-link-autocomplete__spacer",
      ) as HTMLElement | null;
      expect(spacer?.style.height).toBe(
        `${WIKI_AUTOCOMPLETE_HEADING_HEIGHT + 12 * WIKI_AUTOCOMPLETE_ROW_HEIGHT}px`,
      );
      expect(
        document.body.querySelectorAll(
          ".wiki-link-autocomplete__window .inimark-menu-item",
        ).length,
      ).toBeLessThan(12);
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("does not open when [[...]] is inside inline code", () => {
    const host = createHost();
    setWikiLinkBridge(mockBridge([{ name: "Note", path: "Note.md" }]));
    const editor = createEditor(host);

    try {
      editor.view.dispatch(
        editor.view.state.tr.insertText("Use `[[Note]]` here"),
      );
      const cursor = 1 + editor.view.state.doc.textContent.indexOf("[[") + 2;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(
          TextSelection.create(editor.view.state.doc, cursor),
        ),
      );
      expect(detectWikiLinkPartial(editor.view.state)).toBeNull();
      expect(document.body.querySelector(".wiki-link-autocomplete")).toBeNull();
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("does not open before closing brackets exist", () => {
    const host = createHost();
    setWikiLinkBridge(mockBridge([{ name: "Note", path: "Note.md" }]));
    const editor = createEditor(host);

    try {
      editor.view.dispatch(editor.view.state.tr.insertText("[["));
      expect(detectWikiLinkPartial(editor.view.state)).toBeNull();
      expect(document.body.querySelector(".wiki-link-autocomplete")).toBeNull();
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("wiki-link command inserts [[|]] with the cursor between brackets", () => {
    const host = createHost();
    setWikiLinkBridge(mockBridge([]));
    const editor = createEditor(host);

    try {
      executeEditorCommand(editor.view, "wiki-link");
      expect(editor.view.state.doc.textContent).toBe("[[]]");
      expect(editor.view.state.selection.from).toBe(3);
      expect(document.body.querySelector(".wiki-link-autocomplete")).not.toBeNull();
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("moving the caret into an existing [[…]] does not open autocomplete", () => {
    const host = createHost();
    setWikiLinkBridge(
      mockBridge([
        { name: "Alpha", path: "Alpha.md" },
        { name: "Beta", path: "Beta.md" },
      ]),
    );
    const editor = createEditor(host);

    try {
      editor.view.dispatch(
        editor.view.state.tr.insertText("See [[Alpha]] today"),
      );
      const inside = 1 + editor.view.state.doc.textContent.indexOf("[[") + 2;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(
          TextSelection.create(editor.view.state.doc, inside),
        ),
      );

      expect(detectWikiLinkPartial(editor.view.state)).not.toBeNull();
      expect(document.body.querySelector(".wiki-link-autocomplete")).toBeNull();
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });

  test("editing inside an existing [[…]] opens autocomplete", () => {
    const host = createHost();
    setWikiLinkBridge(
      mockBridge([
        { name: "Alpha", path: "Alpha.md" },
        { name: "Beta", path: "Beta.md" },
      ]),
    );
    const editor = createEditor(host);

    try {
      editor.view.dispatch(
        editor.view.state.tr.insertText("See [[Alpha]] today"),
      );
      const afterOpen = 1 + editor.view.state.doc.textContent.indexOf("[[") + 2;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(
          TextSelection.create(editor.view.state.doc, afterOpen),
        ),
      );
      expect(document.body.querySelector(".wiki-link-autocomplete")).toBeNull();

      typeText(editor, "B");
      expect(document.body.querySelector(".wiki-link-autocomplete")).not.toBeNull();
      expect(editor.view.state.doc.textContent).toBe("See [[BAlpha]] today");
    } finally {
      editor.destroy();
      setWikiLinkBridge(null);
      host.remove();
    }
  });
});
