import { invoke } from "@tauri-apps/api/core";
import {
  buildSite,
  type ManifestNode,
  type SiteBuildResult,
  type SiteConfig,
} from "@inimark/site-render";

import themesCss from "../styles/themes.css?raw";
import widgetsCss from "../../../../packages/editor/src/styles/widgets.css?raw";
import themeTyporaCss from "../../../../packages/editor/src/styles/theme-typora.css?raw";
import katexCss from "katex/dist/katex.min.css?raw";
import mermaidRuntimeJs from "mermaid/dist/mermaid.min.js?raw";

import { BUILTIN_THEMES, DEFAULT_DARK_BUILTIN } from "../themes/builtin.ts";
import {
  getCustomThemeCss,
  loadManifest,
} from "../themes/custom-theme-manager.ts";
import { loadAppearanceState, resolveActiveFromPair, resolveAppearanceMode } from "../themes/appearance.ts";
import { isMarkdownFile, joinWorkspacePath } from "../platform/env.ts";
import type { Workspace, WorkspaceTreeNode } from "../platform/types.ts";
import { openWorkspaceByPath, readWorkspaceFile } from "../platform/workspace.ts";
import { collectMarkdownFiles } from "../sidebar/vault-search.ts";
import { linkIndex } from "../wikilink/link-index.ts";
import { buildLinkIndexForWorkspace } from "../wikilink/build-index.ts";
import { ensureOutDirParent, type PublishConfig } from "./config.ts";

export interface PublishProgress {
  phase: "indexing" | "rendering" | "writing" | "done";
  current: number;
  total: number;
  message: string;
}

const SKIP_DIR_NAMES = new Set([
  ".git",
  ".obsidian",
  ".inimark",
  "node_modules",
  "dist",
]);

function filterTree(
  nodes: WorkspaceTreeNode[],
  outRel: string,
): ManifestNode[] {
  const outNorm = outRel.replace(/\\/g, "/").replace(/\/$/, "");
  const result: ManifestNode[] = [];
  for (const node of nodes) {
    const path = node.path.replace(/\\/g, "/");
    if (node.kind === "directory") {
      const name = node.name;
      if (SKIP_DIR_NAMES.has(name)) continue;
      if (path === outNorm || path.startsWith(`${outNorm}/`)) continue;
      result.push({
        name: node.name,
        path,
        kind: "directory",
        children: filterTree(node.children ?? [], outRel),
      });
      continue;
    }
    if (!isMarkdownFile(node.name)) continue;
    if (path === outNorm || path.startsWith(`${outNorm}/`)) continue;
    result.push({ name: node.name, path, kind: "file" });
  }
  return result;
}

async function packThemeCss(): Promise<{ css: string; themeIds: string[] }> {
  const manifests = await loadManifest().catch(() => []);
  const customBlocks: string[] = [];
  const themeIds: string[] = [...BUILTIN_THEMES];
  for (const m of manifests) {
    const id = `custom-${m.id}`;
    themeIds.push(id);
    try {
      const css = await getCustomThemeCss(m.id);
      if (css.trim()) customBlocks.push(css);
    } catch {
      /* skip */
    }
  }
  const css = [themesCss, ...customBlocks, katexCss].join("\n\n");
  return { css, themeIds };
}

