import {
  getWorkspaceRecentFiles,
  setWorkspaceRecentFiles,
} from "../workspace/runtime.ts";

const RECENT_FILES_STORAGE_KEY = "inimark-recent-files";
const MAX_RECENT_FILES = 20;

type RecentFilesStore = Record<string, string[]>;

function loadStore(): RecentFilesStore {
  try {
    const raw = localStorage.getItem(RECENT_FILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentFilesStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: RecentFilesStore): void {
  localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(store));
}

export function getRecentFiles(libraryId: string | null): string[] {
  if (!libraryId) return [];
  const bound = getWorkspaceRecentFiles(libraryId);
  if (bound) return bound;
  return loadStore()[libraryId] ?? [];
}

export function recordRecentFile(
  libraryId: string | null,
  path: string,
): void {
  if (!libraryId || !path) return;
  const existing = getRecentFiles(libraryId);
  const updated = [path, ...existing.filter((item) => item !== path)].slice(
    0,
    MAX_RECENT_FILES,
  );
  if (setWorkspaceRecentFiles(libraryId, updated)) return;

  const store = loadStore();
  store[libraryId] = updated;
  saveStore(store);
}

export function recentFilesToItems(
  paths: string[],
  currentFilePath: string | null,
  nameFromPath: (path: string) => string,
): Array<{ name: string; path: string }> {
  return paths
    .filter((path) => path !== currentFilePath)
    .map((path) => ({ name: nameFromPath(path), path }));
}
