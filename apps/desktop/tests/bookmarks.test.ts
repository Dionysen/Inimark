import { beforeEach, describe, expect, test } from "vitest";

import {
  BOOKMARKS_STORAGE_KEY,
  DEFAULT_BOOKMARK_GROUP_ID,
  addBookmark,
  copyBookmarkGroup,
  createBookmarkGroup,
  deleteBookmarkGroup,
  ensureLibraryBookmarks,
  findBookmarkByPath,
  getLibraryBookmarks,
  isBookmarked,
  remapBookmarkPath,
  removeBookmark,
  removeBookmarksUnder,
  renameBookmarkGroup,
  setAllBookmarkGroupsCollapsed,
  setBookmarkGroupCollapsed,
} from "../src/bookmarks/store.ts";

describe("bookmarks store", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
        clear: () => memory.clear(),
      },
    });
    memory.delete(BOOKMARKS_STORAGE_KEY);
  });

  test("adds bookmarks to the default group", () => {
    const item = addBookmark("lib-a", { path: "notes/a.md" });
    expect(item.groupId).toBe(DEFAULT_BOOKMARK_GROUP_ID);
    expect(isBookmarked("lib-a", "notes/a.md")).toBe(true);
    expect(getLibraryBookmarks("lib-a").items).toHaveLength(1);
  });

  test("creates groups and assigns bookmarks", () => {
    const group = createBookmarkGroup("lib-a", "Work");
    addBookmark("lib-a", {
      path: "w.md",
      groupId: group.id,
    });
    const found = findBookmarkByPath("lib-a", "w.md");
    expect(found?.groupId).toBe(group.id);
    expect(getLibraryBookmarks("lib-a").groups.map((g) => g.name)).toContain(
      "Work",
    );
  });

  test("removes bookmarks and folder descendants", () => {
    addBookmark("lib-a", { path: "docs/a.md" });
    addBookmark("lib-a", { path: "docs/b.md" });
    addBookmark("lib-a", { path: "other.md" });

    removeBookmarksUnder("lib-a", "docs");
    expect(isBookmarked("lib-a", "docs/a.md")).toBe(false);
    expect(isBookmarked("lib-a", "docs/b.md")).toBe(false);
    expect(isBookmarked("lib-a", "other.md")).toBe(true);

    removeBookmark("lib-a", "other.md");
    expect(isBookmarked("lib-a", "other.md")).toBe(false);
  });

  test("remaps paths on rename", () => {
    addBookmark("lib-a", { path: "old/name.md" });
    remapBookmarkPath("lib-a", "old", "new");
    expect(isBookmarked("lib-a", "new/name.md")).toBe(true);
    expect(isBookmarked("lib-a", "old/name.md")).toBe(false);
  });

  test("drops legacy directory bookmarks on load", () => {
    localStorage.setItem(
      BOOKMARKS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        libraries: {
          "lib-a": {
            groups: [{ id: DEFAULT_BOOKMARK_GROUP_ID, name: "Default", order: 0 }],
            items: [
              {
                id: "1",
                path: "folder",
                kind: "directory",
                groupId: DEFAULT_BOOKMARK_GROUP_ID,
                addedAt: 1,
              },
              {
                id: "2",
                path: "a.md",
                kind: "file",
                groupId: DEFAULT_BOOKMARK_GROUP_ID,
                addedAt: 2,
              },
            ],
            collapsedGroupIds: [],
          },
        },
      }),
    );
    const items = getLibraryBookmarks("lib-a").items;
    expect(items).toHaveLength(1);
    expect(items[0]?.path).toBe("a.md");
  });

  test("deleting a group removes its bookmarks", () => {
    const group = createBookmarkGroup("lib-a", "Temp");
    addBookmark("lib-a", {
      path: "x.md",
      groupId: group.id,
    });
    expect(deleteBookmarkGroup("lib-a", group.id)).toBe(true);
    expect(getLibraryBookmarks("lib-a").items).toHaveLength(0);
    expect(getLibraryBookmarks("lib-a").groups.some((entry) => entry.id === group.id)).toBe(
      false,
    );
  });

  test("can delete the initial default group", () => {
    addBookmark("lib-a", { path: "x.md" });
    expect(deleteBookmarkGroup("lib-a", DEFAULT_BOOKMARK_GROUP_ID)).toBe(true);
    expect(getLibraryBookmarks("lib-a").groups).toHaveLength(0);
    expect(getLibraryBookmarks("lib-a").items).toHaveLength(0);
  });

  test("renames a custom group", () => {
    addBookmark("lib-a", { path: "seed.md" });
    const group = createBookmarkGroup("lib-a", "Work");
    expect(renameBookmarkGroup("lib-a", group.id, "Projects")).toBe(true);
    expect(
      getLibraryBookmarks("lib-a").groups.find((entry) => entry.id === group.id)?.name,
    ).toBe("Projects");
    expect(renameBookmarkGroup("lib-a", DEFAULT_BOOKMARK_GROUP_ID, "Starter")).toBe(
      true,
    );
    expect(
      getLibraryBookmarks("lib-a").groups.find((entry) => entry.id === DEFAULT_BOOKMARK_GROUP_ID)
        ?.name,
    ).toBe("Starter");
  });

  test("copies a group with or without items", () => {
    const group = createBookmarkGroup("lib-a", "Work");
    addBookmark("lib-a", { path: "a.md", groupId: group.id });
    addBookmark("lib-a", { path: "b.md", groupId: group.id });

    const emptyCopy = copyBookmarkGroup("lib-a", group.id, {
      includeItems: false,
      displayName: "Work",
    });
    expect(emptyCopy?.name).toBe("Work copy");
    expect(
      getLibraryBookmarks("lib-a").items.filter((item) => item.groupId === emptyCopy!.id),
    ).toHaveLength(0);

    const fullCopy = copyBookmarkGroup("lib-a", group.id, {
      includeItems: true,
      displayName: "Work",
    });
    expect(fullCopy?.name).toBe("Work copy 2");
    const copiedItems = getLibraryBookmarks("lib-a").items.filter(
      (item) => item.groupId === fullCopy!.id,
    );
    expect(copiedItems).toHaveLength(2);
    expect(copiedItems.map((item) => item.path).sort()).toEqual(["a.md", "b.md"]);
  });

  test("allows the same path in different groups", () => {
    const work = createBookmarkGroup("lib-a", "Work");
    const personal = createBookmarkGroup("lib-a", "Personal");
    addBookmark("lib-a", { path: "shared.md", groupId: work.id });
    addBookmark("lib-a", { path: "shared.md", groupId: personal.id });
    const items = getLibraryBookmarks("lib-a").items.filter(
      (item) => item.path === "shared.md",
    );
    expect(items).toHaveLength(2);
  });

  test("scopes bookmarks per library", () => {
    addBookmark("lib-a", { path: "a.md" });
    expect(isBookmarked("lib-b", "a.md")).toBe(false);
  });

  test("seeds a localized initial group for new libraries", () => {
    const data = ensureLibraryBookmarks("lib-a", "默认分组");
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.name).toBe("默认分组");
    expect(getLibraryBookmarks("lib-a").groups[0]?.name).toBe("默认分组");
  });

  test("collapses and expands all groups", () => {
    addBookmark("lib-a", { path: "a.md" });
    const extra = createBookmarkGroup("lib-a", "Extra");
    setAllBookmarkGroupsCollapsed("lib-a", true);
    expect(getLibraryBookmarks("lib-a").collapsedGroupIds.sort()).toEqual(
      [DEFAULT_BOOKMARK_GROUP_ID, extra.id].sort(),
    );
    setBookmarkGroupCollapsed("lib-a", extra.id, false);
    expect(getLibraryBookmarks("lib-a").collapsedGroupIds).toEqual([
      DEFAULT_BOOKMARK_GROUP_ID,
    ]);
    setAllBookmarkGroupsCollapsed("lib-a", false);
    expect(getLibraryBookmarks("lib-a").collapsedGroupIds).toEqual([]);
  });
});
