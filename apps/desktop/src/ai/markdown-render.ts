import MarkdownIt from "markdown-it";
import DOMPurify from "isomorphic-dompurify";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** Render assistant markdown to sanitized HTML for the chat panel. */
export function renderChatMarkdown(source: string): string {
  const dirty = md.render(source || "");
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
  });
}
