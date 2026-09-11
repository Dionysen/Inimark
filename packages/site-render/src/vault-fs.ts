import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type { ManifestNode, SiteConfig } from "./types.ts";
import { DEFAULT_SITE_CONFIG } from "./types.ts";
import { normalizeSlashes } from "./paths.ts";

const SKIP_DIR_NAMES = new Set([
  ".git",
  ".obsidian",
  ".inimark",
  "node_modules",
  "dist",
]);

const MD_EXT = /\.(md|markdown|mdown)$/i;

export interface VaultNoteFile {
  /** Vault-relative path with forward slashes. */
  path: string;
  markdown: string;
}

export interface LoadedVault {
  notes: VaultNoteFile[];
  tree: ManifestNode[];
  /** Resolve wiki note name → vault-relative markdown path. */
  resolveNotePath: (noteName: string) => string | null;
  config: SiteConfig;
}

function pathToNoteName(relativePath: string): string {
  return normalizeSlashes(relativePath).replace(MD_EXT, "");
}

function isMarkdownFile(name: string): boolean {
  return MD_EXT.test(name);
}

/**
 * Build a note-name → path map using the same basename preference as the
 * desktop link index (shallower paths win on case-insensitive ties).
 */
export function createNotePathResolver(
  notePaths: string[],
): (noteName: string) => string | null {
  const fileByName = new Map<string, string>();

  for (const raw of notePaths) {
    const path = normalizeSlashes(raw);
    const noteName = pathToNoteName(path);
    const existing = fileByName.get(noteName);
    if (!existing || path.length < existing.length) {
      fileByName.set(noteName, path);
    }
  }

  return (noteName: string): string | null => {
    const exact = fileByName.get(noteName);
    if (exact) return exact;

    const lower = noteName.toLowerCase();
    let bestPath: string | undefined;
    let bestDepth = Infinity;
    for (const [key, path] of fileByName) {
      const basename = key.split("/").pop()?.toLowerCase();
      if (basename === lower || key.toLowerCase() === lower) {
        const depth = key.split("/").length;
        if (depth < bestDepth) {
          bestDepth = depth;
          bestPath = path;
        }
      }
    }
    return bestPath ?? null;
  };
}

async function walkDir(
  absDir: string,
  vaultRoot: string,
  outRel: string,
): Promise<{ files: string[]; tree: ManifestNode[] }> {
  const entries = await readdir(absDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const files: string[] = [];
  const tree: ManifestNode[] = [];
  const outNorm = outRel.replace(/\/$/, "");

  for (const entry of entries) {
    const abs = join(absDir, entry.name);
    const rel = normalizeSlashes(relative(vaultRoot, abs));

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (rel === outNorm || rel.startsWith(`${outNorm}/`)) continue;
      const child = await walkDir(abs, vaultRoot, outRel);
      files.push(...child.files);
      tree.push({
        name: entry.name,
        path: rel,
        kind: "directory",
        children: child.tree,
      });
      continue;
    }

    if (!entry.isFile() || !isMarkdownFile(entry.name)) continue;
    if (rel === outNorm || rel.startsWith(`${outNorm}/`)) continue;
    if (rel.split("/").some((p) => SKIP_DIR_NAMES.has(p))) continue;

    files.push(rel);
    tree.push({ name: entry.name, path: rel, kind: "file" });
  }

  return { files, tree };
}

/** Load `publish.config.json` from a vault root (falls back to defaults). */
export async function loadPublishConfig(vaultRoot: string): Promise<SiteConfig> {
  const configPath = join(vaultRoot, "publish.config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const saved = JSON.parse(raw) as Partial<SiteConfig>;
    return {
      ...DEFAULT_SITE_CONFIG,
      siteName: vaultRoot.split(/[/\\]/).pop() || DEFAULT_SITE_CONFIG.siteName,
      ...saved,
    };
  } catch {
    return {
      ...DEFAULT_SITE_CONFIG,
      siteName: vaultRoot.split(/[/\\]/).pop() || DEFAULT_SITE_CONFIG.siteName,
    };
  }
}

/** Read all publishable markdown notes and the sidebar tree from a vault folder. */
export async function loadVaultFromFs(vaultRoot: string): Promise<LoadedVault> {
  const rootStat = await stat(vaultRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`Vault path is not a directory: ${vaultRoot}`);
  }

  const config = await loadPublishConfig(vaultRoot);
  const outRel = normalizeSlashes(config.out || "dist");
  const { files, tree } = await walkDir(vaultRoot, vaultRoot, outRel);

  if (!files.length) {
    throw new Error(`No markdown notes found under ${vaultRoot}`);
  }

  const notes: VaultNoteFile[] = [];
  for (const rel of files) {
    const markdown = await readFile(join(vaultRoot, ...rel.split("/")), "utf8");
    notes.push({ path: rel, markdown });
  }

  return {
    notes,
    tree,
    resolveNotePath: createNotePathResolver(files),
    config,
  };
}
