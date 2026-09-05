export const BOOKMARKS_STORAGE_KEY = "inimark:bookmarks";
export const DEFAULT_BOOKMARK_GROUP_ID = "default";

export type BookmarkKind = "file";

export interface BookmarkGroup {
  id: string;
  name: string;
  order: number;
}

export interface BookmarkItem {
  id: string;
  path: string;
  kind: BookmarkKind;
  groupId: string;
  addedAt: number;
}

export interface LibraryBookmarks {
  groups: BookmarkGroup[];
  items: BookmarkItem[];
  collapsedGroupIds: string[];
}

export interface BookmarksConfig {
  version: 1;
  libraries: Record<string, LibraryBookmarks>;
}

function createDefaultGroup(): BookmarkGroup {
  return { id: DEFAULT_BOOKMARK_GROUP_ID, name: "Default", order: 0 };
}

function createEmptyLibraryBookmarks(): LibraryBookmarks {
  return {
    groups: [createDefaultGroup()],
    items: [],
    collapsedGroupIds: [],
  };
}

function createEmptyConfig(): BookmarksConfig {
  return { version: 1, libraries: {} };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLibrary(raw: Partial<LibraryBookmarks> | undefined): LibraryBookmarks {
  const groupsRaw = Array.isArray(raw?.groups) ? raw.groups : [];
  const groups: BookmarkGroup[] = [];
  const seenGroupIds = new Set<string>();

  for (const group of groupsRaw) {
    if (!group || typeof group !== "object") continue;
    const id = typeof group.id === "string" && group.id ? group.id : "";
    const name = typeof group.name === "string" ? group.name.trim() : "";
    if (!id || !name || seenGroupIds.has(id)) continue;
    seenGroupIds.add(id);
    groups.push({
      id,
      name,
      order: typeof group.order === "number" ? group.order : groups.length,
    });
  }

  if (!seenGroupIds.has(DEFAULT_BOOKMARK_GROUP_ID)) {
    groups.unshift(createDefaultGroup());
  }

  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const validGroupIds = new Set(groups.map((g) => g.id));
  const items: BookmarkItem[] = [];
  const seenPaths = new Set<string>();

  if (Array.isArray(raw?.items)) {
    for (const item of raw.items as Array<{
      id?: string;
      path?: string;
      kind?: string;
      groupId?: string;
      addedAt?: number;
    }>) {
      if (!item || typeof item !== "object") continue;
      const path = typeof item.path === "string" ? normalizePath(item.path) : "";
      if (!path || seenPaths.has(path.toLowerCase())) continue;
      // Folders are no longer bookmarkable — drop legacy directory entries.
      if (item.kind === "directory") continue;
      const groupId =
        typeof item.groupId === "string" && validGroupIds.has(item.groupId)
          ? item.groupId
          : DEFAULT_BOOKMARK_GROUP_ID;
      const id =
        typeof item.id === "string" && item.id ? item.id : newId("bm");
      seenPaths.add(path.toLowerCase());
      items.push({
        id,
        path,
        kind: "file",
        groupId,
        addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
      });
    }
  }

  const collapsedGroupIds = Array.isArray(raw?.collapsedGroupIds)
    ? raw.collapsedGroupIds.filter(
        (id): id is string => typeof id === "string" && validGroupIds.has(id),
      )
    : [];

  return { groups, items, collapsedGroupIds };
}

function normalizeConfig(parsed: Partial<BookmarksConfig>): BookmarksConfig {
  const libraries: Record<string, LibraryBookmarks> = {};
  if (parsed.libraries && typeof parsed.libraries === "object") {
    for (const [libraryId, value] of Object.entries(parsed.libraries)) {
      if (!libraryId) continue;
      libraries[libraryId] = normalizeLibrary(value);
    }
  }
  return { version: 1, libraries };
}

export function loadBookmarksConfig(): BookmarksConfig {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return createEmptyConfig();
    return normalizeConfig(JSON.parse(raw) as Partial<BookmarksConfig>);
  } catch {
    return createEmptyConfig();
  }
}

export function saveBookmarksConfig(config: BookmarksConfig): void {
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(config));
}

function updateLibrary(
  libraryId: string,
  updater: (current: LibraryBookmarks) => LibraryBookmarks,
): LibraryBookmarks {
  const config = loadBookmarksConfig();
  const current = normalizeLibrary(config.libraries[libraryId]);
  const next = normalizeLibrary(updater(current));
  saveBookmarksConfig({
    ...config,
    libraries: { ...config.libraries, [libraryId]: next },
  });
  return next;
}

export function getLibraryBookmarks(libraryId: string): LibraryBookmarks {
  if (!libraryId) return createEmptyLibraryBookmarks();
  const config = loadBookmarksConfig();
  return normalizeLibrary(config.libraries[libraryId]);
}

