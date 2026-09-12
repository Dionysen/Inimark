/**
 * Deploy a built static site directory to origin's `gh-pages` branch (force-push).
 * Shared by `pnpm docs:deploy` and (via mirrored Rust) the Dev settings panel.
 */

import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, execSync } from "node:child_process";

export interface DeployGhPagesOptions {
  /** Absolute path to the built site (e.g. docs/dist). */
  distDir: string;
  /** Git repository root that owns the `origin` remote. */
  repoRoot: string;
  /** When true, prepare the commit but skip `git push`. */
  dryRun?: boolean;
  /** Override clock for deterministic commit messages in tests. */
  now?: () => Date;
  log?: (message: string) => void;
  /** Parent directory for the temporary worktree (defaults to os.tmpdir()). */
  workParent?: string;
}

export interface DeployGhPagesResult {
  remote: string;
  branch: string;
  dryRun: boolean;
  /** Temporary worktree path used before cleanup (only set when dryRun keeps it — normally cleaned). */
  commitMessage: string;
}

function defaultGit(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Copy `distDir` into a fresh orphan worktree, commit as `gh-pages`, optionally force-push.
 */
export function deployDistToGhPages(options: DeployGhPagesOptions): DeployGhPagesResult {
  const { distDir, repoRoot, dryRun = false, log = console.log, workParent } = options;
  const now = options.now ?? (() => new Date());
  const stamp = now().toISOString();
  const commitMessage = `docs: publish site (${stamp})`;
  const branch = "gh-pages";

  const remote = defaultGit(["remote", "get-url", "origin"], repoRoot);
  if (!remote) {
    throw new Error("git remote 'origin' is empty");
  }

  const work = mkdtempSync(join(workParent ?? tmpdir(), "inimark-gh-pages-"));
  try {
    cpSync(distDir, work, { recursive: true });
    writeFileSync(join(work, ".nojekyll"), "");

    execSync("git init", { cwd: work, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", branch], { cwd: work, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: work, stdio: "ignore" });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Inimark Docs",
        "-c",
        "user.email=docs@inimark.local",
        "commit",
        "-m",
        commitMessage,
      ],
      { cwd: work, stdio: dryRun ? "ignore" : "inherit" },
    );

    if (dryRun) {
      log(`[dry-run] would push ${work} → ${remote} ${branch} --force`);
      return { remote, branch, dryRun: true, commitMessage };
    }

    log(`Pushing to ${remote} (branch ${branch})…`);
    execFileSync("git", ["push", remote, branch, "--force"], {
      cwd: work,
      stdio: "inherit",
    });
    log("Deployed. Site: https://dionysen.github.io/Inimark/");
    return { remote, branch, dryRun: false, commitMessage };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Pure helpers exported for unit tests (no filesystem side effects). */
export function buildGhPagesCommitMessage(stampIso: string): string {
  return `docs: publish site (${stampIso})`;
}

export const GH_PAGES_BRANCH = "gh-pages";
export const GH_PAGES_NOJEKYLL = ".nojekyll";
