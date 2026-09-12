#!/usr/bin/env node
/**
 * Build (and optionally deploy) the Inimark docs vault via Publish SSG.
 *
 * Usage:
 *   pnpm docs:build
 *   pnpm docs:deploy
 *   pnpm docs:build -- --base=/
 *   pnpm docs:deploy -- --dry-run
 *
 * Deploys the built site to the `gh-pages` branch of origin so that
 * https://dionysen.github.io/Inimark/ can serve it (project Pages).
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

import { installHappyDom } from "./lib/install-happy-dom.ts";

installHappyDom();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const BUILTIN_THEMES = [
  "light",
  "grey",
  "slate",
  "claude-code",
  "mint",
  "purple",
  "hermes",
  "ocean",
  "dark-modern",
  "cursor",
  "dracula",
] as const;

function printHelp(): void {
  console.log(`Usage: pnpm docs:build|docs:deploy [-- options]

Options:
  --vault <path>   Docs vault root (default: <repo>/docs)
  --base <href>    Override baseHref (default: from publish.config.json)
  --out <dir>      Override output dir relative to vault (default: dist)
  --deploy         Push docs/dist to origin gh-pages (force)
  --dry-run        Build only; with --deploy, skip the git push
  --help           Show this help
`);
}

function parseArgs(argv: string[]) {
  const opts = {
    vault: join(root, "docs"),
    base: undefined as string | undefined,
    out: undefined as string | undefined,
    deploy: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--deploy") opts.deploy = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--vault") opts.vault = resolve(argv[++i] ?? "");
    else if (arg === "--base") opts.base = argv[++i];
    else if (arg === "--out") opts.out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function readCss(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

function resolveKatexCss(): string {
  const katexPkg = require.resolve("katex/package.json", {
    paths: [join(root, "packages/editor"), join(root, "apps/desktop")],
  });
  return readCss(join(dirname(katexPkg), "dist", "katex.min.css"));
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function deployToGhPages(distDir: string, dryRun: boolean): void {
  const remote = git(["remote", "get-url", "origin"], root);
  const stamp = new Date().toISOString();

  const work = mkdtempSync(join(tmpdir(), "inimark-gh-pages-"));
  try {
    cpSync(distDir, work, { recursive: true });
    writeFileSync(join(work, ".nojekyll"), "");

    execSync("git init", { cwd: work, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", "gh-pages"], { cwd: work, stdio: "ignore" });
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
        `docs: publish site (${stamp})`,
      ],
      { cwd: work, stdio: "inherit" },
    );

    if (dryRun) {
      console.log(`[dry-run] would push ${work} → ${remote} gh-pages --force`);
      return;
    }

    console.log(`Pushing to ${remote} (branch gh-pages)…`);
    execFileSync("git", ["push", remote, "gh-pages", "--force"], {
      cwd: work,
      stdio: "inherit",
    });
    console.log("Deployed. Site: https://dionysen.github.io/Inimark/");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const { buildSite } = await import("../packages/site-render/src/index.ts");
  const { loadVaultFromFs, writeSiteToFs } = await import(
    "../packages/site-render/src/node.ts"
  );

  const vault = await loadVaultFromFs(opts.vault);
  const config = {
    ...vault.config,
    ...(opts.base != null ? { baseHref: opts.base } : {}),
    ...(opts.out != null ? { out: opts.out } : {}),
  };

  // Project Pages require this prefix; keep config as source of truth.
  if (!config.baseHref || config.baseHref === "/") {
    console.warn(
      `[warn] baseHref is "${config.baseHref}". For https://dionysen.github.io/Inimark/ use "/Inimark/".`,
    );
  }

  const themeVariablesCss = [
    readCss(join(root, "apps/desktop/src/styles/themes.css")),
    resolveKatexCss(),
  ].join("\n\n");
  const editorWidgetsCss = readCss(
    join(root, "packages/editor/src/styles/widgets.css"),
  );
  const editorThemeCss = readCss(
    join(root, "packages/editor/src/styles/theme-typora.css"),
  );

  console.log(`Building vault: ${opts.vault}`);
  console.log(`  siteName=${config.siteName}`);
  console.log(`  baseHref=${config.baseHref}`);
  console.log(`  notes=${vault.notes.length}`);

  const built = buildSite({
    config,
    notes: vault.notes,
    tree: vault.tree,
    resolveNotePath: vault.resolveNotePath,
    resolveMediaAbsolutePath: (vaultRelativePath) => {
      const normalized = vaultRelativePath.replace(/\\/g, "/");
      if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
        return normalized;
      }
      return join(opts.vault, ...normalized.split("/"));
    },
    themeVariablesCss,
    editorWidgetsCss,
    editorThemeCss,
    themeIds: [...BUILTIN_THEMES],
    mermaidRuntimeJs: readFileSync(
      require.resolve("mermaid/dist/mermaid.min.js"),
      "utf8",
    ),
  });

  const outDir = join(opts.vault, built.outRelative);
  await writeSiteToFs(outDir, built, { clean: true });
  console.log(`Wrote ${built.pageCount} pages → ${outDir}`);

  if (opts.deploy) {
    deployToGhPages(outDir, opts.dryRun);
  } else {
    console.log("Build only. Deploy with: pnpm docs:deploy");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