export async function publishLibrary(
  vaultPath: string,
  config: PublishConfig,
  onProgress?: (p: PublishProgress) => void,
): Promise<{ outDir: string; pageCount: number }> {
  onProgress?.({
    phase: "indexing",
    current: 0,
    total: 0,
    message: "Opening library…",
  });

  const opened = await openWorkspaceByPath(vaultPath);
  if (opened.status !== "picked") {
    throw new Error("Could not open library for publish.");
  }
  const workspace: Workspace = opened.workspace;

  onProgress?.({
    phase: "indexing",
    current: 0,
    total: 0,
    message: "Building link index…",
  });
  await buildLinkIndexForWorkspace(workspace);

  const outRel = (config.out || "dist").replace(/\\/g, "/");
  const tree = filterTree(workspace.tree, outRel);

  const mdFromWorkspace = collectMarkdownFiles(workspace.tree).filter((f) => {
    const path = f.path.replace(/\\/g, "/");
    if (!isMarkdownFile(f.name)) return false;
    if (path === outRel || path.startsWith(`${outRel}/`)) return false;
    const parts = path.split("/");
    return !parts.some((p) => SKIP_DIR_NAMES.has(p));
  });

  onProgress?.({
    phase: "rendering",
    current: 0,
    total: mdFromWorkspace.length,
    message: "Reading notes…",
  });

  const notes: { path: string; markdown: string }[] = [];
  for (let i = 0; i < mdFromWorkspace.length; i++) {
    const file = mdFromWorkspace[i]!;
    onProgress?.({
      phase: "rendering",
      current: i + 1,
      total: mdFromWorkspace.length,
      message: file.path,
    });
    const result = await readWorkspaceFile(workspace, file.path);
    if (result.status === "opened") {
      notes.push({ path: file.path.replace(/\\/g, "/"), markdown: result.text });
    }
  }

  if (!notes.length) {
    throw new Error("No markdown notes found to publish.");
  }

  const appearance = loadAppearanceState();
  const resolved = resolveAppearanceMode(appearance.appearanceMode);
  const preferred = resolveActiveFromPair(appearance.preferredAppTheme, resolved);
  const { css: themeVariablesCss, themeIds } = await packThemeCss();

  const lightTheme =
    config.lightTheme && themeIds.includes(config.lightTheme)
      ? config.lightTheme
      : themeIds.includes("light")
        ? "light"
        : themeIds[0]!;
  const darkTheme =
    config.darkTheme && themeIds.includes(config.darkTheme)
      ? config.darkTheme
      : themeIds.includes(DEFAULT_DARK_BUILTIN)
        ? DEFAULT_DARK_BUILTIN
        : themeIds[themeIds.length - 1]!;
  const defaultTheme =
    config.defaultTheme && themeIds.includes(config.defaultTheme)
      ? config.defaultTheme
      : resolved === "dark"
        ? darkTheme
        : preferred && themeIds.includes(preferred)
          ? preferred
          : lightTheme;

  const siteConfig: SiteConfig = {
    ...config,
    lightTheme,
    darkTheme,
    defaultTheme,
  };

  onProgress?.({
    phase: "rendering",
    current: notes.length,
    total: notes.length,
    message: "Rendering HTML…",
  });

  const built: SiteBuildResult = await buildSite({
    config: siteConfig,
    notes,
    tree,
    resolveNotePath: (noteName) => linkIndex.findFileByNoteName(noteName) ?? null,
    resolveMediaAbsolutePath: (path) => {
      const normalized = path.replace(/\\/g, "/");
      if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
        return normalized;
      }
      return joinWorkspacePath(vaultPath, path);
    },
    themeVariablesCss,
    editorWidgetsCss: widgetsCss,
    editorThemeCss: themeTyporaCss,
    themeIds,
    mermaidRuntimeJs,
  });

  const outDir = joinWorkspacePath(vaultPath, built.outRelative);
  await ensureOutDirParent(outDir);

  onProgress?.({
    phase: "writing",
    current: 0,
    total: built.files.length + built.media.length,
    message: "Writing site…",
  });

  await invoke<string>("publish_write_site", {
    request: {
      outDir,
      files: built.files,
      media: built.media,
      clean: true,
    },
  });

  onProgress?.({
    phase: "done",
    current: 1,
    total: 1,
    message: "Done",
  });

  return { outDir, pageCount: built.pageCount };
}

export async function startSitePreview(outDir: string): Promise<string> {
  return invoke<string>("publish_start_preview", { dir: outDir });
}

export async function stopSitePreview(): Promise<void> {
  await invoke("publish_stop_preview");
}
