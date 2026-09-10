import type { SiteConfig } from "@inimark/site-render";
import { DEFAULT_SITE_CONFIG } from "@inimark/site-render";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { joinWorkspacePath } from "../platform/env.ts";

export const PUBLISH_CONFIG_FILE = "publish.config.json";

export type PublishConfig = SiteConfig;

export async function loadPublishConfig(vaultPath: string): Promise<PublishConfig> {
  try {
    const path = joinWorkspacePath(vaultPath, PUBLISH_CONFIG_FILE);
    if (await exists(path)) {
      const raw = await readTextFile(path);
      const saved = JSON.parse(raw) as Partial<PublishConfig>;
      return {
        ...DEFAULT_SITE_CONFIG,
        siteName: vaultPath.split(/[/\\]/).pop() || DEFAULT_SITE_CONFIG.siteName,
        ...saved,
      };
    }
  } catch (e) {
    console.warn("Failed to load publish config:", e);
  }
  return {
    ...DEFAULT_SITE_CONFIG,
    siteName: vaultPath.split(/[/\\]/).pop() || DEFAULT_SITE_CONFIG.siteName,
  };
}

export async function savePublishConfig(
  vaultPath: string,
  config: PublishConfig,
): Promise<void> {
  const path = joinWorkspacePath(vaultPath, PUBLISH_CONFIG_FILE);
  await writeTextFile(path, JSON.stringify(config, null, 2));
}

export async function ensureOutDirParent(outAbs: string): Promise<void> {
  const normalized = outAbs.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx > 0) {
    await mkdir(normalized.slice(0, idx), { recursive: true });
  }
}
