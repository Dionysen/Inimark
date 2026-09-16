import type MarkdownIt from "markdown-it";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";
import { highlightCodeToHtml, mermaidRenderer } from "@inimark/editor";

function fenceLang(token: Token): string {
  return (token.info || "").trim().split(/\s+/)[0] ?? "";
}

function isMermaidFence(token: Token): boolean {
  return fenceLang(token).toLowerCase() === "mermaid";
}

function safeLangId(lang: string): string {
  return lang.replace(/[^a-zA-Z0-9_+#-]/g, "");
}

/**
 * Fence renderer: mermaid → hydrate placeholder; other langs → `data-lang` for Lezer highlight.
 */
export function mermaidPlugin(md: MarkdownIt): void {
  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens: Token[], idx: number, options: MarkdownIt.Options, _env: unknown, self: Renderer) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (isMermaidFence(token)) {
      const source = token.content.replace(/\n$/, "");
      const escaped = md.utils.escapeHtml(source);
      return (
        `<div class="inimark-ai-mermaid">` +
        `<pre class="inimark-ai-mermaid-source"><code>${escaped}</code></pre>` +
        `</div>\n`
      );
    }

    const lang = fenceLang(token);
    const safe = safeLangId(lang);
    if (!safe) {
      return defaultFence(tokens, idx, options, env, self);
    }

    const source = token.content.replace(/\n$/, "");
    const escaped = md.utils.escapeHtml(source);
    return (
      `<pre class="inimark-ai-code" data-lang="${safe}">` +
      `<code class="language-${safe}">${escaped}</code>` +
      `</pre>\n`
    );
  };
}

/**
 * Replace mermaid placeholders with themed SVG (async, skips already rendered).
 * Safe to call after DOMPurify — SVG is inserted via the DOM, not markdown HTML.
 */
export async function hydrateChatMermaid(root: ParentNode): Promise<void> {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(".inimark-ai-mermaid:not([data-rendered])"),
  );
  if (nodes.length === 0) return;

  await Promise.all(
    nodes.map(async (el) => {
      const code = el.querySelector("code")?.textContent ?? "";
      if (!code.trim()) {
        el.dataset.rendered = "1";
        return;
      }
      const result = await mermaidRenderer.render(code);
      el.dataset.rendered = "1";
      if (result.state !== "success") {
        el.classList.add("is-error");
        el.title = result.message;
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "inimark-ai-mermaid-svg";
      wrap.innerHTML = result.svg;
      el.replaceChildren(wrap);
    }),
  );
}

/**
 * Highlight fenced code with the same Lezer languages / `--tw-code-*` colors as the editor.
 */
export async function hydrateChatCode(root: ParentNode): Promise<void> {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>("pre.inimark-ai-code:not([data-highlighted])"),
  );
  if (nodes.length === 0) return;

  await Promise.all(
    nodes.map(async (pre) => {
      const lang = pre.getAttribute("data-lang") ?? "";
      const codeEl = pre.querySelector("code");
      if (!codeEl || !lang) {
        pre.dataset.highlighted = "1";
        return;
      }
      const source = codeEl.textContent ?? "";
      codeEl.innerHTML = await highlightCodeToHtml(lang, source);
      pre.dataset.highlighted = "1";
    }),
  );
}

/** Hydrate mermaid diagrams and fenced-code highlighting after a settled reply. */
export async function hydrateChatRichContent(root: ParentNode): Promise<void> {
  await Promise.all([hydrateChatMermaid(root), hydrateChatCode(root)]);
}
