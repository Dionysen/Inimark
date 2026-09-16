import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type Token from "markdown-it/lib/token.mjs";

/** GFM task marker at the start of a list-item paragraph (`[ ]` / `[x]`). */
const TASK_RE = /^\[([ xX])\][ \t]+/;

/**
 * Turn `- [ ]` / `- [x]` list items into checkbox-styled task rows.
 * Visual-only (no toggle) — chat messages stay immutable.
 */
export function taskListsPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "inimark-ai-task-lists", (state: StateCore) => {
    const { tokens } = state;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "list_item_open") continue;

      const inline = tokens[i + 2];
      if (!inline || inline.type !== "inline" || !inline.content) continue;

      const match = TASK_RE.exec(inline.content);
      if (!match) continue;

      const checked = match[1] !== " ";
      tokens[i].attrJoin("class", "inimark-ai-task");
      markParentTaskList(tokens, i);

      stripTaskMarker(inline, match[0].length);
      const checkbox = new state.Token("html_inline", "", 0);
      checkbox.content = `<span class="inimark-ai-checkbox" data-checked="${checked ? "1" : "0"}" aria-hidden="true"></span>`;
      inline.children = inline.children ?? [];
      inline.children.unshift(checkbox);
    }
  });
}

function markParentTaskList(tokens: Token[], itemIndex: number): void {
  for (let j = itemIndex - 1; j >= 0; j--) {
    if (tokens[j].type === "bullet_list_open") {
      const existing = tokens[j].attrGet("class") ?? "";
      if (!/\binimark-ai-task-list\b/.test(existing)) {
        tokens[j].attrJoin("class", "inimark-ai-task-list");
      }
      return;
    }
    if (tokens[j].type === "bullet_list_close") return;
  }
}

function stripTaskMarker(inline: Token, markerLen: number): void {
  inline.content = inline.content.slice(markerLen);
  const first = inline.children?.[0];
  if (!first || first.type !== "text") return;
  const nested = TASK_RE.exec(first.content);
  if (nested) {
    first.content = first.content.slice(nested[0].length);
    return;
  }
  if (first.content.length >= markerLen) {
    first.content = first.content.slice(markerLen);
  }
}
