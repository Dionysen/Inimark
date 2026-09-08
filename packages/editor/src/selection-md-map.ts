import type { Node as PMNode } from "prosemirror-model";

import { serialize } from "./serializer.ts";

function blockSeparator(prefix: string): string {
  if (!prefix) return "";
  if (prefix.endsWith("\n\n")) return "";
  if (prefix.endsWith("\n")) return "\n";
  return "\n\n";
}

/**
 * Map a rendered document position to a markdown character offset.
 * `doc.cut(0, pos)` is wrong inside opaque blocks (code/math): it includes
 * the whole block and serializes the closing fence, so source mode shows the
 * caret after ``` instead of inside the block.
 */
export function renderedPosToMdOffset(doc: PMNode, pos: number): number {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);

  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "code_block") {
      const blockPos = $pos.before(d);
      const prefix = serialize(doc.cut(0, blockPos));
      const lang = String(node.attrs.lang ?? "");
      const innerOffset = Math.max(0, clamped - $pos.start(d));
      const innerText = node.textBetween(0, innerOffset, "\n", "\n");
      return (
        prefix.length +
        blockSeparator(prefix).length +
        "```".length +
        lang.length +
        1 +
        innerText.length
      );
    }
    if (node.type.name === "math_block") {
      const blockPos = $pos.before(d);
      const prefix = serialize(doc.cut(0, blockPos));
      const innerOffset = Math.max(0, clamped - $pos.start(d));
      const innerText = node.textBetween(0, innerOffset, "\n", "\n");
      return prefix.length + blockSeparator(prefix).length + "$$\n".length + innerText.length;
    }
  }

  try {
    return serialize(doc.cut(0, clamped)).length;
  } catch {
    return serialize(doc).length;
  }
}
