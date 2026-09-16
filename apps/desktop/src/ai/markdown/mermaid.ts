import type MarkdownIt from "markdown-it";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";
import { mermaidRenderer } from "@inimark/editor";

function isMermaidFence(token: Token): boolean {
  const lang = (token.info || "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return lang === "mermaid";
}

/**
 * Turn ```mermaid fences into hydrate placeholders (source kept until SVG ready).
 */
export function mermaidPlugin(md: MarkdownIt): void {
  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens: Token[], idx: number, options: MarkdownIt.Options, _env: unknown, self: Renderer) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (!isMermaidFence(token)) {
      return defaultFence(tokens, idx, options, env, self);
    }
    const source = token.content.replace(/\n$/, "");
    const escaped = md.utils.escapeHtml(source);
    return (
      `<div class="inimark-ai-mermaid">` +
      `<pre class="inimark-ai-mermaid-source"><code>${escaped}</code></pre>` +
      `</div>\n`
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
