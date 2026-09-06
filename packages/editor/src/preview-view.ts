import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { documentMetadataPlugin } from "./document-metadata.ts";
import { syntaxHintsPlugin } from "./decorations.ts";
import { collectPlugins } from "./features/index.ts";
import { normalizeInlinePlugin } from "./normalize.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";
import { getWikiLinkBridge } from "./wiki-link-bridge.ts";

const PREVIEW_MAX_CHARS = 24_000;

export interface MarkdownPreviewOptions {
  /** Called after a wiki widget click opens a note (e.g. dismiss hover card). */
  onOpenNote?: (note: string, heading?: string) => void;
}

export interface MarkdownPreviewController {
  destroy(): void;
}

/**
 * Mount a read-only ProseMirror surface that reuses the editor's parse
 * pipeline, feature plugins, and theme CSS — so hover previews match the
 * live editor. Interaction plugins (wiki autocomplete / hover) are not
 * included; wiki widgets still click-through via a local handler.
 */
export function mountReadonlyMarkdownPreview(
  host: HTMLElement,
  markdown: string,
  options: MarkdownPreviewOptions = {},
): MarkdownPreviewController {
  const clipped =
    markdown.length > PREVIEW_MAX_CHARS
      ? `${markdown.slice(0, PREVIEW_MAX_CHARS)}\n\n…`
      : markdown;

  const doc = clipped ? parse(clipped) : schema.nodes.doc.createAndFill()!;
  const base = EditorState.create({
    schema,
    doc,
    plugins: [
      documentMetadataPlugin(),
      normalizeInlinePlugin(),
      // Feature nodeViews / draft watchers that affect rendering (code,
      // math, tasks, …). Wiki autocomplete + hover are registered only in
      // the live editor via `defaultPlugins`.
      ...collectPlugins(schema),
      syntaxHintsPlugin(),
    ],
  });

  // Match createEditor: run one no-op so normalize's appendTransaction
  // applies method-B marks before first paint. Park the caret at the end
  // so most of the doc renders in the "cursor outside" (reading) state.
  const state = base.apply(base.tr.setSelection(TextSelection.atEnd(doc)));

  const view = new EditorView(host, {
    state,
    editable: () => false,
    attributes: {
      class: "wiki-link-preview-prose",
      spellcheck: "false",
    },
    handleClick(_v, _pos, event) {
      const node = event.target as Node | null;
      const el = node instanceof Element ? node : node?.parentElement ?? null;
      const wiki = el?.closest(
        ".wiki-link-widget, .wiki-embed-note, .wiki-embed-image",
      ) as HTMLElement | null;
      if (!wiki) return false;
      const note = wiki.getAttribute("data-note");
      if (!note || wiki.getAttribute("data-unresolved") === "1") return false;
      event.preventDefault();
      event.stopPropagation();
      const heading = wiki.getAttribute("data-heading") || undefined;
      getWikiLinkBridge()?.openNote(note, heading || undefined);
      options.onOpenNote?.(note, heading);
      return true;
    },
    handleDOMEvents: {
      // Keep selection stable; allow scrolling / click-to-open.
      mousedown(_v, event) {
        if (event.button === 2) return true;
        return false;
      },
      // DOM click is more reliable on widgets (target may be a text node).
      click(_v, event) {
        const node = event.target as Node | null;
        const el = node instanceof Element ? node : node?.parentElement ?? null;
        const wiki = el?.closest(
          ".wiki-link-widget, .wiki-embed-note, .wiki-embed-image",
        ) as HTMLElement | null;
        if (!wiki) return false;
        const note = wiki.getAttribute("data-note");
        if (!note || wiki.getAttribute("data-unresolved") === "1") return false;
        event.preventDefault();
        event.stopPropagation();
        const heading = wiki.getAttribute("data-heading") || undefined;
        getWikiLinkBridge()?.openNote(note, heading || undefined);
        options.onOpenNote?.(note, heading);
        return true;
      },
    },
  });

  return {
    destroy() {
      view.destroy();
      host.replaceChildren();
    },
  };
}
