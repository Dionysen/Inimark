import { describe, expect, test } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { defaultPlugins } from "../src/editor.ts";
import { normalizeExternalHref } from "../src/link-navigation.ts";
import { parse } from "../src/parser.ts";
import { schema } from "../src/schema.ts";
import { setWikiLinkBridge } from "../src/wiki-link-bridge.ts";

function mountView(markdown: string): {
  host: HTMLElement;
  view: EditorView;
  cleanup: () => void;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const view = new EditorView(host, {
    state: EditorState.create({
      schema,
      doc: parse(markdown),
      plugins: defaultPlugins({ cursorWidget: false }),
    }),
  });
  return {
    host,
    view,
    cleanup: () => {
      view.destroy();
      host.remove();
    },
  };
}

function modClickEvent(target: Element): MouseEvent {
  return {
    target,
    clientX: 0,
    clientY: 0,
    ctrlKey: true,
    metaKey: false,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as MouseEvent;
}

function plainClickEvent(target: Element): MouseEvent {
  return {
    target,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as MouseEvent;
}

describe("link navigation", () => {
  test("normalizeExternalHref adds https for bare domains", () => {
    expect(normalizeExternalHref("www.bing.com")).toBe("https://www.bing.com");
    expect(normalizeExternalHref("bing.com/search")).toBe("https://bing.com/search");
    expect(normalizeExternalHref("https://example.com")).toBe("https://example.com");
    expect(normalizeExternalHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(normalizeExternalHref("note.md")).toBe("note.md");
    expect(normalizeExternalHref("./note.md")).toBe("./note.md");
  });

  test("wiki links inside inline code render as plain text", () => {
    setWikiLinkBridge({
      resolveNote: (note) => (note === "Other Note" ? "Other Note.md" : null),
      resolveImage: () => null,
      searchNotes: () => [],
      openNote() {},
    });

    const { host, cleanup } = mountView("Use `[[Other Note]]` here.");
    try {
      expect(host.querySelector(".wiki-link-widget")).toBeNull();
      expect(host.textContent).toContain("[[Other Note]]");
    } finally {
      setWikiLinkBridge(null);
      cleanup();
    }
  });

  test("wiki links open on Ctrl+click only", () => {
    const opened: Array<{ note: string; heading?: string }> = [];
    setWikiLinkBridge({
      resolveNote: () => null,
      resolveImage: () => null,
      searchNotes: () => [],
      openNote(note, heading) {
        opened.push({ note, heading });
      },
    });

    const { host, view, cleanup } = mountView("See [[Other Note]] for details.");
    try {
      const wiki = host.querySelector<HTMLElement>(".wiki-link-widget");
      expect(wiki).not.toBeNull();

      view.someProp("handleDOMEvents", (handlers) => {
        handlers?.click?.(view, plainClickEvent(wiki!));
        return false;
      });
      expect(opened).toEqual([]);

      view.someProp("handleDOMEvents", (handlers) => {
        handlers?.click?.(view, modClickEvent(wiki!));
        return false;
      });
      expect(opened).toEqual([{ note: "Other Note", heading: undefined }]);

      opened.length = 0;
      wiki!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }),
      );
      expect(opened).toEqual([{ note: "Other Note", heading: undefined }]);
    } finally {
      setWikiLinkBridge(null);
      cleanup();
    }
  });
});
