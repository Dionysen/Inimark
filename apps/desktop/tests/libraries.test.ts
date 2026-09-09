import { beforeEach, describe, expect, test } from "vitest";

import {
  getLastLibraryId,
  getLibrarySession,
  libraryIdFromPath,
  listLibraries,
  loadLibrariesConfig,
  removeLibrary,
  renameLibrary,
  saveLibrarySession,
  upsertLibrary,
} from "../src/libraries/store.ts";

describe("libraries store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("upserts libraries and tracks last opened", () => {
    const first = upsertLibrary("C:/notes", "notes");
    const second = upsertLibrary("D:/docs", "docs");

    expect(listLibraries().map((library) => library.rootName)).toEqual(["docs", "notes"]);
    expect(getLastLibraryId()).toBe(second.id);

    upsertLibrary(first.rootPath, "notes");
    expect(getLastLibraryId()).toBe(first.id);
    expect(listLibraries()[0]?.id).toBe(first.id);
  });

  test("persists per-library session state", () => {
    const library = upsertLibrary("/vault", "vault");
    saveLibrarySession(library.id, {
      activeFilePath: "notes/intro.md",
      expandedDirs: ["notes", "archive"],
      fileViews: {
        "notes/intro.md": {
          anchor: 120,
          scrollTop: 480,
          updatedAt: 1,
        },
      },
    });

    const session = getLibrarySession(library.id);
    expect(session.activeFilePath).toBe("notes/intro.md");
    expect(session.expandedDirs).toEqual(["notes", "archive"]);
    expect(session.fileViews?.["notes/intro.md"]).toEqual({
      anchor: 120,
      scrollTop: 480,
      updatedAt: 1,
    });
  });

  test("removes libraries and their session state", () => {
    const library = upsertLibrary("/vault", "vault");
    saveLibrarySession(library.id, {
      activeFilePath: "readme.md",
      expandedDirs: [],
    });

    removeLibrary(library.id);

    expect(listLibraries()).toHaveLength(0);
    expect(getLastLibraryId()).toBeNull();
    expect(loadLibrariesConfig().sessions[library.id]).toBeUndefined();
  });

  test("renames libraries and preserves custom names on reopen", () => {
    const library = upsertLibrary("/vault/notes", "notes");
    const renamed = renameLibrary(library.id, "My Notes");
    expect(renamed?.rootName).toBe("My Notes");
    expect(listLibraries().find((item) => item.id === library.id)?.rootName).toBe(
      "My Notes",
    );

    upsertLibrary("/vault/notes", "notes");
    expect(listLibraries().find((item) => item.id === library.id)?.rootName).toBe(
      "My Notes",
    );
    expect(renameLibrary(library.id, "bad/name")).toBeNull();
    expect(renameLibrary(library.id, "   ")).toBeNull();
  });

  test("creates stable ids from paths", () => {
    expect(libraryIdFromPath("C:\\Vault\\Notes")).toBe("c:/vault/notes");
    expect(libraryIdFromPath("C:/Vault/Notes")).toBe("c:/vault/notes");
  });
});
