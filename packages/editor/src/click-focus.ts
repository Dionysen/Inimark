import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

type BlockRect = {
  nodePos: number;
  node: PMNode;
  from: number;
  to: number;
  top: number;
  bottom: number;
  opaque: boolean;
};

const OPAQUE_BLOCKS = new Set([
  "code_block",
  "math_block",
  "horizontal_rule",
  "html_block",
]);

function isInteractiveEditorTarget(target: Element): boolean {
  if (target.closest(".typora-web-code-editor .cm-editor")) return true;
  if (target.closest(".cb-lang-input, .cb-lang-menu")) return true;
  if (target.closest(".typora-web-html-source")) return true;
  if (target.closest(".table-toolbar, .table-resize-popup")) return true;
  if (target.closest(".emoji-completion")) return true;
  if (target.closest(".file-input")) return true;
  if (target.closest(".wiki-link-autocomplete")) return true;
  if (target.closest("input, textarea, select, button")) return true;
  return false;
}

function isOpaqueChromeClick(target: Element): boolean {
  if (target.closest(".code-block-node") && !target.closest(".typora-web-code-editor")) {
    return true;
  }
  if (target.closest("math-block math-preview")) return true;
  if (target.closest(".html-block-node .html-block-preview")) return true;
  if (target.closest("toc-block")) return true;
  if (target.closest(".diagram-panel")) return true;
  const ceFalse = target.closest('.ProseMirror [contenteditable="false"]');
  if (ceFalse && !isInteractiveEditorTarget(target)) return true;
  return false;
}

function blockRect(view: EditorView, nodePos: number, node: PMNode): BlockRect | null {
  const from = nodePos + 1;
  const to = nodePos + node.nodeSize - 1;
  try {
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    return {
      nodePos,
      node,
      from,
      to,
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      opaque: OPAQUE_BLOCKS.has(node.type.name),
    };
  } catch {
    return null;
  }
}

function collectBlockRects(view: EditorView): BlockRect[] {
  const doc = view.state.doc;
  const blocks: BlockRect[] = [];
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const rect = blockRect(view, pos, node);
    if (rect) blocks.push(rect);
    pos += node.nodeSize;
  }
  return blocks;
}

function posInBlock(block: BlockRect, y: number): number {
  const mid = (block.top + block.bottom) / 2;
  return y >= mid ? block.to : block.from;
}

function nearestEditablePos(blocks: BlockRect[], index: number, dir: -1 | 1): number | null {
  for (let i = index + dir; i >= 0 && i < blocks.length; i += dir) {
    const block = blocks[i]!;
    if (block.opaque) continue;
    return dir < 0 ? block.to : block.from;
  }
  return null;
}

function hitIsInsideOpaqueBlock(view: EditorView, pos: number): boolean {
  const $pos = view.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (OPAQUE_BLOCKS.has($pos.node(depth).type.name)) return true;
  }
  return false;
}

/** Map a screen click to the nearest prose caret position. */
export function focusPosFromClick(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element | null = null,
): number | null {
  const opaqueChrome = target ? isOpaqueChromeClick(target) : false;

  if (!opaqueChrome) {
    const hit = view.posAtCoords({ left: clientX, top: clientY });
    if (hit && !hitIsInsideOpaqueBlock(view, hit.pos)) return hit.pos;
  }

  for (const dy of [0, -8, 8, -16, 16, -32, 32]) {
    const probe = view.posAtCoords({ left: clientX, top: clientY + dy });
    if (probe && !hitIsInsideOpaqueBlock(view, probe.pos)) return probe.pos;
  }

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return 1;

  const editorRect = view.dom.getBoundingClientRect();
  const x = Math.max(editorRect.left + 4, Math.min(clientX, editorRect.right - 4));

  for (const dy of [0, -8, 8, -16, 16]) {
    const probe = view.posAtCoords({ left: x, top: clientY + dy });
    if (probe && !hitIsInsideOpaqueBlock(view, probe.pos)) return probe.pos;
  }

  if (clientY < blocks[0]!.top) {
    return nearestEditablePos(blocks, 0, -1) ?? blocks[0]!.from;
  }

  const last = blocks[blocks.length - 1]!;
  if (clientY > last.bottom) {
    return nearestEditablePos(blocks, blocks.length - 1, 1) ?? last.to;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (clientY >= block.top && clientY <= block.bottom) {
      if (block.opaque) {
        const mid = (block.top + block.bottom) / 2;
        if (clientY >= mid) {
          return (
            nearestEditablePos(blocks, i, 1) ??
            TextSelection.atEnd(view.state.doc).from
          );
        }
        return (
          nearestEditablePos(blocks, i, -1) ??
          nearestEditablePos(blocks, i, 1) ??
          TextSelection.atEnd(view.state.doc).from
        );
      }
      return posInBlock(block, clientY);
    }
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i]!;
    const next = blocks[i + 1]!;
    if (clientY > cur.bottom && clientY < next.top) {
      const gapMid = (cur.bottom + next.top) / 2;
      if (clientY >= gapMid) {
        return nearestEditablePos(blocks, i, 1) ?? next.from;
      }
      return nearestEditablePos(blocks, i + 1, -1) ?? cur.to;
    }
  }

  let best: { dist: number; pos: number } | null = null;
  for (const block of blocks) {
    if (block.opaque) continue;
    const mid = (block.top + block.bottom) / 2;
    const dist = Math.abs(clientY - mid);
    const pos = posInBlock(block, clientY);
    if (!best || dist < best.dist) best = { dist, pos };
  }
  return best?.pos ?? TextSelection.atEnd(view.state.doc).from;
}

/** True when PM's default click handling would miss or misplace the caret. */
export function needsClickRedirect(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: Element,
): boolean {
  if (isOpaqueChromeClick(target)) return true;

  const blocks = collectBlockRects(view);
  if (blocks.length === 0) return true;

  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  if (clientY < first.top - 2 || clientY > last.bottom + 2) return true;

  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (hit && hitIsInsideOpaqueBlock(view, hit.pos)) return true;
  return hit == null;
}

export function focusEditorAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  event?: Event,
): boolean {
  if (!view.editable) return false;
  const pos = focusPosFromClick(
    view,
    clientX,
    clientY,
    event?.target instanceof Element ? event.target : null,
  );
  if (pos == null) return false;
  event?.preventDefault();
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView();
  view.dispatch(tr);
  view.focus();
  return true;
}

/** Focus the nearest caret for clicks anywhere on the rendered editor surface. */
export function handleEditorSurfaceMouseDown(
  view: EditorView,
  event: MouseEvent,
  root: HTMLElement,
): boolean {
  if (!view.editable || event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!root.contains(target)) return false;
  if (target.closest(".typora-web-source-editor:not([hidden])")) return false;
  if (isInteractiveEditorTarget(target)) return false;

  if (view.dom.contains(target) && !needsClickRedirect(view, event.clientX, event.clientY, target)) {
    return false;
  }

  return focusEditorAtPoint(view, event.clientX, event.clientY, event);
}

function shouldCaptureClick(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!view.dom.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  return needsClickRedirect(view, event.clientX, event.clientY, target);
}

export function clickFocusPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!shouldCaptureClick(view, event)) return false;
          return focusEditorAtPoint(view, event.clientX, event.clientY, event);
        },
      },
    },
  });
}
