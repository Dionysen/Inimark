import { renderMarkdownToStaticHtml } from "@inimark/editor";
import themesCss from "@dionysen/theme/themes.css?raw";
import widgetsCss from "../../../../packages/editor/src/styles/widgets.css?raw";
import themeTyporaCss from "../../../../packages/editor/src/styles/theme-typora.css?raw";
import katexCss from "katex/dist/katex.min.css?raw";

import {
  DEFAULT_CODE_THEME_PAIR,
  getSystemIsDark,
  loadAppearanceState,
  resolveActiveFromPair,
  resolveAppearanceMode,
} from "../themes/appearance.ts";
import { BUILTIN_THEMES } from "../themes/builtin.ts";
import {
  buildPublishCodeThemeCss,
  parseCodeThemeVariablesFromCss,
} from "../themes/code-bridge.ts";
import { CODE_THEMES } from "../themes/code-themes.ts";
import {
  getCodeThemeCss,
  getCustomThemeCss,
  loadManifest,
  type ThemeManifest,
} from "../themes/custom-theme-manager.ts";
import { builtinThemeLabel } from "../themes/labels.ts";

export type ExportAppearance = "light" | "dark";
export type ExportFormat = "html" | "png" | "pdf";

export interface ExportThemeOption {
  id: string;
  label: string;
}

export interface BuildExportDocumentOptions {
  markdown: string;
  title: string;
  themeId: string;
  appearance: ExportAppearance;
  /** Rewrite image / media src (preview or HTML export). */
  rewriteSrc?: (src: string) => string | null | Promise<string | null>;
  /** When true, convert rewritten local-ish URLs to data URLs where possible. */
  inlineLocalImages?: boolean;
}

export interface ExportDocument {
  html: string;
  bodyHtml: string;
  title: string;
  themeId: string;
  appearance: ExportAppearance;
}

const EXPORT_LAYOUT_CSS = `
html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  /* Theme packs expose --bg-primary / --text-primary (not --inimark-*). */
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a1a);
  font-family: var(--editor-font, var(--inimark-font-ui, system-ui, sans-serif));
}
html[data-appearance="dark"] {
  color-scheme: dark;
}
html[data-appearance="light"] {
  color-scheme: light;
}
.inimark-export-page {
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: 2.5rem 1.75rem 3.5rem;
  background: transparent;
  color: inherit;
}
.inimark-export-page .ProseMirror {
  outline: none;
  min-height: 0;
  color: inherit;
}
.inimark-export-page img {
  max-width: 100%;
  height: auto;
}
`;

async function packAllThemeCss(): Promise<string> {
  const manifests = await loadManifest().catch(() => [] as ThemeManifest[]);
  const customBlocks: string[] = [];
  for (const m of manifests) {
    try {
      const css = await getCustomThemeCss(m.id);
      if (css.trim()) customBlocks.push(css);
    } catch {
      /* skip */
    }
  }
  return [themesCss, ...customBlocks, katexCss, widgetsCss, themeTyporaCss, EXPORT_LAYOUT_CSS].join(
    "\n\n",
  );
}

async function resolveCodeThemeVariables(
  id: string | undefined,
  fallbackId: string,
): Promise<Record<string, string>> {
  const pick = id || fallbackId;
  const builtin = CODE_THEMES.find((t) => t.id === pick);
  if (builtin) return builtin.variables;

  try {
    const css = await getCodeThemeCss(pick);
    const vars = parseCodeThemeVariablesFromCss(css);
    if (Object.keys(vars).length > 0) return vars;
  } catch {
    /* fall through */
  }

  return (
    CODE_THEMES.find((t) => t.id === fallbackId)?.variables ??
    CODE_THEMES[0]!.variables
  );
}

async function packCodeThemeCss(): Promise<string> {
  const state = loadAppearanceState();
  const light = await resolveCodeThemeVariables(
    state.preferredCodeTheme.light,
    DEFAULT_CODE_THEME_PAIR.light,
  );
  const dark = await resolveCodeThemeVariables(
    state.preferredCodeTheme.dark,
    DEFAULT_CODE_THEME_PAIR.dark,
  );
  return buildPublishCodeThemeCss(light, dark);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function maybeInlineDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (!src.startsWith("asset:") && !src.startsWith("blob:") && !src.startsWith("file:")) {
    return src;
  }
  try {
    const res = await fetch(src);
    if (!res.ok) return src;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? src));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

async function rewriteHtmlSrcs(
  html: string,
  rewriteSrc?: BuildExportDocumentOptions["rewriteSrc"],
  inlineLocalImages?: boolean,
): Promise<string> {
  if (!rewriteSrc && !inlineLocalImages) return html;

  const matches = [...html.matchAll(/\bsrc=(["'])([^"']+)\1/gi)];
  if (matches.length === 0) return html;

  let out = html;
  for (const match of matches) {
    const quote = match[1]!;
    const raw = match[2]!;
    let next = raw;
    if (rewriteSrc) {
      const rewritten = await rewriteSrc(raw);
      if (rewritten != null) next = rewritten;
    }
    if (inlineLocalImages) {
      next = await maybeInlineDataUrl(next);
    }
    if (next !== raw) {
      out = out.replace(`src=${quote}${raw}${quote}`, `src=${quote}${next}${quote}`);
    }
  }
  return out;
}

/** List themes available for the export dialog (built-in + custom). */
export async function listExportThemes(): Promise<ExportThemeOption[]> {
  const manifests = await loadManifest().catch(() => [] as ThemeManifest[]);
  return [
    ...BUILTIN_THEMES.map((id) => ({ id, label: builtinThemeLabel(id) })),
    ...manifests.map((m) => ({
      id: `custom-${m.id}`,
      label: m.name,
    })),
  ];
}

/** Defaults from the live editor theme / appearance. */
export function resolveDefaultExportSelection(): {
  themeId: string;
  appearance: ExportAppearance;
} {
  const state = loadAppearanceState();
  const appearance = resolveAppearanceMode(
    state.appearanceMode,
    getSystemIsDark(),
  ) as ExportAppearance;
  const themeId = resolveActiveFromPair(state.preferredAppTheme, appearance);
  return { themeId, appearance };
}

export async function buildExportDocument(
  options: BuildExportDocumentOptions,
): Promise<ExportDocument> {
  const rendered = await renderMarkdownToStaticHtml(options.markdown);

  let bodyHtml = rendered.html;
  bodyHtml = await rewriteHtmlSrcs(
    bodyHtml,
    options.rewriteSrc,
    options.inlineLocalImages,
  );

  const [themeCss, codeCss] = await Promise.all([
    packAllThemeCss(),
    packCodeThemeCss(),
  ]);

  const title = options.title.trim() || "Untitled";
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${escapeHtml(options.themeId)}" data-appearance="${options.appearance}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
${themeCss}

${codeCss}
</style>
</head>
<body>
<main class="inimark-export-page">
<article class="ProseMirror">${bodyHtml}</article>
</main>
</body>
</html>`;

  return {
    html,
    bodyHtml,
    title,
    themeId: options.themeId,
    appearance: options.appearance,
  };
}
