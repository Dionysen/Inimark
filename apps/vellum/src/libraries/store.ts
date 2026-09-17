/** Multi-library registry for Pure Writer roots (Folder containing App/Room.db). */

export const LIBRARIES_STORAGE_KEY = "vellum:libraries";
/** Legacy single-path key from the first open-library UI. */
const LEGACY_PATH_KEY = "vellum-purewriter-path";

export interface LibraryRecord {
  id: string;
  rootPath: string;
  rootName: string;
  addedAt: number;
  lastOpenedAt: number;
}

export interface LibrariesConfig {
  version: 1;
  libraries: LibraryRecord[];
  lastLibraryId: string | null;
}

export function libraryIdFromPath(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").toLowerCase();
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function createEmptyConfig(): LibrariesConfig {
  return { version: 1, libraries: [], lastLibraryId: null };
}

function normalizeConfig(parsed: Partial<LibrariesConfig>): LibrariesConfig {
  const libraries = Array.isArray(parsed.libraries)
    ? parsed.libraries.filter(
        (item): item is LibraryRecord =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.rootPath === "string" &&
          typeof item.rootName === "string",
      )
    : [];
  return {
    version: 1,
    libraries,
    lastLibraryId:
      typeof parsed.lastLibraryId === "string" ? parsed.lastLibraryId : null,
  };
}

function migrateLegacyPath(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_PATH_KEY);
    if (!legacy) return;
    const raw = localStorage.getItem(LIBRARIES_STORAGE_KEY);
    if (raw) return;
    const now = Date.now();
    const id = libraryIdFromPath(legacy);
    const config: LibrariesConfig = {
      version: 1,
      libraries: [
        {
          id,
          rootPath: legacy,
          rootName: fileNameFromPath(legacy),
          addedAt: now,
          lastOpenedAt: now,
        },
      ],
      lastLibraryId: id,
    };
    localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore migration failures
  }
}

export function loadLibrariesConfig(): LibrariesConfig {
  migrateLegacyPath();
  try {
    const raw = localStorage.getItem(LIBRARIES_STORAGE_KEY);
    if (!raw) return createEmptyConfig();
    return normalizeConfig(JSON.parse(raw) as Partial<LibrariesConfig>);
  } catch {
    return createEmptyConfig();
  }
}

export function saveLibrariesConfig(config: LibrariesConfig): void {
  localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(config));
}

export function listLibraries(): LibraryRecord[] {
  return [...loadLibrariesConfig().libraries].sort((a, b) => {
    const byOpened = b.lastOpenedAt - a.lastOpenedAt;
    if (byOpened !== 0) return byOpened;
    return a.rootName.localeCompare(b.rootName, undefined, {
      sensitivity: "base",
    });
  });
}

export function getLibraryById(id: string): LibraryRecord | null {
  return (
    loadLibrariesConfig().libraries.find((library) => library.id === id) ?? null
  );
}

export function getLastLibraryId(): string | null {
  return loadLibrariesConfig().lastLibraryId;
}

/** Remember a successfully opened Pure Writer library root. */
export function upsertLibrary(
  rootPath: string,
  rootName?: string,
): LibraryRecord {
  const config = loadLibrariesConfig();
  const id = libraryIdFromPath(rootPath);
  const now = Date.now();
  const existing = config.libraries.find((library) => library.id === id);
  const record: LibraryRecord = existing
    ? { ...existing, rootPath, lastOpenedAt: now }
    : {
        id,
        rootPath,
        rootName: rootName ?? fileNameFromPath(rootPath),
        addedAt: now,
        lastOpenedAt: now,
      };

  const libraries = existing
    ? config.libraries.map((library) => (library.id === id ? record : library))
    : [...config.libraries, record];

  saveLibrariesConfig({
    version: 1,
    libraries,
    lastLibraryId: id,
  });

  // Keep legacy key in sync for older restore paths.
  localStorage.setItem(LEGACY_PATH_KEY, rootPath);
  return record;
}

export function clearLastLibrary(): void {
  const config = loadLibrariesConfig();
  saveLibrariesConfig({ ...config, lastLibraryId: null });
  localStorage.removeItem(LEGACY_PATH_KEY);
}

export function removeLibrary(id: string): void {
  const config = loadLibrariesConfig();
  const libraries = config.libraries.filter((library) => library.id !== id);
  saveLibrariesConfig({
    version: 1,
    libraries,
    lastLibraryId:
      config.lastLibraryId === id ? null : config.lastLibraryId,
  });
}
