import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  decodeRoomDatabase,
  encodeRoomDatabase,
  initRoomSqlJs,
} from "../src/room-codec.ts";
import { libraryToVault, vaultToLibrary } from "../src/vault-map.ts";
import type { VaultContent } from "../src/types.ts";

const require = createRequire(import.meta.url);

async function sql() {
  const distDir = dirname(require.resolve("sql.js"));
  return initRoomSqlJs({
    locateFile: (file: string) => join(distDir, file),
  });
}

describe("Room.db codec", () => {
  it("round-trips a vault through Room.db bytes", async () => {
    const SQL = await sql();
    const vault: VaultContent = {
      notes: [
        { path: "日记/2024-01-01.md", content: "晴。写一点字。\n第二行。" },
        { path: "诗/夜.md", content: "月色" },
      ],
    };

    const library = vaultToLibrary(vault, { nowMs: 1_700_000_000_000 });
    const bytes = encodeRoomDatabase(SQL, library);
    expect(bytes.byteLength).toBeGreaterThan(1024);
    expect(String.fromCharCode(...bytes.slice(0, 15))).toBe("SQLite format 3");

    const decoded = decodeRoomDatabase(SQL, bytes);
    expect(decoded.folders.length).toBe(library.folders.length);
    expect(decoded.articles.length).toBe(2);
    expect(decoded.userVersion).toBe(27);

    const night = decoded.articles.find((a) => a.title === "夜");
    expect(night?.content).toBe("月色");

    const back = libraryToVault(decoded);
    expect(back.notes.map((n) => n.path).sort()).toEqual(
      ["日记/2024-01-01.md", "诗/夜.md"].sort(),
    );
  });

  it("reads a real Pure Writer Room.db when present", async () => {
    const roomPath = "C:/Users/zhaoys-c/Documents/PureWriter/App/Room.db";
    const { readFile } = await import("node:fs/promises");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(roomPath));
    } catch {
      // Machine without Pure Writer data — skip without failing CI.
      return;
    }

    const SQL = await sql();
    const library = decodeRoomDatabase(SQL, bytes);
    expect(library.folders.length).toBeGreaterThan(0);
    expect(library.articles.length).toBeGreaterThan(0);

    const vault = libraryToVault(library);
    expect(vault.notes.length).toBeGreaterThan(0);
    expect(vault.notes.every((n) => n.content != null)).toBe(true);

    // Re-encode should remain a valid sqlite database Pure Writer schema can open.
    const encoded = encodeRoomDatabase(SQL, {
      ...library,
      // Keep notes only — drop settings noise is fine; keep articles/folders/categories.
      settings: [],
    });
    const again = decodeRoomDatabase(SQL, encoded);
    expect(again.articles.length).toBe(library.articles.length);
  });
});
