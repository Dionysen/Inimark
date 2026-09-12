/** Resolve monorepo docs vault paths for Dev → Publish Docs. */

/** Repo root is the parent of the `docs/` vault directory. */
export function repoRootFromDocsVault(docsVaultPath: string): string {
  const normalized = docsVaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  return normalized.slice(0, idx);
}

/** Join vault-relative out dir onto an absolute docs vault path. */
export function docsDistDir(docsVaultPath: string, outRel = "dist"): string {
  const root = docsVaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const out = outRel.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || "dist";
  return `${root}/${out}`;
}
