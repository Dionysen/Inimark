#!/usr/bin/env node
/**
 * Build (and optionally deploy) the Inimark docs vault via Publish SSG.
 *
 * Usage:
 *   pnpm docs:build
 *   pnpm docs:deploy              # push existing docs/dist (after Dev build)
 *   pnpm docs:deploy -- --rebuild # CLI build then push
 *   pnpm docs:build -- --base=/
 *   pnpm docs:deploy -- --dry-run
 *
 * Deploys the built site to the `gh-pages` branch of origin so that
 * https://dionysen.github.io/Inimark/ can serve it (project Pages).
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { installHappyDom } from "./lib/install-happy-dom.ts";
import { deployDistToGhPages } from "./lib/deploy-gh-pages.ts";

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
  --skip-build     With --deploy, push existing dist only (default for pnpm docs:deploy)
  --rebuild        With --deploy, build via CLI then push
  --dry-run        With --deploy, prepare commit but skip git push
  --help           Show this help

Typical flow (match Dev Publish Docs output):
  1. Settings → Dev → Publish Docs → Build
     (applies docs/landing marketing homepage when present)
  2. pnpm docs:deploy
`);
}

function parseArgs(argv: string[]) {
  const opts = {
    vault: join(root, "docs"),
    base: undefined as string | undefined,
    out: undefined as string | undefined,
    deploy: false,
    skipBuild: false,
    rebuild: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--deploy") opts.deploy = true;
    else if (arg === "--skip-build") opts.skipBuild = true;
    else if (arg === "--rebuild") opts.rebuild = true;
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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  // `pnpm docs:deploy` passes --skip-build: push Dev (or prior) dist only.
  const deployOnly = opts.deploy && opts.skipBuild && !opts.rebuild;
  if (deployOnly) {
    const outRel = opts.out || "dist";
    const outDir = join(opts.vault, outRel);
    if (!existsSync(outDir)) {
      throw new Error(
        `Missing ${outDir}. Build first in Settings → Dev → Publish Docs, or run: pnpm docs:build`,
      );
    }
    console.log(`Deploying existing site: ${outDir}`);
    deployDistToGhPages({
      distDir: outDir,
      repoRoot: root,
      dryRun: opts.dryRun,
    });
    return;
  }

  const { buildSite } = await import("../packages/site-render/src/index.ts");
  const { loadVaultFromFs, writeSiteToFs } = await import(
    "../packages/site-render/src/node.ts"
  );

  const vault = await loadVaultFromFs(opts.vault);
  const { existsSync } = await import("node:fs");
  const { LANDING_DIR_NAME } = await import("../packages/site-render/src/index.ts");
  const showSiteHome = existsSync(join(opts.vault, LANDING_DIR_NAME, "index.html"));
  const config = {
    ...vault.config,
    ...(opts.base != null ? { baseHref: opts.base } : {}),
    ...(opts.out != null ? { out: opts.out } : {}),
    ...(showSiteHome ? { showSiteHome: true } : {}),
  };

  // Project Pages require this prefix; keep config as source of truth.
  if (!config.baseHref || config.baseHref === "/") {
    console.warn(
      `[warn] baseHref is "${config.baseHref}". For https://dionysen.github.io/Inimark/ use "/Inimark/".`,
    );
  }

  const { CODE_THEMES } = await import("../apps/desktop/src/themes/code-themes.ts");
  const { buildPublishCodeThemeCss } = await import(
    "../apps/desktop/src/themes/code-bridge.ts"
  );

  const lightCodeId = config.lightCodeTheme || "github-light";
  const darkCodeId = config.darkCodeTheme || "github-dark";
  const lightCode =
    CODE_THEMES.find((t) => t.id === lightCodeId) ??
    CODE_THEMES.find((t) => t.id === "github-light")!;
  const darkCode =
    CODE_THEMES.find((t) => t.id === darkCodeId) ??
    CODE_THEMES.find((t) => t.id === "github-dark")!;

  const themeVariablesCss = [
    readCss(join(root, "apps/desktop/src/styles/themes.css")),
    buildPublishCodeThemeCss(lightCode.variables, darkCode.variables),
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

  let built = await buildSite({
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

  const { applyMarketingLanding } = await import("../packages/site-render/src/index.ts");
  const { loadMarketingLandingFromFs } = await import(
    "../packages/site-render/src/node.ts"
  );
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version?: string;
  };
  const landing = await loadMarketingLandingFromFs({
    vaultPath: opts.vault,
    version: pkg.version || "0.0.0",
    fallbackIconPath: join(root, "apps/desktop/src-tauri/icons/icon.png"),
  });
  if (landing) {
    built = applyMarketingLanding(built, landing);
    console.log("  marketing landing: applied (docs/landing)");
  }

  const outDir = join(opts.vault, built.outRelative);
  await writeSiteToFs(outDir, built, { clean: true });
  console.log(`Wrote ${built.pageCount} pages → ${outDir}`);

  if (opts.deploy) {
    deployDistToGhPages({
      distDir: outDir,
      repoRoot: root,
      dryRun: opts.dryRun,
    });
  } else {
    console.log("Build only. Deploy existing dist with: pnpm docs:deploy");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
