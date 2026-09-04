import { fileNameFromPath } from "../platform/env.ts";

export const LIBRARIES_STORAGE_KEY = "inimark:libraries";
const LEGACY_LAST_WORKSPACE_KEY = "inimark:lastWorkspace";

export interface LibraryRecord {
  id: string;
  rootPath: string;
  rootName: string;
  addedAt: number;
  lastOpenedAt: number;
}

export interface LibrarySessionState {
  activeFilePath: string | null;
  expandedDirs: string[];
}

export interface LibrariesConfig {
  version: 1;
  libraries: LibraryRecord[];
  lastLibraryId: string | null;
  sessions: Record<string, LibrarySessionState>;
}

const DEFAULT_SESSION: LibrarySessionState = {
  activeFilePath: null,
  expandedDirs: [],
};

export function libraryIdFromPath(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").toLowerCase();
}

export function loadLibrariesConfig(): LibrariesConfig {
  migrateLegacyLastWorkspace();
  try {
    const raw = localStorage.getItem(LIBRARIES_STORAGE_KEY);
    if (!raw) return createEmptyConfig();
    const parsed = JSON.parse(raw) as Partial<LibrariesConfig>;
    return normalizeConfig(parsed);
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
    return a.rootName.localeCompare(b.rootName, undefined, { sensitivity: "base" });
  });
}

export function getLibraryById(id: string): LibraryRecord | null {
  return loadLibrariesConfig().libraries.find((library) => library.id === id) ?? null;
}

export function getLastLibraryId(): string | null {
  return loadLibrariesConfig().lastLibraryId;
}

export function upsertLibrary(rootPath: string, rootName?: string): LibraryRecord {
  const config = loadLibrariesConfig();
  const id = libraryIdFromPath(rootPath);
  const now = Date.now();
  const existing = config.libraries.find((library) => library.id === id);
  const record: LibraryRecord = existing
    ? {
        ...existing,
        rootPath,
        rootName: rootName ?? existing.rootName,
        lastOpenedAt: now,
      }
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
    ...config,
    libraries,
    lastLibraryId: id,
  });
  return record;
}

export function removeLibrary(id: string): void {
  const config = loadLibrariesConfig();
  const libraries = config.libraries.filter((library) => library.id !== id);
  const { [id]: _removed, ...sessions } = config.sessions;
  const lastLibraryId =
    config.lastLibraryId === id ? (libraries[0]?.id ?? null) : config.lastLibraryId;

  saveLibrariesConfig({
    ...config,
    libraries,
    sessions,
    lastLibraryId,
  });
}

export function setLastLibraryId(id: string | null): void {
  const config = loadLibrariesConfig();
  saveLibrariesConfig({ ...config, lastLibraryId: id });
}

export function getLibrarySession(id: string): LibrarySessionState {
  const session = loadLibrariesConfig().sessions[id];
  if (!session) return { ...DEFAULT_SESSION };
  return {
    activeFilePath:
      typeof session.activeFilePath === "string" ? session.activeFilePath : null,
    expandedDirs: Array.isArray(session.expandedDirs)
      ? session.expandedDirs.filter((value): value is string => typeof value === "string")
      : [],
  };
}

export function saveLibrarySession(id: string, state: LibrarySessionState): void {
  const config = loadLibrariesConfig();
  saveLibrariesConfig({
    ...config,
    sessions: {
      ...config.sessions,
      [id]: {
        activeFilePath: state.activeFilePath,
        expandedDirs: [...state.expandedDirs],
      },
    },
  });
}

function createEmptyConfig(): LibrariesConfig {
  return {
    version: 1,
    libraries: [],
    lastLibraryId: null,
    sessions: {},
  };
}

function normalizeConfig(parsed: Partial<LibrariesConfig>): LibrariesConfig {
  const libraries = Array.isArray(parsed.libraries)
    ? parsed.libraries
        .filter(
          (library): library is LibraryRecord =>
            !!library &&
            typeof library.id === "string" &&
            typeof library.rootPath === "string" &&
            typeof library.rootName === "string",
        )
        .map((library) => ({
          id: library.id,
          rootPath: library.rootPath,
          rootName: library.rootName,
          addedAt: typeof library.addedAt === "number" ? library.addedAt : Date.now(),
          lastOpenedAt:
            typeof library.lastOpenedAt === "number" ? library.lastOpenedAt : Date.now(),
        }))
    : [];

  const sessions: Record<string, LibrarySessionState> = {};
  if (parsed.sessions && typeof parsed.sessions === "object") {
    for (const [id, session] of Object.entries(parsed.sessions)) {
      if (!session || typeof session !== "object") continue;
      sessions[id] = {
        activeFilePath:
          typeof session.activeFilePath === "string" ? session.activeFilePath : null,
        expandedDirs: Array.isArray(session.expandedDirs)
          ? session.expandedDirs.filter((value): value is string => typeof value === "string")
          : [],
      };
    }
  }

  const lastLibraryId =
    typeof parsed.lastLibraryId === "string" &&
    libraries.some((library) => library.id === parsed.lastLibraryId)
      ? parsed.lastLibraryId
      : null;

  return {
    version: 1,
    libraries,
    lastLibraryId,
    sessions,
  };
}

function migrateLegacyLastWorkspace(): void {
  try {
    const legacyPath = localStorage.getItem(LEGACY_LAST_WORKSPACE_KEY);
    if (!legacyPath) return;
    const config = loadLibrariesConfigUncached();
    localStorage.removeItem(LEGACY_LAST_WORKSPACE_KEY);
    if (config.libraries.length > 0) return;

    const id = libraryIdFromPath(legacyPath);
    const now = Date.now();
    saveLibrariesConfig({
      version: 1,
      libraries: [
        {
          id,
          rootPath: legacyPath,
          rootName: fileNameFromPath(legacyPath),
          addedAt: now,
          lastOpenedAt: now,
        },
      ],
      lastLibraryId: id,
      sessions: {},
    });
  } catch {}
}

function loadLibrariesConfigUncached(): LibrariesConfig {
  try {
    const raw = localStorage.getItem(LIBRARIES_STORAGE_KEY);
    if (!raw) return createEmptyConfig();
    return normalizeConfig(JSON.parse(raw) as Partial<LibrariesConfig>);
  } catch {
    return createEmptyConfig();
  }
}
