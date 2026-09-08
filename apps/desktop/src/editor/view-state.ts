import type { Editor, EditorViewState } from "@inimark/editor";

import type { FileViewState } from "../libraries/store.ts";

export const MAX_FILE_VIEWS = 100;

export function touchFileView(
  fileViews: Record<string, FileViewState>,
  path: string,
  state: EditorViewState,
): Record<string, FileViewState> {
  const next: Record<string, FileViewState> = {
    ...fileViews,
    [path]: {
      anchor: state.anchor,
      head: state.head,
      scrollTop: state.scrollTop,
      sourceMode: state.sourceMode,
      updatedAt: Date.now(),
    },
  };
  return trimFileViews(next);
}

export function captureFileViewState(
  editor: Editor,
  fileViews: Record<string, FileViewState>,
  path: string | null,
): Record<string, FileViewState> {
  if (!path) return fileViews;
  return touchFileView(fileViews, path, editor.getViewState());
}

function trimFileViews(views: Record<string, FileViewState>): Record<string, FileViewState> {
  const entries = Object.entries(views);
  if (entries.length <= MAX_FILE_VIEWS) return views;
  entries.sort((a, b) => {
    const byTime = (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0);
    if (byTime !== 0) return byTime;
    return b[0].localeCompare(a[0]);
  });
  return Object.fromEntries(entries.slice(0, MAX_FILE_VIEWS));
}

export function remapFileViews(
  fileViews: Record<string, FileViewState>,
  pairs: Array<{ from: string; to: string }>,
): Record<string, FileViewState> {
  if (pairs.length === 0 || Object.keys(fileViews).length === 0) return fileViews;
  const next: Record<string, FileViewState> = {};
  for (const [path, state] of Object.entries(fileViews)) {
    let mapped = path;
    for (const { from, to } of pairs) {
      if (mapped === from) {
        mapped = to;
        break;
      }
      if (mapped.startsWith(`${from}/`)) {
        mapped = `${to}${mapped.slice(from.length)}`;
        break;
      }
    }
    next[mapped] = state;
  }
  return next;
}

export function removeFileView(
  fileViews: Record<string, FileViewState>,
  path: string,
): Record<string, FileViewState> {
  const next = { ...fileViews };
  delete next[path];
  for (const key of Object.keys(next)) {
    if (key.startsWith(`${path}/`)) delete next[key];
  }
  return next;
}

export function toEditorViewState(state: FileViewState): EditorViewState {
  return {
    anchor: state.anchor,
    head: state.head,
    scrollTop: state.scrollTop,
    sourceMode: state.sourceMode,
  };
}
