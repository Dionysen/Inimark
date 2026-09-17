import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  detectPureWriterPayload,
  exportVaultToRoomDb,
  importPureWriterBytesToVault,
  loadVaultContentFromFs,
  savePureWriterFile,
  loadPureWriterFile,
} from "../src/node.ts";
import { encodePwb, decodePwb, PWB_7Z_MAGIC } from "../src/pwb-codec.ts";

describe("node adapters", () => {
  it("exports a vault directory to Room.db and imports it back", async () => {
    const root = await mkdtemp(join(tmpdir(), "inimark-pw-vault-"));
    const out = await mkdtemp(join(tmpdir(), "inimark-pw-out-"));
    try {
      await mkdir(join(root, "诗"), { recursive: true });
      await writeFile(join(root, "诗", "春.txt"), "春风又绿", "utf8");
      await writeFile(join(root, "readme.md"), "# hi\n", "utf8");

      const db = await exportVaultToRoomDb(root, { nowMs: 1_700_000_000_000 });
      expect(detectPureWriterPayload(db)).toBe("room-db");

      await importPureWriterBytesToVault(db, out);
      const vault = await loadVaultContentFromFs(out);
      const paths = vault.notes.map((n) => n.path).sort();
      expect(paths).toContain("诗/春.txt");
      expect(paths).toContain("Default/readme.md");
      expect(vault.notes.find((n) => n.path.endsWith("春.txt"))?.content).toBe("春风又绿");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    }
  });

  it("packs and unpacks .pwb when 7-Zip is available", async () => {
    const root = await mkdtemp(join(tmpdir(), "inimark-pw-pwb-"));
    try {
      await writeFile(join(root, "a.md"), "alpha", "utf8");
      const db = await exportVaultToRoomDb(root, { nowMs: 1_700_000_000_000 });

      let pwb: Uint8Array;
      try {
        pwb = await encodePwb(db, { archiveBaseName: "PureWriterBackup-test" });
      } catch (error) {
        // No 7-Zip on this machine / CI image.
        console.warn("skip pwb test:", error);
        return;
      }

      expect(pwb[0]).toBe(PWB_7Z_MAGIC[0]);
      expect(detectPureWriterPayload(pwb)).toBe("pwb");

      const roundDb = await decodePwb(pwb);
      expect(detectPureWriterPayload(roundDb)).toBe("room-db");

      const pwbPath = join(root, "backup.pwb");
      await writeFile(pwbPath, pwb);
      // save/load via library file helpers
      const library = await loadPureWriterFile(pwbPath);
      expect(library.articles.length).toBeGreaterThanOrEqual(1);

      const dbPath = join(root, "backup.db");
      await savePureWriterFile(dbPath, library);
      const head = await readFile(dbPath);
      expect(head.subarray(0, 15).toString()).toBe("SQLite format 3");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
