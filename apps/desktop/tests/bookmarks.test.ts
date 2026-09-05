import { beforeEach, describe, expect, test } from "vitest";

import {
  BOOKMARKS_STORAGE_KEY,
  DEFAULT_BOOKMARK_GROUP_ID,
  addBookmark,
  createBookmarkGroup,
  deleteBookmarkGroup,
  findBookmarkByPath,
  getLibraryBookmarks,
  isBookmarked,
  remapBookmarkPath,
  removeBookmark,
  removeBookmarksUnder,
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

  test("deleting a custom group moves items to default", () => {
    const group = createBookmarkGroup("lib-a", "Temp");
    addBookmark("lib-a", {
      path: "x.md",
      groupId: group.id,
    });
    expect(deleteBookmarkGroup("lib-a", group.id)).toBe(true);
    expect(findBookmarkByPath("lib-a", "x.md")?.groupId).toBe(
      DEFAULT_BOOKMARK_GROUP_ID,
    );
    expect(deleteBookmarkGroup("lib-a", DEFAULT_BOOKMARK_GROUP_ID)).toBe(false);
  });

  test("scopes bookmarks per library", () => {
    addBookmark("lib-a", { path: "a.md" });
    expect(isBookmarked("lib-b", "a.md")).toBe(false);
  });
});
