import type { LibraryBookmarks } from "../bookmarks/store.ts";
import type { LibrarySessionState } from "../libraries/store.ts";
import { readInimarkFile, inimarkFileExists, writeInimarkFile } from "./io.ts";
import {
  WORKSPACE_BOOKMARKS_FILE,
  WORKSPACE_LINK_INDEX_FILE,
  WORKSPACE_RECENT_FILE,
  WORKSPACE_SESSION_FILE,
  inimarkRelativePath,
} from "./paths.ts";

const BOOKMARKS_STORAGE_KEY = "inimark:bookmarks";
const LIBRARIES_STORAGE_KEY = "inimark:libraries";
const RECENT_FILES_STORAGE_KEY = "inimark-recent-files";
const LINK_INDEX_CACHE_KEY = "inimark:link-index";
const LINK_INDEX_VAULT_KEY = "inimark:link-index-vault";

const FLUSH_DELAY_MS = 300;

export interface WorkspaceFileIo {
  readText(relativePath: string): Promise<string | null>;
  writeText(relativePath: string, content: string): Promise<void>;
  exists?(relativePath: string): Promise<boolean>;
}

async function readWorkspaceDataFile(
  rootPath: string,
  fileName: string,
  io?: WorkspaceFileIo,
): Promise<string | null> {
  const relativePath = inimarkRelativePath(fileName);
  if (io) {
    try {
      return await io.readText(relativePath);
    } catch (error) {
      console.warn(`Failed to read ${relativePath} via workspace IO:`, error);
      return null;
    }
  }
  return readInimarkFile(rootPath, fileName);
}

async function workspaceDataFileExists(
  rootPath: string,
  fileName: string,
  io?: WorkspaceFileIo,
): Promise<boolean> {
  const relativePath = inimarkRelativePath(fileName);
  if (io?.exists) {
    try {
      return await io.exists(relativePath);
    } catch {
      return false;
    }
  }
  return inimarkFileExists(rootPath, fileName);
}

async function writeWorkspaceDataFile(
  rootPath: string,
  fileName: string,
  content: string,
  io?: WorkspaceFileIo,
): Promise<void> {
  const relativePath = inimarkRelativePath(fileName);
  if (io) {
    await io.writeText(relativePath, content);
    return;
  }
  await writeInimarkFile(rootPath, fileName, content);
}

interface WorkspaceRuntimeState {
  rootPath: string;
  libraryId: string;
  bookmarks: LibraryBookmarks;
  session: LibrarySessionState;
  recent: string[];
  linkIndexCache: string | null;
  dirty: Set<WorkspaceDataKey>;
  io?: WorkspaceFileIo;
}

type WorkspaceDataKey = "bookmarks" | "session" | "recent" | "linkIndex";

let active: WorkspaceRuntimeState | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function createEmptySession(): LibrarySessionState {
  return { activeFilePath: null, expandedDirs: [], fileViews: {} };
}

function scheduleFlush(): void {
  if (flushTimer != null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWorkspace();
  }, FLUSH_DELAY_MS);
}

function markDirty(key: WorkspaceDataKey): void {
  if (!active) return;
  active.dirty.add(key);
  scheduleFlush();
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, "").trim()) as T;
  } catch {
    return null;
  }
}

function hasBookmarkContent(data: LibraryBookmarks): boolean {
  return data.items.length > 0;
}

function migrateBookmarksFromLocalStorage(libraryId: string): LibraryBookmarks | null {
  const config = parseJson<{ libraries?: Record<string, LibraryBookmarks> }>(
    localStorage.getItem(BOOKMARKS_STORAGE_KEY),
  );
  const bookmarks = config?.libraries?.[libraryId];
  return bookmarks ?? null;
}

function migrateSessionFromLocalStorage(libraryId: string): LibrarySessionState | null {
  const config = parseJson<{ sessions?: Record<string, LibrarySessionState> }>(
    localStorage.getItem(LIBRARIES_STORAGE_KEY),
  );
  return config?.sessions?.[libraryId] ?? null;
}

function migrateRecentFromLocalStorage(libraryId: string): string[] | null {
  const store = parseJson<Record<string, string[]>>(
    localStorage.getItem(RECENT_FILES_STORAGE_KEY),
  );
  const recent = store?.[libraryId];
  return Array.isArray(recent) ? recent : null;
}

