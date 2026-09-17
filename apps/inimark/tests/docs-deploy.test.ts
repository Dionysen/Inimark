import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  buildGhPagesCommitMessage,
  deployDistToGhPages,
  GH_PAGES_BRANCH,
  GH_PAGES_NOJEKYLL,
} from "../../../scripts/lib/deploy-gh-pages.ts";
import { docsDistDir, repoRootFromDocsVault } from "../src/publish/docs-path.ts";

const suiteTmp = join(process.cwd(), "tests", ".tmp-docs-deploy");

describe("docs-path", () => {
  test("repoRootFromDocsVault strips the docs segment", () => {
    expect(repoRootFromDocsVault("/Users/me/Inimark/docs")).toBe("/Users/me/Inimark");
    expect(repoRootFromDocsVault("/Users/me/Inimark/docs/")).toBe("/Users/me/Inimark");
  });

  test("docsDistDir joins out relative to vault", () => {
    expect(docsDistDir("/repo/docs", "dist")).toBe("/repo/docs/dist");
    expect(docsDistDir("/repo/docs/", "site")).toBe("/repo/docs/site");
  });
});

describe("deploy-gh-pages", () => {
  test("commit message and constants", () => {
    expect(buildGhPagesCommitMessage("2026-09-12T08:00:00.000Z")).toBe(
      "docs: publish site (2026-09-12T08:00:00.000Z)",
    );
    expect(GH_PAGES_BRANCH).toBe("gh-pages");
    expect(GH_PAGES_NOJEKYLL).toBe(".nojekyll");
  });

  test("dry-run prepares commit and skips push", () => {
    mkdirSync(suiteTmp, { recursive: true });
    const root = mkdtempSync(join(suiteTmp, "root-"));
    const dist = join(root, "dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");

    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
    } catch {
      // Some sandboxes block writing `.git/hooks`; pure helpers above still run.
      rmSync(suiteTmp, { recursive: true, force: true });
      return;
    }

    execFileSync("git", ["remote", "add", "origin", "https://example.com/repo.git"], {
      cwd: root,
      stdio: "ignore",
    });

    const logs: string[] = [];
    try {
      const result = deployDistToGhPages({
        distDir: dist,
        repoRoot: root,
        dryRun: true,
        workParent: suiteTmp,
        now: () => new Date("2026-09-12T08:00:00.000Z"),
        log: (m) => logs.push(m),
      });
      expect(result.dryRun).toBe(true);
      expect(result.branch).toBe("gh-pages");
      expect(result.remote).toBe("https://example.com/repo.git");
      expect(result.commitMessage).toBe("docs: publish site (2026-09-12T08:00:00.000Z)");
      expect(logs.some((l) => l.includes("[dry-run]"))).toBe(true);
      expect(readFileSync(join(dist, "index.html"), "utf8")).toContain("ok");
    } finally {
      rmSync(suiteTmp, { recursive: true, force: true });
    }
  });
});
