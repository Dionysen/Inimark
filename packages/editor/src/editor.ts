import type { Node as PMNode } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";

import { cursorRenderPlugin } from "./cursor-render.ts";
import { syntaxHintsPlugin } from "./decorations.ts";
import { documentMetadataPlugin } from "./document-metadata.ts";
import { focusModePlugin } from "./modes.ts";
import { collectKeymaps, collectPlugins } from "./features/index.ts";
import { wikiLinkEditorPlugins } from "./features/wiki-link.ts";
import { markdownInputRules, spaceBreaksStoredMarks } from "./input-rules.ts";
import { markdownPastePlugin } from "./paste.ts";
import { normalizeInlinePlugin } from "./normalize.ts";
import { findReplacePlugin } from "./find-replace.ts";
import { searchRevealPlugin } from "./search-reveal.ts";
import { headingFlashPlugin } from "./heading-flash.ts";
import { schema } from "./schema.ts";
import { commonShortcutKeymap } from "./shortcuts.ts";
import {
  ensureTrailingSentinel,
  trailingSentinelPlugin,
} from "./trailing-sentinel.ts";
import { clickFocusPlugin } from "./click-focus.ts";
import { isRenderedNavigablePointer, tryNavigateFromClick } from "./link-navigation.ts";

// Wiki links and external URLs open on plain click; Cmd/Ctrl+hover shows a preview card.
// Internal markdown links still open on Cmd/Ctrl+click.
function linkNavigationPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.button !== 0) return false;
          return tryNavigateFromClick(view, event);
        },
        click(view, event) {
          // Navigation runs on mousedown (before the caret moves). Swallow
          // the follow-up click so we don't open twice or re-enter edit mode.
          if (isRenderedNavigablePointer(view, event)) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    },
  });
}

export function defaultPlugins(options: { cursorWidget?: boolean } = {}): Plugin[] {
  // cursorRenderPlugin paints a visible caret even when the view is not
  // focused — only useful for the replay harness (fakeView has no focus).
  // A real browser editor already draws its own caret, so a live editor
  // should pass `{ cursorWidget: false }`.
  const { cursorWidget = true } = options;
  const featureKeymap = collectKeymaps(schema);
  const plugins: Plugin[] = [
    history(),
    keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
    keymap(commonShortcutKeymap(schema)),
    focusModePlugin(),
    markdownInputRules(),
    spaceBreaksStoredMarks(),
    markdownPastePlugin(),
    documentMetadataPlugin(),
    normalizeInlinePlugin(),
    // Feature-contributed plugins sit after normalize (so block-draft
    // watchers see the post-normalize doc) and before syntaxHints (so any
    // extra decorations merge into PM's decoration pipeline naturally).
    ...collectPlugins(schema),
    // Wiki autocomplete + hover preview — editor-only (not used by the
    // read-only hover card surface).
    ...wikiLinkEditorPlugins(),
    syntaxHintsPlugin(),
    searchRevealPlugin(),
    findReplacePlugin(),
    headingFlashPlugin(),
    trailingSentinelPlugin(),
    clickFocusPlugin(),
    linkNavigationPlugin(),
  ];
  if (cursorWidget) plugins.push(cursorRenderPlugin());
  // Feature keymap wins over baseKeymap — features that override Enter /
  // Backspace for block exits rely on this ordering.
  if (Object.keys(featureKeymap).length > 0) plugins.push(keymap(featureKeymap));
  plugins.push(keymap(baseKeymap));
  return plugins;
}

export function createState(doc: PMNode): EditorState {
  return EditorState.create({
    schema,
    doc: ensureTrailingSentinel(doc),
    plugins: defaultPlugins(),
  });
}
