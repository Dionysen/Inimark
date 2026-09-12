/** Build-time Lezer highlighting for published fenced code (KaTeX-style). */

import { HighlightStyle } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import type { LanguageSupport } from "@codemirror/language";

import { loadCodeLanguage } from "./code-highlighter.ts";
import { CODE_TOKEN_TAG_CLASSES } from "./code-token-style.ts";

const siteTokenHighlightStyle = HighlightStyle.define(
  CODE_TOKEN_TAG_CLASSES.map(({ tag, class: cls }) => ({ tag, class: cls })),
);

const languageCache = new Map<string, Promise<LanguageSupport | null>>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cachedLoadLanguage(info: string): Promise<LanguageSupport | null> {
  const key = info.trim().toLowerCase();
  let pending = languageCache.get(key);
  if (!pending) {
    pending = loadCodeLanguage(info);
    languageCache.set(key, pending);
  }
  return pending;
}

/**
 * Highlight source into HTML spans (`.tok-*`) using the same Lezer languages
 * as the editor. Falls back to escaped plain text when the language is unknown.
 */
export async function highlightCodeToHtml(
  lang: string,
  source: string,
): Promise<string> {
  if (!source) return "";
  const support = await cachedLoadLanguage(lang);
  if (!support) return escapeHtml(source);

  const tree = support.language.parser.parse(source);
  let html = "";
  let pos = 0;
  highlightTree(tree, siteTokenHighlightStyle, (from, to, classes) => {
    if (from > pos) html += escapeHtml(source.slice(pos, from));
    const cls = classes.trim();
    const chunk = escapeHtml(source.slice(from, to));
    html += cls ? `<span class="${cls}">${chunk}</span>` : chunk;
    pos = to;
  });
  if (pos < source.length) html += escapeHtml(source.slice(pos));
  return html;
}

/** Decode minimal entities produced by static-export escapeHtml. */
export function unescapeHtmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Replace plain `<pre data-lang>…</pre>` fences in exported HTML with
 * Lezer-highlighted markup. Mermaid fences are left untouched.
 */
export async function highlightFencedCodeInHtml(html: string): Promise<string> {
  const fenceRe =
    /<pre(\s+[^>]*?\bdata-lang="([^"]*)"[^>]*)><code>([\s\S]*?)<\/code><\/pre>/gi;
  const matches = [...html.matchAll(fenceRe)];
  if (matches.length === 0) return html;

  const highlightedBodies = await Promise.all(
    matches.map(async (match) => {
      const lang = match[2] ?? "";
      const escapedBody = match[3] ?? "";
      if (!lang || lang.trim().toLowerCase() === "mermaid") return null;
      return highlightCodeToHtml(lang, unescapeHtmlText(escapedBody));
    }),
  );

  const parts: string[] = [];
  let cursor = 0;
  matches.forEach((match, i) => {
    const index = match.index ?? 0;
    const full = match[0]!;
    const attrs = match[1] ?? "";
    const lang = match[2] ?? "";
    parts.push(html.slice(cursor, index));
    cursor = index + full.length;

    const body = highlightedBodies[i];
    if (body == null) {
      parts.push(full);
      return;
    }
    const safeLang = lang.replace(/[^a-zA-Z0-9_+#-]/g, "");
    parts.push(
      `<pre${attrs}><code class="language-${safeLang}">${body}</code></pre>`,
    );
  });
  parts.push(html.slice(cursor));
  return parts.join("");
}
