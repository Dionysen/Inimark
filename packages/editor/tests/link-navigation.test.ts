import { describe, expect, test, vi } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { handleEditorSurfaceMouseDown } from "../src/click-focus.ts";
import { defaultPlugins } from "../src/editor.ts";
import {
  isExternalHref,
  isRenderedNavigablePointer,
  normalizeExternalHref,
  tryNavigateFromClick,
} from "../src/link-navigation.ts";
import { parse } from "../src/parser.ts";
import { schema } from "../src/schema.ts";
import { ensureTrailingSentinel } from "../src/trailing-sentinel.ts";
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
      doc: ensureTrailingSentinel(parse(markdown)),
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
    button: 0,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as MouseEvent;
}

function fireLinkPointer(view: EditorView, event: MouseEvent): void {
  view.someProp("handleDOMEvents", (handlers) => {
    handlers?.mousedown?.(view, event);
    handlers?.click?.(view, event);
    return false;
  });
}

describe("link navigation", () => {
  test("isExternalHref matches Obsidian URL detection", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("http://example.com/path")).toBe(true);
    expect(isExternalHref("mailto:user@example.com")).toBe(true);
    expect(isExternalHref("note.md")).toBe(false);
    expect(isExternalHref("./folder/note.md")).toBe(false);
    expect(isExternalHref("www.example.com")).toBe(false);
    expect(isExternalHref("")).toBe(false);
    expect(isExternalHref("not a url")).toBe(false);
  });

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

  test("unresolved wiki links show a create hint on ctrl hover", async () => {
    vi.useFakeTimers();
    setWikiLinkBridge({
      resolveNote: () => null,
      resolveImage: () => null,
      searchNotes: () => [],
      openNote: vi.fn(),
      createNote: vi.fn(),
    });

    const { host, view, cleanup } = mountView("See [[jqui]] here.");
    try {
      const wiki = host.querySelector<HTMLElement>(".wiki-link-widget.is-unresolved");
      expect(wiki).not.toBeNull();

      view.someProp("handleDOMEvents", (handlers) => {
        handlers?.mouseover?.(
          view,
          {
            target: wiki,
            ctrlKey: true,
            metaKey: false,
            clientX: 0,
            clientY: 0,
          } as MouseEvent,
        );
        return false;
      });

      await vi.advanceTimersByTimeAsync(500);
      const missing = document.querySelector(".wiki-link-preview-missing");
      expect(missing?.textContent).toContain("jqui");
      expect(missing?.textContent).toContain("未创建，点击以创建");
    } finally {
      vi.useRealTimers();
      setWikiLinkBridge(null);
      cleanup();
      document.querySelector(".wiki-link-preview-missing")?.remove();
    }
  });

  test("hover preview trigger shows unresolved hint without holding Ctrl", async () => {
    vi.useFakeTimers();
    setWikiLinkBridge({
      resolveNote: () => null,
      resolveImage: () => null,
      searchNotes: () => [],
      openNote: vi.fn(),
      createNote: vi.fn(),
      previewTrigger: () => "hover",
    });

    const { host, view, cleanup } = mountView("See [[ghost-note]] here.");
    try {
      const wiki = host.querySelector<HTMLElement>(".wiki-link-widget.is-unresolved");
      expect(wiki).not.toBeNull();

      view.someProp("handleDOMEvents", (handlers) => {
        handlers?.mouseover?.(
          view,
          {
            target: wiki,
            ctrlKey: false,
            metaKey: false,
            clientX: 0,
            clientY: 0,
          } as MouseEvent,
        );
        return false;
      });

      await vi.advanceTimersByTimeAsync(500);
      const missing = document.querySelector(".wiki-link-preview-missing");
      expect(missing?.textContent).toContain("ghost-note");
    } finally {
      vi.useRealTimers();
      setWikiLinkBridge(null);
      cleanup();
      document.querySelector(".wiki-link-preview-missing")?.remove();
    }
  });

  test("modifier preview trigger ignores plain hover", async () => {
    vi.useFakeTimers();
    setWikiLinkBridge({
      resolveNote: () => null,
      resolveImage: () => null,
      searchNotes: () => [],
      openNote: vi.fn(),
      createNote: vi.fn(),
      previewTrigger: () => "modifier",
    });

    const { host, view, cleanup } = mountView("See [[quiet-note]] here.");
    try {
      const wiki = host.querySelector<HTMLElement>(".wiki-link-widget.is-unresolved");
      expect(wiki).not.toBeNull();

      view.someProp("handleDOMEvents", (handlers) => {
        handlers?.mouseover?.(
          view,
          {
            target: wiki,
            ctrlKey: false,
            metaKey: false,
            clientX: 0,
            clientY: 0,
          } as MouseEvent,
        );
        return false;
      });

      await vi.advanceTimersByTimeAsync(500);
      expect(document.querySelector(".wiki-link-preview-missing")).toBeNull();
    } finally {
      vi.useRealTimers();
      setWikiLinkBridge(null);
      cleanup();
    }
  });

  test("markdown links only navigate from bracketed label text", () => {
    const originalOpen = window.open;
    const calls: unknown[] = [];
    window.open = ((...args: unknown[]) => {
      calls.push(args);
      return null;
    }) as typeof window.open;

    const { host, view, cleanup } = mountView("[bing](http://www.bing.com)");
    try {
      const link = host.querySelector<HTMLAnchorElement>("a");
      expect(link).not.toBeNull();
      expect(link!.textContent).toBe("bing");

      view.dispatch(
        view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)),
      );

      const outsidePos = view.state.selection.from;
      fireLinkPointer(view, plainClickEvent(link!));
      expect(calls).toEqual([["http://www.bing.com", "_blank", "noopener,noreferrer"]]);
      expect(view.state.selection.from).toBe(outsidePos);

      calls.length = 0;
      let insidePos = 0;
      view.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return;
        const at = node.textContent.indexOf("i");
        if (at >= 0) {
          insidePos = pos + 1 + at;
          return false;
        }
      });
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, insidePos)),
      );
      const insideEvent = plainClickEvent(link!);
      expect(isRenderedNavigablePointer(view, insideEvent)).toBe(false);
      expect(tryNavigateFromClick(view, insideEvent)).toBe(false);
      expect(calls).toEqual([]);

      const text = view.state.doc.textBetween(1, view.state.doc.content.size - 1);
      const clickAtPos = (pos: number) => {
        const coords = view.coordsAtPos(pos);
        view.someProp("handleDOMEvents", (handlers) => {
          handlers?.click?.(
            view,
            {
              target: host,
              clientX: coords.left,
              clientY: coords.top,
              ctrlKey: false,
              metaKey: false,
              preventDefault() {},
              stopPropagation() {},
            } as MouseEvent,
          );
          return false;
        });
      };

      calls.length = 0;
      clickAtPos(1 + text.indexOf("http"));
      expect(calls).toEqual([]);

      calls.length = 0;
      clickAtPos(1 + text.length - 1);
      expect(calls).toEqual([]);
    } finally {
      window.open = originalOpen;
      cleanup();
    }
  });

  test("rendered link mousedown does not move the caret into source mode", () => {
    const { host, view, cleanup } = mountView("[bing](http://www.bing.com)");
    try {
      view.dispatch(
        view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)),
      );
      const outsidePos = view.state.selection.from;
      const link = host.querySelector<HTMLAnchorElement>("a");
      expect(link).not.toBeNull();

      expect(
        handleEditorSurfaceMouseDown(view, plainClickEvent(link!), host),
      ).toBe(false);
      expect(view.state.selection.from).toBe(outsidePos);
    } finally {
      cleanup();
    }
  });

  test("wiki links open on plain click, not on Ctrl+click", () => {
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

      fireLinkPointer(view, modClickEvent(wiki!));
      expect(opened).toEqual([]);

      fireLinkPointer(view, plainClickEvent(wiki!));
      expect(opened).toEqual([{ note: "Other Note", heading: undefined }]);

      opened.length = 0;
      wiki!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(opened).toEqual([{ note: "Other Note", heading: undefined }]);
    } finally {
      setWikiLinkBridge(null);
      cleanup();
    }
  });
});
