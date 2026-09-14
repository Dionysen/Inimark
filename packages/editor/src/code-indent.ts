import { indentUnit } from "@codemirror/language";
import { EditorState as CodeMirrorState, type Extension } from "@codemirror/state";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

/** Spaces per indent level for fenced-code Tab / auto-indent. */
export const CODE_INDENT_SIZE_DEFAULT = 2;
export const CODE_INDENT_SIZE_MIN = 1;
export const CODE_INDENT_SIZE_MAX = 8;

const codeIndentKey = new PluginKey<number>("codeIndentSize");

export function clampCodeIndentSize(size: number): number {
  if (!Number.isFinite(size)) return CODE_INDENT_SIZE_DEFAULT;
  return Math.min(
    CODE_INDENT_SIZE_MAX,
    Math.max(CODE_INDENT_SIZE_MIN, Math.round(size)),
  );
}

export function codeIndentExtensions(size: number): Extension {
  const unit = clampCodeIndentSize(size);
  return [CodeMirrorState.tabSize.of(unit), indentUnit.of(" ".repeat(unit))];
}

export type CodeIndentEditor = {
  setIndentSize(size: number): void;
};

type IndentHost = {
  size: number;
  editors: Set<CodeIndentEditor>;
};

const hosts = new WeakMap<EditorView, IndentHost>();

function hostFor(view: EditorView): IndentHost {
  let host = hosts.get(view);
  if (!host) {
    host = {
      size: getCodeIndentSize(view.state),
      editors: new Set(),
    };
    hosts.set(view, host);
  }
  return host;
}

export function getCodeIndentSize(state: EditorState): number {
  return codeIndentKey.getState(state) ?? CODE_INDENT_SIZE_DEFAULT;
}

/** Apply a new indent unit to every registered fenced-code editor. */
export function setCodeIndentSize(view: EditorView, size: number): void {
  const next = clampCodeIndentSize(size);
  if (getCodeIndentSize(view.state) === next) return;
  view.dispatch(view.state.tr.setMeta(codeIndentKey, next));
}

export function registerCodeIndentEditor(
  view: EditorView,
  editor: CodeIndentEditor,
): () => void {
  const host = hostFor(view);
  host.editors.add(editor);
  editor.setIndentSize(host.size);
  return () => {
    host.editors.delete(editor);
  };
}

export function codeIndentPlugin(): Plugin<number> {
  return new Plugin<number>({
    key: codeIndentKey,
    state: {
      init: () => CODE_INDENT_SIZE_DEFAULT,
      apply(tr, value) {
        const meta = tr.getMeta(codeIndentKey);
        if (typeof meta === "number") return clampCodeIndentSize(meta);
        return value;
      },
    },
    view() {
      return {
        update(view) {
          const size = getCodeIndentSize(view.state);
          const host = hostFor(view);
          if (host.size === size) return;
          host.size = size;
          for (const editor of host.editors) editor.setIndentSize(size);
        },
      };
    },
  });
}
