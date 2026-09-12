/**
 * Node-only loader for the marketing landing overlay.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  loadMarketingLandingBundle,
  type MarketingLandingBundle,
} from "./landing.ts";

export interface LoadMarketingLandingFromFsOptions {
  /** Absolute vault root (e.g. `…/docs`). */
  vaultPath: string;
  /** Version injected into the landing HTML. */
  version: string;
  /**
   * Optional absolute path to a fallback icon when `landing/icon.png` is missing.
   */
  fallbackIconPath?: string;
}

/**
 * Load `vault/landing` when `landing/index.html` exists; otherwise return null.
 */
export async function loadMarketingLandingFromFs(
  options: LoadMarketingLandingFromFsOptions,
): Promise<MarketingLandingBundle | null> {
  return loadMarketingLandingBundle({
    vaultPath: options.vaultPath,
    version: options.version,
    fallbackIconPath: options.fallbackIconPath,
    joinPath: (...segments) => join(...segments),
    exists: (absPath) => existsSync(absPath),
    readText: (absPath) => readFileSync(absPath, "utf8"),
  });
}
