import type { UpdateCheckOptions } from "../updater.ts";

export const DEV_UPDATE_TEST_STORAGE_KEY = "inimark:dev-update-test";

export interface DevUpdateTestSettings {
  /** Simulated app version used when comparing against the remote release. */
  overrideCurrentVersion: string;
}

export const DEFAULT_DEV_UPDATE_TEST_SETTINGS: DevUpdateTestSettings = {
  overrideCurrentVersion: "0.0.0",
};

/** True in Vite dev builds only; stripped from production bundles. */
export function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

export function loadDevUpdateTestSettings(): DevUpdateTestSettings {
  if (!isDevBuild()) return { ...DEFAULT_DEV_UPDATE_TEST_SETTINGS };
  try {
    const raw = localStorage.getItem(DEV_UPDATE_TEST_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DEV_UPDATE_TEST_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DevUpdateTestSettings>;
    return normalizeDevUpdateTestSettings(parsed);
  } catch {
    return { ...DEFAULT_DEV_UPDATE_TEST_SETTINGS };
  }
}

export function saveDevUpdateTestSettings(settings: DevUpdateTestSettings): void {
  if (!isDevBuild()) return;
  localStorage.setItem(DEV_UPDATE_TEST_STORAGE_KEY, JSON.stringify(settings));
}

/** Returns the override when dev mode is active and a version string is set. */
export function getDevUpdateCheckOverride(): string | undefined {
  if (!isDevBuild()) return undefined;
  const trimmed = loadDevUpdateTestSettings().overrideCurrentVersion.trim();
  return trimmed || undefined;
}

export function mergeUpdateCheckOptions(
  options: UpdateCheckOptions = {},
): UpdateCheckOptions {
  const override = getDevUpdateCheckOverride();
  if (!override) return options;
  return { ...options, devCurrentVersionOverride: override };
}

function normalizeDevUpdateTestSettings(
  parsed: Partial<DevUpdateTestSettings>,
): DevUpdateTestSettings {
  return {
    overrideCurrentVersion:
      typeof parsed.overrideCurrentVersion === "string"
        ? parsed.overrideCurrentVersion
        : DEFAULT_DEV_UPDATE_TEST_SETTINGS.overrideCurrentVersion,
  };
}
