import { RangeSet, StateField, type EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  GutterMarker,
  lineNumberMarkers,
  lineNumbers,
} from "@codemirror/view";

/** Typora-style sparse line numbers: line 1, every 10th line, plus the active line. */
const LINE_NUMBER_INTERVAL = 10;

class LineNumberMarker extends GutterMarker {
  constructor(readonly label: string) {
    super();
  }

  eq(other: LineNumberMarker): boolean {
    return other instanceof LineNumberMarker && other.label === this.label;
  }

  toDOM(): Text {
    return document.createTextNode(this.label);
  }
}

function shouldShowIntervalLineNumber(lineNo: number): boolean {
  return lineNo === 1 || lineNo % LINE_NUMBER_INTERVAL === 0;
}

function formatIntervalLineNumber(lineNo: number, state: EditorState): string {
  // CodeMirror passes probe values (9, 99, …) beyond doc.lines to size the gutter.
  if (lineNo > state.doc.lines) return String(state.doc.lines);
  return shouldShowIntervalLineNumber(lineNo) ? String(lineNo) : "";
}

function activeLineNumberSet(state: EditorState): RangeSet<GutterMarker> {
  const lineNo = state.doc.lineAt(state.selection.main.head).number;
  if (shouldShowIntervalLineNumber(lineNo)) return RangeSet.empty;
  const line = state.doc.line(lineNo);
  return RangeSet.of([new LineNumberMarker(String(lineNo)).range(line.from)]);
}

const activeLineNumberField = StateField.define<RangeSet<GutterMarker>>({
  create(state) {
    return activeLineNumberSet(state);
  },
  update(value, tr) {
    if (!tr.selection) return value;
    return activeLineNumberSet(tr.state);
  },
});

/** CodeMirror extensions for Typora-like line numbers in source mode. */
export function sourceLineNumberExtensions(): Extension[] {
  return [
    lineNumbers({
      formatNumber: formatIntervalLineNumber,
    }),
    activeLineNumberField,
    lineNumberMarkers.compute([activeLineNumberField], (state) =>
      state.field(activeLineNumberField),
    ),
    EditorView.theme({
      "&": {
        position: "relative",
      },
      ".cm-gutters": {
        position: "absolute",
        right: "100%",
        top: "0",
        width: "0",
        minWidth: "0",
        overflow: "visible",
        backgroundColor: "transparent",
        border: "none",
        color: "var(--tw-source-line-number, #888)",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontFamily:
          "var(--tw-source-line-number-font, ui-monospace, SFMono-Regular, Menlo, monospace)",
      },
      ".cm-lineNumbers": {
        position: "absolute",
        right: "0",
        top: "0",
        width: "max-content",
        minWidth: "2.75em",
      },
      ".cm-scroller": {
        width: "100%",
        flex: "1 1 auto",
        minWidth: "0",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontFamily: "inherit",
        minWidth: "2.75em",
        padding: "0 var(--tw-source-line-number-gap, 0.75em) 0 0",
        textAlign: "right",
      },
    }),
  ];
}
