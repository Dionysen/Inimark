// Static HTML export from a read-only ProseMirror view — keeps reading-mode
// widgets (wiki, images, math, tasks) while stripping method-B source chrome.

import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { documentMetadataPlugin } from "./document-metadata.ts";
import { syntaxHintsPlugin } from "./decorations.ts";
import { collectPlugins } from "./features/index.ts";
import { normalizeInlinePlugin } from "./normalize.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export interface StaticExportOptions {
  /** Rewrite image / media src attributes (return null to leave unchanged). */
  rewriteSrc?: (src: string) => string | null;
  /** Turn wiki widgets into links. */
  resolveWikiHref?: (
    note: string,
    heading?: string,
  ) => { href: string; unresolved?: boolean } | null;
}

export interface StaticExportResult {
  html: string;
  outline: OutlineItem[];
  /** Relative / local src values discovered on images. */
  assetSrcs: string[];
}

const HIDDEN_CLASSES = new Set([
  "syntax-hidden",
  "math-source-hidden",
  "task-marker-hidden",
  "play-caret",
  "selection-marker",
  "ProseMirror-trailingBreak",
  "cb-lang-input",
  "cb-toolbar",
  "file-input",
  "typora-web-code-editor",
]);

function slugify(text: string, used: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-|-$/g, "") || "heading";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function isElement(n: Node): n is Element {
  return n.nodeType === 1;
}

function isText(n: Node): n is Text {
  return n.nodeType === 3;
}

function shouldDrop(el: Element): boolean {
  for (const cls of HIDDEN_CLASSES) {
    if (el.classList.contains(cls)) return true;
  }
  if (el.tagName === "BR" && el.classList.contains("ProseMirror-trailingBreak")) {
    return true;
  }
  return false;
}

function serializeChildren(
  el: Element,
  options: StaticExportOptions,
  assetSrcs: string[],
  outline: OutlineItem[],
  slugUsed: Map<string, number>,
): string {
  return Array.from(el.childNodes)
    .map((child) => serializeNode(child, options, assetSrcs, outline, slugUsed))
    .join("");
}

function serializeFencedCode(el: Element): string {
  const code = el.querySelector(".pm-code-content");
  const pre = el.querySelector("pre.code-source-frame, pre");
  const lang =
    pre?.getAttribute("data-lang") ||
    el.getAttribute("data-lang") ||
    "";
  const text = code?.textContent ?? el.textContent ?? "";
  // Published sites hydrate Mermaid in the browser (headless export DOM cannot
  // produce SVG). Keep source in <pre class="mermaid"> for mermaid.run().
  if (lang.trim().toLowerCase() === "mermaid") {
    return (
      `<div class="code-block-node has-diagram diagram-pending" data-lang="mermaid">` +
      `<div class="diagram-panel" data-diagram-state="pending">` +
      `<pre class="mermaid">${escapeHtml(text)}</pre>` +
      `</div></div>`
    );
  }
  const langAttr = lang ? ` data-lang="${escapeAttr(lang)}"` : "";
  return `<pre${langAttr}><code>${escapeHtml(text)}</code></pre>`;
}

