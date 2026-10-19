import MarkdownIt from "markdown-it";
import DOMPurify from "isomorphic-dompurify";

import { calloutsPlugin } from "./markdown/callouts.ts";
import { mathPlugin } from "./markdown/math.ts";
import { hydrateChatRichContent, mermaidPlugin } from "./markdown/mermaid.ts";
import { taskListsPlugin } from "./markdown/task-lists.ts";
import { wikiLinksPlugin } from "./markdown/wiki-links.ts";

export { hydrateChatMermaid, hydrateChatCode, hydrateChatRichContent } from "./markdown/mermaid.ts";
export { handleChatLinkClick } from "./markdown/link-click.ts";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

md.use(taskListsPlugin);
md.use(calloutsPlugin);
md.use(mathPlugin);
md.use(mermaidPlugin);
md.use(wikiLinksPlugin);

/** Render assistant markdown to sanitized HTML for the chat panel. */
export function renderChatMarkdown(source: string): string {
  const dirty = md.render(source || "");
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "data-checked",
      "data-alert",
      "data-math-state",
      "data-note",
      "data-heading",
      "data-unresolved",
      "data-embed",
      "data-lang",
    ],
  });
}

/**
 * Patch a chat markdown host (bubble, thinking body, tool body) when `source` changes.
 * Skips DOM work when the source string is unchanged.
 */
export function syncChatMarkdownElement(
  host: HTMLElement,
  source: string,
  opts?: { hydrate?: boolean },
): void {
  if (host.dataset.mdSource === source) return;
  host.dataset.mdSource = source;
  const html = renderChatMarkdown(source);
  host.dataset.md = html;
  host.innerHTML = html;
  if (opts?.hydrate !== false) void hydrateChatRichContent(host);
}
