import { TextSelection, type Transaction } from "prosemirror-state";

/** Place the caret inside a textblock after block-level insert/replace. */
export function caretInsideTextblock(tr: Transaction, blockName: string): number {
  const { from } = tr.selection;
  const $pos = tr.doc.resolve(from);

  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === blockName) {
      const start = $pos.start(d);
      const end = $pos.end(d);
      if (from >= start && from <= end) return from;
      return start;
    }
  }

  // Walk up through block containers and look for a matching sibling.
  for (let containerDepth = $pos.depth; containerDepth >= 1; containerDepth--) {
    const container = $pos.node(containerDepth - 1);
    const childIndex = $pos.index(containerDepth - 1);
    if (childIndex > 0) {
      const prev = container.child(childIndex - 1);
      if (prev.type.name === blockName) {
        const prevStart = $pos.before(containerDepth) - prev.nodeSize;
        return prevStart + 1 + prev.content.size;
      }
    }
    if (childIndex < container.childCount - 1) {
      const next = container.child(childIndex + 1);
      if (next.type.name === blockName) {
        return $pos.after(containerDepth) + 1;
      }
    }
  }

  const candidates: { pos: number; dist: number }[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== blockName) return;
    const inside = pos + 1 + node.content.size;
    candidates.push({ pos: inside, dist: Math.abs(from - inside) });
  });
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0]!.pos;
  }

  return from;
}

export function setCaretInTextblock(tr: Transaction, blockName: string): Transaction {
  const pos = caretInsideTextblock(tr, blockName);
  return tr.setSelection(TextSelection.create(tr.doc, pos));
}

/** Keep or restore a caret position inside a container after structural edits. */
export function caretInsideContainer(
  tr: Transaction,
  containerPos: number,
  container: import("prosemirror-model").Node,
  preferred: number,
): number {
  const bodyStart = firstTextblockContentPos(containerPos, container);
  const innerEnd = containerPos + container.nodeSize - 1;
  const mapped = tr.mapping.map(preferred, -1);
  if (mapped >= bodyStart && mapped <= innerEnd) return mapped;

  const first = container.firstChild;
  if (first?.isTextblock) {
    return bodyStart + first.content.size;
  }
  return bodyStart;
}

function firstTextblockContentPos(containerPos: number, container: import("prosemirror-model").Node): number {
  let offset = containerPos + 1;
  for (let i = 0; i < container.childCount; i++) {
    const child = container.child(i);
    if (child.isTextblock) return offset + 1;
    offset += child.nodeSize;
  }
  return containerPos + 1;
}
