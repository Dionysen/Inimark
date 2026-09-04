import { beforeEach, describe, expect, test } from "vitest";

import {
  getLastLibraryId,
  getLibrarySession,
  libraryIdFromPath,
  listLibraries,
  loadLibrariesConfig,
  removeLibrary,
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
    });

    const session = getLibrarySession(library.id);
    expect(session.activeFilePath).toBe("notes/intro.md");
    expect(session.expandedDirs).toEqual(["notes", "archive"]);
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

  test("creates stable ids from paths", () => {
    expect(libraryIdFromPath("C:\\Vault\\Notes")).toBe("c:/vault/notes");
    expect(libraryIdFromPath("C:/Vault/Notes")).toBe("c:/vault/notes");
  });
});
