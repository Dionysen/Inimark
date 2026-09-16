import MarkdownIt from "markdown-it";
import DOMPurify from "isomorphic-dompurify";

import { calloutsPlugin } from "./markdown/callouts.ts";
import { taskListsPlugin } from "./markdown/task-lists.ts";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

md.use(taskListsPlugin);
md.use(calloutsPlugin);

/** Render assistant markdown to sanitized HTML for the chat panel. */
export function renderChatMarkdown(source: string): string {
  const dirty = md.render(source || "");
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["data-checked", "data-alert"],
  });
}