export function findBookmarkByPath(
  libraryId: string,
  path: string,
): BookmarkItem | null {
  const normalized = normalizePath(path).toLowerCase();
  return (
    getLibraryBookmarks(libraryId).items.find(
      (item) => item.path.toLowerCase() === normalized,
    ) ?? null
  );
}

export function isBookmarked(libraryId: string, path: string): boolean {
  return findBookmarkByPath(libraryId, path) != null;
}

export function addBookmark(
  libraryId: string,
  input: { path: string; groupId?: string },
): BookmarkItem {
  const path = normalizePath(input.path);
  let created: BookmarkItem | null = null;

  updateLibrary(libraryId, (current) => {
    const existing = current.items.find(
      (item) => item.path.toLowerCase() === path.toLowerCase(),
    );
    const groupId =
      input.groupId && current.groups.some((g) => g.id === input.groupId)
        ? input.groupId
        : DEFAULT_BOOKMARK_GROUP_ID;

    if (existing) {
      created = { ...existing, kind: "file", groupId };
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === existing.id ? created! : item,
        ),
      };
    }

    created = {
      id: newId("bm"),
      path,
      kind: "file",
      groupId,
      addedAt: Date.now(),
    };
    return { ...current, items: [...current.items, created] };
  });

  return created!;
}

export function removeBookmark(libraryId: string, path: string): boolean {
  const normalized = normalizePath(path).toLowerCase();
  let removed = false;
  updateLibrary(libraryId, (current) => {
    const nextItems = current.items.filter((item) => {
      const match = item.path.toLowerCase() === normalized;
      if (match) removed = true;
      return !match;
    });
    return removed ? { ...current, items: nextItems } : current;
  });
  return removed;
}

/** Remove a path and any bookmarked descendants (for deleted folders). */
export function removeBookmarksUnder(libraryId: string, path: string): void {
  const normalized = normalizePath(path).toLowerCase();
  const prefix = `${normalized}/`;
  updateLibrary(libraryId, (current) => ({
    ...current,
    items: current.items.filter((item) => {
      const p = item.path.toLowerCase();
      return p !== normalized && !p.startsWith(prefix);
    }),
  }));
}

export function remapBookmarkPath(
  libraryId: string,
  fromPath: string,
  toPath: string,
): void {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);
  if (from === to) return;
  const fromLower = from.toLowerCase();
  const prefix = `${fromLower}/`;

  updateLibrary(libraryId, (current) => {
    const items = current.items.map((item) => {
      const p = item.path;
      const lower = p.toLowerCase();
      if (lower === fromLower) return { ...item, path: to };
      if (lower.startsWith(prefix)) {
        return { ...item, path: `${to}${p.slice(from.length)}` };
      }
      return item;
    });
    return { ...current, items };
  });
}

export function createBookmarkGroup(
  libraryId: string,
  name: string,
): BookmarkGroup {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Group name is required");

  let created: BookmarkGroup | null = null;
  updateLibrary(libraryId, (current) => {
    const existing = current.groups.find(
      (g) => g.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      created = existing;
      return current;
    }
    const maxOrder = current.groups.reduce((max, g) => Math.max(max, g.order), 0);
    created = { id: newId("grp"), name: trimmed, order: maxOrder + 1 };
    return { ...current, groups: [...current.groups, created] };
  });
  return created!;
}

export function deleteBookmarkGroup(libraryId: string, groupId: string): boolean {
  if (groupId === DEFAULT_BOOKMARK_GROUP_ID) return false;
  let deleted = false;
  updateLibrary(libraryId, (current) => {
    if (!current.groups.some((g) => g.id === groupId)) return current;
    deleted = true;
    return {
      ...current,
      groups: current.groups.filter((g) => g.id !== groupId),
      items: current.items.map((item) =>
        item.groupId === groupId
          ? { ...item, groupId: DEFAULT_BOOKMARK_GROUP_ID }
          : item,
      ),
      collapsedGroupIds: current.collapsedGroupIds.filter((id) => id !== groupId),
    };
  });
  return deleted;
}

export function setBookmarkGroupCollapsed(
  libraryId: string,
  groupId: string,
  collapsed: boolean,
): void {
  updateLibrary(libraryId, (current) => {
    if (!current.groups.some((g) => g.id === groupId)) return current;
    const set = new Set(current.collapsedGroupIds);
    if (collapsed) set.add(groupId);
    else set.delete(groupId);
    return { ...current, collapsedGroupIds: [...set] };
  });
}

export function groupDisplayName(
  group: BookmarkGroup,
  defaultLabel: string,
): string {
  return group.id === DEFAULT_BOOKMARK_GROUP_ID ? defaultLabel : group.name;
}
