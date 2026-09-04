/** Map --hljs-* code theme vars to editor --tw-code-* vars. */

const HLJS_TO_TW: Record<string, string> = {
  "--hljs-keyword": "--tw-code-keyword",
  "--hljs-string": "--tw-code-string",
  "--hljs-comment": "--tw-code-comment",
  "--hljs-number": "--tw-code-literal",
  "--hljs-built_in": "--tw-code-function",
};

export function expandCodeThemeCss(hljsCss: string): string {
  const vars = [...hljsCss.matchAll(/(--hljs-[\w-]+)\s*:\s*([^;]+);/g)];
  const twLines = vars
    .map(([name, value]) => {
      const tw = HLJS_TO_TW[name];
      return tw ? `  ${tw}: ${value.trim()};` : "";
    })
    .filter(Boolean);
  if (twLines.length === 0) return hljsCss;
  return `${hljsCss.trim()}\n:root {\n${twLines.join("\n")}\n}`;
}

export function buildCodeThemeStyleContent(variables: Record<string, string>): string {
  const hljsLines = Object.entries(variables)
    .filter(([k]) => k.startsWith("--hljs-"))
    .map(([k, v]) => `  ${k}: ${v};`);
  const twLines = Object.entries(variables)
    .filter(([k]) => k.startsWith("--hljs-"))
    .map(([k, v]) => {
      const tw = HLJS_TO_TW[k];
      return tw ? `  ${tw}: ${v};` : "";
    })
    .filter(Boolean);
  return `:root {\n${hljsLines.join("\n")}\n${twLines.join("\n")}\n}`;
}
