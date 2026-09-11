import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { SiteBuildResult } from "./types.ts";
import { normalizeSlashes } from "./paths.ts";

function assertSafeRel(path: string): string {
  const normalized = normalizeSlashes(path);
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes(":") ||
    normalized.split("/").some((seg) => seg === ".." || seg === "")
  ) {
    throw new Error(`Invalid relative site path: ${path}`);
  }
  return normalized;
}

/**
 * Write a `buildSite` result to disk (Node equivalent of Rust `write_site`).
 * When `clean` is true, the output directory is removed first.
 */
export async function writeSiteToFs(
  outDir: string,
  built: SiteBuildResult,
  options?: { clean?: boolean },
): Promise<void> {
  const clean = options?.clean !== false;
  if (clean) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  for (const file of built.files) {
    const rel = assertSafeRel(file.path);
    const dest = join(outDir, ...rel.split("/"));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.content, "utf8");
  }

  for (const media of built.media) {
    try {
      const rel = assertSafeRel(media.to);
      const dest = join(outDir, ...rel.split("/"));
      await mkdir(dirname(dest), { recursive: true });
      await cp(media.from, dest);
    } catch (err) {
      console.warn(`[site-render] skip media ${media.to}:`, err);
    }
  }

  // GitHub Pages: do not run Jekyll on the exported HTML.
  await writeFile(join(outDir, ".nojekyll"), "", "utf8");
}
