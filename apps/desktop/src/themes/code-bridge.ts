/** Map --hljs-* code theme vars to editor --tw-code-* vars. */

const HLJS_TO_TW: Record<string, string> = {
  "--hljs-keyword": "--tw-code-keyword",
  "--hljs-string": "--tw-code-string",
  "--hljs-comment": "--tw-code-comment",
  "--hljs-number": "--tw-code-literal",
  "--hljs-built_in": "--tw-code-function",
};

function deriveTwVars(hljs: Record<string, string>): Record<string, string> {
  const tw: Record<string, string> = {};
  for (const [hljsName, value] of Object.entries(hljs)) {
    const mapped = HLJS_TO_TW[hljsName];
    if (mapped) tw[mapped] = value;
  }
  // Tokens without a 1:1 hljs source — derive so CodeMirror highlighting is complete.
  tw["--tw-code-type"] ??= tw["--tw-code-keyword"] ?? "#0f766e";
  tw["--tw-code-function"] ??= "#2468a2";
  tw["--tw-code-name"] ??= "inherit";
  tw["--tw-code-punctuation"] ??= tw["--tw-code-comment"] ?? "#6f6a64";
  tw["--tw-code-meta"] ??= tw["--tw-code-comment"] ?? "#77736c";
  tw["--tw-code-invalid"] ??= "#b42318";
  return tw;
}

/** Expand a CSS blob that defines --hljs-* into a :root block with --tw-code-* too. */
export function expandCodeThemeCss(hljsCss: string): string {
  const vars: Record<string, string> = {};
  for (const match of hljsCss.matchAll(/(--hljs-[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) vars[name] = value.trim();
  }
  if (Object.keys(vars).length === 0) return hljsCss;
  return buildCodeThemeStyleContent(vars);
}

export function buildCodeThemeStyleContent(variables: Record<string, string>): string {
  const hljs: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    if (k.startsWith("--hljs-")) hljs[k] = v;
  }
  const tw = deriveTwVars(hljs);
  const lines = [
    ...Object.entries(hljs).map(([k, v]) => `  ${k}: ${v};`),
    ...Object.entries(tw).map(([k, v]) => `  ${k}: ${v};`),
  ];
  return `:root {\n${lines.join("\n")}\n}`;
}
