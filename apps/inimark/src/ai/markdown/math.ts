import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import { renderMathToHtml } from "@inimark/editor";

function isEscaped(src: string, pos: number): boolean {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src[i] === "\\"; i--) count++;
  return count % 2 === 1;
}

/**
 * Block math: `$$` on its own line (multi-line body) or same-line `$$...$$`.
 */
function mathBlockRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  const line = state.src.slice(start, max).trim();

  // Same-line display math: $$ tex $$
  const sameLine = /^\$\$([\s\S]+?)\$\$$/.exec(line);
  if (sameLine && sameLine[1]!.trim()) {
    if (silent) return true;
    const token = state.push("math_block", "div", 0);
    token.block = true;
    token.content = sameLine[1]!.trim();
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  if (line !== "$$") return false;
  if (silent) return true;

  let nextLine = startLine + 1;
  let content = "";
  let found = false;
  for (; nextLine < endLine; nextLine++) {
    const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
    const lineMax = state.eMarks[nextLine]!;
    const raw = state.src.slice(lineStart, lineMax);
    if (raw.trim() === "$$") {
      found = true;
      break;
    }
    content += raw;
    if (nextLine < endLine - 1) content += "\n";
  }
  if (!found) return false;

  const token = state.push("math_block", "div", 0);
  token.block = true;
  token.content = content.replace(/\n$/, "");
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
}

/** Inline math: `$tex$` with no leading/trailing spaces inside. */
function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const { src, pos, posMax } = state;
  if (src[pos] !== "$" || src[pos + 1] === "$" || isEscaped(src, pos)) return false;

  let end = -1;
  for (let i = pos + 1; i < posMax; i++) {
    if (src[i] !== "$" || isEscaped(src, i)) continue;
    if (src[i + 1] === "$") continue;
    end = i;
    break;
  }
  if (end < 0) return false;

  const inner = src.slice(pos + 1, end);
  if (!inner || /^\s|\s$/.test(inner)) return false;

  if (!silent) {
    const token = state.push("math_inline", "span", 0);
    token.content = inner;
    token.markup = "$";
  }
  state.pos = end + 1;
  return true;
}

/** KaTeX-backed `$...$` / `$$...$$` for the AI chat markdown pipeline. */
export function mathPlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "inimark-ai-math-block", mathBlockRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.inline.ruler.before("escape", "inimark-ai-math-inline", mathInlineRule);

  md.renderer.rules.math_block = (tokens, idx) => {
    const result = renderMathToHtml(tokens[idx]!.content, true, { output: "html" });
    const state = result.ok ? "success" : "error";
    return `<div class="inimark-ai-math inimark-ai-math--block" data-math-state="${state}">${result.html}</div>\n`;
  };

  md.renderer.rules.math_inline = (tokens, idx) => {
    const result = renderMathToHtml(tokens[idx]!.content, false, { output: "html" });
    const state = result.ok ? "success" : "error";
    return `<span class="inimark-ai-math inimark-ai-math--inline" data-math-state="${state}">${result.html}</span>`;
  };
}