function migrateLinkIndexFromLocalStorage(rootPath: string): string | null {
  if (localStorage.getItem(LINK_INDEX_VAULT_KEY) !== rootPath) return null;
  return localStorage.getItem(LINK_INDEX_CACHE_KEY);
}

function clearMigratedLocalStorage(libraryId: string, rootPath: string): void {
  try {
    const bookmarksConfig = parseJson<{
      version: 1;
      libraries: Record<string, LibraryBookmarks>;
    }>(localStorage.getItem(BOOKMARKS_STORAGE_KEY));
    if (bookmarksConfig?.libraries?.[libraryId]) {
      const { [libraryId]: _removed, ...libraries } = bookmarksConfig.libraries;
      localStorage.setItem(
        BOOKMARKS_STORAGE_KEY,
        JSON.stringify({ version: 1, libraries }),
      );
    }

    const librariesConfig = parseJson<{
      version?: number;
      libraries?: unknown[];
      lastLibraryId?: string | null;
      sessions?: Record<string, LibrarySessionState>;
    }>(localStorage.getItem(LIBRARIES_STORAGE_KEY));
    if (librariesConfig?.sessions?.[libraryId]) {
      const { [libraryId]: _session, ...sessions } = librariesConfig.sessions;
      localStorage.setItem(
        LIBRARIES_STORAGE_KEY,
        JSON.stringify({ ...librariesConfig, sessions }),
      );
    }

    const recentStore = parseJson<Record<string, string[]>>(
      localStorage.getItem(RECENT_FILES_STORAGE_KEY),
    );
    if (recentStore?.[libraryId]) {
      const { [libraryId]: _recent, ...rest } = recentStore;
      localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(rest));
    }

    if (localStorage.getItem(LINK_INDEX_VAULT_KEY) === rootPath) {
      localStorage.removeItem(LINK_INDEX_VAULT_KEY);
      localStorage.removeItem(LINK_INDEX_CACHE_KEY);
    }
  } catch {
    /* ignore migration cleanup failures */
  }
}

async function writeDirtyFiles(state: WorkspaceRuntimeState): Promise<void> {
  const writes: Promise<void>[] = [];
  const io = state.io;

  if (state.dirty.has("bookmarks")) {
    writes.push(
      writeWorkspaceDataFile(
        state.rootPath,
        WORKSPACE_BOOKMARKS_FILE,
        JSON.stringify(state.bookmarks, null, 2),
        io,
      ).catch((error) => {
        console.error("Failed to save bookmarks.json", error);
      }),
    );
  }
  if (state.dirty.has("session")) {
    writes.push(
      writeWorkspaceDataFile(
        state.rootPath,
        WORKSPACE_SESSION_FILE,
        JSON.stringify(state.session, null, 2),
        io,
      ).catch((error) => {
        console.error("Failed to save session.json", error);
      }),
    );
  }
  if (state.dirty.has("recent")) {
    writes.push(
      writeWorkspaceDataFile(
        state.rootPath,
        WORKSPACE_RECENT_FILE,
        JSON.stringify(state.recent, null, 2),
        io,
      ).catch((error) => {
        console.error("Failed to save recent.json", error);
      }),
    );
  }
  if (state.dirty.has("linkIndex") && state.linkIndexCache != null) {
    writes.push(
      writeWorkspaceDataFile(
        state.rootPath,
        WORKSPACE_LINK_INDEX_FILE,
        state.linkIndexCache,
        io,
      ).catch((error) => {
        console.error("Failed to save link-index.json", error);
      }),
    );
  }

  await Promise.all(writes);
  state.dirty.clear();
}

export function isWorkspaceBound(libraryId?: string): boolean {
  if (!active) return false;
  return libraryId ? active.libraryId === libraryId : true;
}

export function getBoundLibraryId(): string | null {
  return active?.libraryId ?? null;
}

export function getBoundRootPath(): string | null {
  return active?.rootPath ?? null;
}