function serializeNode(
  node: Node,
  options: StaticExportOptions,
  assetSrcs: string[],
  outline: OutlineItem[],
  slugUsed: Map<string, number>,
): string {
  if (isText(node)) return escapeHtml(node.data);
  if (!isElement(node)) return "";
  const el = node;
  if (shouldDrop(el)) return "";

  // Front matter is used for site metadata only — omit from published body.
  if (el.tagName.toLowerCase() === "yaml-block") return "";

  // Fenced code: Mermaid → client-hydrated diagram; other langs → <pre><code>
  if (el.classList.contains("code-block-node")) {
    return serializeFencedCode(el);
  }

  // Wiki link widget → <a>
  if (el.classList.contains("wiki-link-widget")) {
    const note = el.getAttribute("data-note") ?? "";
    const heading = el.getAttribute("data-heading") || undefined;
    const label = el.textContent ?? note;
    const resolved = options.resolveWikiHref?.(note, heading) ?? null;
    const unresolved =
      resolved?.unresolved === true ||
      el.classList.contains("is-unresolved") ||
      el.getAttribute("data-unresolved") === "1" ||
      !resolved;
    const cls =
      "wiki-link-widget" + (unresolved ? " is-unresolved" : "");
    if (!resolved || unresolved) {
      return `<span class="${cls}" data-note="${escapeAttr(note)}">${escapeHtml(label)}</span>`;
    }
    const hash = heading ? `#${escapeAttr(slugifyHeadingId(heading))}` : "";
    const href = resolved.href.includes("#")
      ? resolved.href
      : `${resolved.href}${hash}`;
    return `<a class="${cls}" href="${escapeAttr(href)}" data-note="${escapeAttr(note)}">${escapeHtml(label)}</a>`;
  }

  // Wiki embed note → link card
  if (el.classList.contains("wiki-embed-note")) {
    const note = el.getAttribute("data-note") ?? "";
    const title =
      el.querySelector(".wiki-embed-note-title")?.textContent ?? note;
    const resolved = options.resolveWikiHref?.(note) ?? null;
    if (!resolved || resolved.unresolved) {
      return `<div class="wiki-embed-note is-unresolved" data-note="${escapeAttr(note)}"><div class="wiki-embed-note-title">${escapeHtml(title)}</div></div>`;
    }
    return `<div class="wiki-embed-note" data-note="${escapeAttr(note)}"><a class="wiki-embed-note-title" href="${escapeAttr(resolved.href)}">${escapeHtml(title)}</a></div>`;
  }

  if (el.tagName === "IMG") {
    let src = el.getAttribute("src") ?? "";
    const rewritten = options.rewriteSrc?.(src);
    if (rewritten != null) src = rewritten;
    if (src && !/^https?:\/\//i.test(src) && !src.startsWith("data:")) {
      assetSrcs.push(src);
    }
    const alt = el.getAttribute("alt") ?? "";
    const title = el.getAttribute("title");
    const cls = el.getAttribute("class") ?? "";
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    const classAttr = cls ? ` class="${escapeAttr(cls)}"` : "";
    return `<img${classAttr} src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${titleAttr}>`;
  }

  // Headings: add stable ids for outline
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = (el.textContent ?? "").trim();
    const id = el.id || slugify(text, slugUsed);
    outline.push({ id, level, text });
    const inner = serializeChildren(el, options, assetSrcs, outline, slugUsed);
    // Avoid double-counting outline from nested walks — we already pushed.
    // Children of headings shouldn't add more outline entries from nested hs.
    return `<${tag} id="${escapeAttr(id)}">${inner}</${tag}>`;
  }

  // Skip ProseMirror chrome wrappers that aren't content
  if (el.classList.contains("diagram-panel") && !el.querySelector("svg")) {
    return "";
  }

  const voidTags = new Set(["hr", "br", "img", "input"]);
  if (voidTags.has(tag)) {
    return `<${tag}>`;
  }

  // Preserve useful attributes
  const keepAttrs = ["href", "title", "start", "colspan", "rowspan", "style", "data-checked", "data-alert", "data-lang", "data-tex", "data-math-state", "data-note", "data-alert-source"];
  const attrs: string[] = [];
  const className = el.getAttribute("class");
  if (className) {
    const cleaned = className
      .split(/\s+/)
      .filter(
        (c) =>
          c &&
          c !== "ProseMirror-widget" &&
          c !== "ProseMirror-selectednode" &&
          !c.startsWith("ProseMirror-"),
      )
      .join(" ");
    if (cleaned) attrs.push(`class="${escapeAttr(cleaned)}"`);
  }
  for (const name of keepAttrs) {
    const v = el.getAttribute(name);
    if (v != null) {
      let value = v;
      if (name === "href" || name === "src") {
        const rewritten = options.rewriteSrc?.(v);
        if (rewritten != null) value = rewritten;
      }
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  // checkbox data
  if (el.classList.contains("checkbox") && !el.getAttribute("data-checked")) {
    attrs.push(`data-checked="0"`);
  }

  const attrStr = attrs.length ? " " + attrs.join(" ") : "";
  const inner = serializeChildren(el, options, assetSrcs, outline, slugUsed);
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

function slugifyHeadingId(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-|-$/g, "") || "heading";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Render markdown to static reading-mode HTML using the live editor pipeline.
 * Must run in a DOM environment (browser / happy-dom).
 * Mermaid fences are emitted for client-side hydration on the published site.
 */
export function renderMarkdownToStaticHtml(
  markdown: string,
  options: StaticExportOptions = {},
): StaticExportResult {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "800px";
  document.body.appendChild(host);

  try {
    const doc = markdown ? parse(markdown) : schema.nodes.doc.createAndFill()!;
    const base = EditorState.create({
      schema,
      doc,
      plugins: [
        documentMetadataPlugin(),
        normalizeInlinePlugin(),
        ...collectPlugins(schema),
        syntaxHintsPlugin(),
      ],
    });
    const state = base.apply(base.tr.setSelection(TextSelection.atEnd(doc)));
    const view = new EditorView(host, {
      state,
      editable: () => false,
      attributes: { class: "ProseMirror site-export-prose", spellcheck: "false" },
    });

    const assetSrcs: string[] = [];
    const outline: OutlineItem[] = [];
    const slugUsed = new Map<string, number>();
    const html = serializeChildren(
      view.dom,
      options,
      assetSrcs,
      outline,
      slugUsed,
    );
    view.destroy();

    return {
      html,
      outline,
      assetSrcs: [...new Set(assetSrcs)],
    };
  } finally {
    host.remove();
  }
}
