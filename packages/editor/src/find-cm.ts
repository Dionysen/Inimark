import {
  SearchQuery,
  search,
  setSearchQuery,
} from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import type { EditorView as CMView } from "@codemirror/view";

import type { FindOptions } from "./find-in-markdown.ts";
import type { MdMatch } from "./find-in-markdown.ts";

/** CodeMirror extensions for in-source find highlighting. */
export function sourceFindExtensions(): Extension[] {
  return [search({ top: true })];
}

export function toSearchQuery(options: FindOptions): SearchQuery {
  return new SearchQuery({
    search: options.query,
    caseSensitive: options.caseSensitive ?? false,
    literal: !options.regex,
    regexp: options.regex ?? false,
    wholeWord: options.wholeWord ?? false,
  });
}

export function applyCmFindQuery(view: CMView, options: FindOptions): void {
  view.dispatch({
    effects: setSearchQuery.of(toSearchQuery(options)),
  });
}

export function clearCmFindQuery(view: CMView): void {
  view.dispatch({
    effects: setSearchQuery.of(new SearchQuery({ search: "" })),
  });
}

export function selectCmMatch(view: CMView, match: MdMatch): void {
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    scrollIntoView: true,
  });
  view.focus();
}