export async function bindWorkspace(
  rootPath: string,
  libraryId: string,
  io?: WorkspaceFileIo,
): Promise<void> {
  if (active?.libraryId === libraryId && active.rootPath === rootPath) return;
  await flushWorkspace();

  let migrated = false;

  const bookmarksRaw = await readWorkspaceDataFile(rootPath, WORKSPACE_BOOKMARKS_FILE, io);
  const bookmarksFileExists = await workspaceDataFileExists(
    rootPath,
    WORKSPACE_BOOKMARKS_FILE,
    io,
  );
  let bookmarks = parseJson<LibraryBookmarks>(bookmarksRaw);
  if (bookmarksRaw == null && !bookmarksFileExists) {
    const fromStorage = migrateBookmarksFromLocalStorage(libraryId);
    if (fromStorage && hasBookmarkContent(fromStorage)) {
      bookmarks = fromStorage;
      migrated = true;
    }
  } else if (bookmarksRaw != null && !bookmarks) {
    console.error("Invalid bookmarks.json in .inimark");
  } else if (bookmarksRaw == null && bookmarksFileExists) {
    console.error("Failed to read bookmarks.json from .inimark");
  }

  const sessionRaw = await readWorkspaceDataFile(rootPath, WORKSPACE_SESSION_FILE, io);
  let session = parseJson<LibrarySessionState>(sessionRaw);
  if (sessionRaw == null) {
    const fromStorage = migrateSessionFromLocalStorage(libraryId);
    if (fromStorage) {
      session = fromStorage;
      migrated = true;
    }
  } else if (!session) {
    console.error("Invalid session.json in .inimark");
  }
  if (!session) session = createEmptySession();

  const recentRaw = await readWorkspaceDataFile(rootPath, WORKSPACE_RECENT_FILE, io);
  let recent = parseJson<string[]>(recentRaw);
  if (recentRaw == null) {
    const fromStorage = migrateRecentFromLocalStorage(libraryId);
    if (fromStorage) {
      recent = fromStorage;
      migrated = true;
    }
  } else if (!recent) {
    console.error("Invalid recent.json in .inimark");
  }
  if (!recent) recent = [];

  const linkIndexRaw = await readWorkspaceDataFile(rootPath, WORKSPACE_LINK_INDEX_FILE, io);
  let linkIndexCache = linkIndexRaw;
  if (linkIndexRaw == null) {
    const fromStorage = migrateLinkIndexFromLocalStorage(rootPath);
    if (fromStorage) {
      linkIndexCache = fromStorage;
      migrated = true;
    }
  }

  active = {
    rootPath,
    libraryId,
    bookmarks: bookmarks ?? { groups: [], items: [], collapsedGroupIds: [] },
    session,
    recent,
    linkIndexCache,
    dirty: new Set(),
    io,
  };

  if (migrated) {
    active.dirty.add("bookmarks");
    active.dirty.add("session");
    active.dirty.add("recent");
    if (linkIndexCache) active.dirty.add("linkIndex");
    await flushWorkspace();
    clearMigratedLocalStorage(libraryId, rootPath);
  }
}

export async function flushWorkspace(): Promise<void> {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!active || active.dirty.size === 0) return;
  await writeDirtyFiles(active);
}

export function unbindWorkspace(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  active = null;
}

export function getWorkspaceBookmarks(libraryId: string): LibraryBookmarks | null {
  if (!active || active.libraryId !== libraryId) return null;
  return active.bookmarks;
}

export function setWorkspaceBookmarks(
  libraryId: string,
  bookmarks: LibraryBookmarks,
): boolean {
  if (!active || active.libraryId !== libraryId) return false;
  active.bookmarks = bookmarks;
  markDirty("bookmarks");
  return true;
}

export function getWorkspaceSession(libraryId: string): LibrarySessionState | null {
  if (!active || active.libraryId !== libraryId) return null;
  return active.session;
}

export function setWorkspaceSession(
  libraryId: string,
  session: LibrarySessionState,
): boolean {
  if (!active || active.libraryId !== libraryId) return false;
  active.session = session;
  markDirty("session");
  return true;
}

export function getWorkspaceRecentFiles(libraryId: string): string[] | null {
  if (!active || active.libraryId !== libraryId) return null;
  return active.recent;
}

export function setWorkspaceRecentFiles(libraryId: string, recent: string[]): boolean {
  if (!active || active.libraryId !== libraryId) return false;
  active.recent = recent;
  markDirty("recent");
  return true;
}

export function getWorkspaceLinkIndexCache(rootPath: string): string | null {
  if (!active || active.rootPath !== rootPath) return null;
  return active.linkIndexCache;
}

export function setWorkspaceLinkIndexCache(rootPath: string, cache: string): boolean {
  if (!active || active.rootPath !== rootPath) return false;
  active.linkIndexCache = cache;
  markDirty("linkIndex");
  return true;
}
