import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { documentMetadataPlugin } from "./document-metadata.ts";
import { syntaxHintsPlugin } from "./decorations.ts";
import { collectPlugins } from "./features/index.ts";
import { tryNavigateFromClick } from "./link-navigation.ts";
import { normalizeInlinePlugin } from "./normalize.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";
import { readingModeSelection } from "./static-export.ts";

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
  // applies method-B marks before first paint. Use a non-empty selection so
  // wiki/math "outside" widgets stay mounted (caret-at-end hides the last one).
  const state = base.apply(base.tr.setSelection(readingModeSelection(doc)));

  const view = new EditorView(host, {
    state,
    editable: () => false,
    attributes: {
      class: "wiki-link-preview-prose",
      spellcheck: "false",
    },
    handleClick(view, _pos, event) {
      return tryNavigateFromClick(view, event, {
        onWikiOpen: options.onOpenNote,
      });
    },
    handleDOMEvents: {
      // Keep selection stable; allow scrolling / click-to-open.
      mousedown(_v, event) {
        if (event.button === 2) return true;
        return false;
      },
      click(view, event) {
        return tryNavigateFromClick(view, event, {
          onWikiOpen: options.onOpenNote,
        });
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
