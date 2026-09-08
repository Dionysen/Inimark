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

function createDefaultGroup(name = "Default"): BookmarkGroup {
  return { id: DEFAULT_BOOKMARK_GROUP_ID, name, order: 0 };
}

function createEmptyLibraryBookmarks(initialGroupName = "Default"): LibraryBookmarks {
  return {
    groups: [createDefaultGroup(initialGroupName)],
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

  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const items: BookmarkItem[] = [];
  const seenIds = new Set<string>();
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];

  if (groups.length === 0 && rawItems.length > 0) {
    groups.push(createDefaultGroup());
  }

  const validGroupIds = new Set(groups.map((g) => g.id));
  const fallbackGroupId = groups[0]?.id ?? DEFAULT_BOOKMARK_GROUP_ID;

  if (rawItems.length > 0) {
    for (const item of rawItems as Array<{
      id?: string;
      path?: string;
      kind?: string;
      groupId?: string;
      addedAt?: number;
    }>) {
      if (!item || typeof item !== "object") continue;
      const path = typeof item.path === "string" ? normalizePath(item.path) : "";
      if (!path) continue;
      // Folders are no longer bookmarkable — drop legacy directory entries.
      if (item.kind === "directory") continue;
      const groupId =
        typeof item.groupId === "string" && validGroupIds.has(item.groupId)
          ? item.groupId
          : fallbackGroupId;
      const id =
        typeof item.id === "string" && item.id ? item.id : newId("bm");
      if (seenIds.has(id)) continue;
      seenIds.add(id);
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

/** Seed bookmark storage for a library with one initial group. */
export function ensureLibraryBookmarks(
  libraryId: string,
  initialGroupName: string,
): LibraryBookmarks {
  if (!libraryId) return createEmptyLibraryBookmarks(initialGroupName);
  const config = loadBookmarksConfig();
  if (config.libraries[libraryId]) {
    return normalizeLibrary(config.libraries[libraryId]);
  }
  const created = createEmptyLibraryBookmarks(initialGroupName);
  saveBookmarksConfig({
    ...config,
    libraries: { ...config.libraries, [libraryId]: created },
  });
  return created;
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
    const groups =
      current.groups.length > 0 ? current.groups : [createDefaultGroup()];
    const groupId =
      input.groupId && groups.some((g) => g.id === input.groupId)
        ? input.groupId
        : groups[0]!.id;
    const existingInGroup = current.items.find(
      (item) =>
        item.groupId === groupId &&
        item.path.toLowerCase() === path.toLowerCase(),
    );

    if (existingInGroup) {
      created = { ...existingInGroup, kind: "file" };
      return current.groups.length > 0 ? current : { ...current, groups };
    }

    created = {
      id: newId("bm"),
      path,
      kind: "file",
      groupId,
      addedAt: Date.now(),
    };
    return {
      ...current,
      groups,
      items: [...current.items, created],
    };
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

export function removeBookmarkItem(libraryId: string, itemId: string): boolean {
  let removed = false;
  updateLibrary(libraryId, (current) => {
    const nextItems = current.items.filter((item) => {
      if (item.id === itemId) {
        removed = true;
        return false;
      }
      return true;
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
  let deleted = false;
  updateLibrary(libraryId, (current) => {
    if (!current.groups.some((g) => g.id === groupId)) return current;
    deleted = true;
    return {
      ...current,
      groups: current.groups.filter((g) => g.id !== groupId),
      items: current.items.filter((item) => item.groupId !== groupId),
      collapsedGroupIds: current.collapsedGroupIds.filter((id) => id !== groupId),
    };
  });
  return deleted;
}

function nextCopyGroupName(groups: BookmarkGroup[], baseName: string): string {
  const taken = new Set(groups.map((group) => group.name.toLowerCase()));
  let candidate = `${baseName} copy`;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${baseName} copy ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function renameBookmarkGroup(
  libraryId: string,
  groupId: string,
  name: string,
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  let renamed = false;
  updateLibrary(libraryId, (current) => {
    const group = current.groups.find((entry) => entry.id === groupId);
    if (!group) return current;
    if (
      current.groups.some(
        (entry) =>
          entry.id !== groupId && entry.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      return current;
    }
    renamed = true;
    return {
      ...current,
      groups: current.groups.map((entry) =>
        entry.id === groupId ? { ...entry, name: trimmed } : entry,
      ),
    };
  });
  return renamed;
}

export function copyBookmarkGroup(
  libraryId: string,
  groupId: string,
  options: { includeItems: boolean; displayName: string },
): BookmarkGroup | null {
  let created: BookmarkGroup | null = null;
  updateLibrary(libraryId, (current) => {
    if (!current.groups.some((group) => group.id === groupId)) return current;
    const copyName = nextCopyGroupName(
      current.groups,
      options.displayName.trim() || "Group",
    );
    const maxOrder = current.groups.reduce((max, group) => Math.max(max, group.order), 0);
    created = { id: newId("grp"), name: copyName, order: maxOrder + 1 };
    const copiedItems = options.includeItems
      ? current.items
          .filter((item) => item.groupId === groupId)
          .map((item) => ({
            id: newId("bm"),
            path: item.path,
            kind: "file" as const,
            groupId: created!.id,
            addedAt: Date.now(),
          }))
      : [];
    return {
      ...current,
      groups: [...current.groups, created],
      items: [...current.items, ...copiedItems],
    };
  });
  return created;
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

export function setAllBookmarkGroupsCollapsed(
  libraryId: string,
  collapsed: boolean,
): void {
  updateLibrary(libraryId, (current) => {
    if (current.groups.length === 0) return current;
    return {
      ...current,
      collapsedGroupIds: collapsed ? current.groups.map((g) => g.id) : [],
    };
  });
}
