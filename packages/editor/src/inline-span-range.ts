import type { Node as PMNode } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

type TextSegment = {
  textFrom: number;
  textTo: number;
  pmFrom: number;
  pmTo: number;
};

type SpanRange = {
  openFrom: number;
  closeTo: number;
};

function textSegments(node: PMNode): TextSegment[] {
  const segments: TextSegment[] = [];
  let textOffset = 0;
  let pmOffset = 0;
  node.forEach((child) => {
    if (child.isText) {
      const len = child.text?.length ?? 0;
      segments.push({
        textFrom: textOffset,
        textTo: textOffset + len,
        pmFrom: pmOffset,
        pmTo: pmOffset + child.nodeSize,
      });
      textOffset += len;
    }
    pmOffset += child.nodeSize;
  });
  return segments;
}

function textOffsetToPm(
  segments: readonly TextSegment[],
  offset: number,
  assoc: -1 | 1,
): number {
  for (const segment of segments) {
    if (offset > segment.textFrom && offset < segment.textTo) {
      return segment.pmFrom + offset - segment.textFrom;
    }
    if (offset === segment.textFrom && assoc > 0) return segment.pmFrom;
    if (offset === segment.textTo && assoc < 0) return segment.pmTo;
  }
  if (segments.length === 0) return 0;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  if (offset <= first.textFrom) return first.pmFrom;
  return last.pmTo;
}

/** Map an inline span's source offsets to absolute doc positions. */
export function inlineSpanDocRange(
  block: PMNode,
  blockStart: number,
  span: SpanRange,
): { spanFrom: number; spanTo: number } {
  const segments = textSegments(block);
  const startPos = (offset: number) =>
    blockStart + textOffsetToPm(segments, offset, 1);
  const endPos = (offset: number) =>
    blockStart + textOffsetToPm(segments, offset, -1);
  return {
    spanFrom: startPos(span.openFrom),
    spanTo: endPos(span.closeTo),
  };
}

/** False while the caret is inside the construct's source range (syntax visible). */
export function isInlineConstructRendered(
  state: EditorState,
  spanFrom: number,
  spanTo: number,
): boolean {
  const cursor = state.selection.empty ? state.selection.from : null;
  if (cursor === null) return true;
  return cursor < spanFrom || cursor > spanTo;
}
