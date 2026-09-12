import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyMarketingLanding,
  LANDING_VERSION_PLACEHOLDER,
  type SiteBuildResult,
} from "../src/index.ts";
import { loadMarketingLandingFromFs } from "../src/node.ts";

function emptyBuild(): SiteBuildResult {
  return {
    files: [
      {
        path: "index.html",
        content: "<!DOCTYPE html><html><body>redirect</body></html>",
      },
      { path: "assets/site.js", content: "/* site */" },
    ],
    media: [],
    outRelative: "dist",
    pageCount: 1,
  };
}

describe("applyMarketingLanding", () => {
  it("replaces index.html, writes en page, and merges media without dropping site assets", () => {
    const built = emptyBuild();
    const next = applyMarketingLanding(built, {
      zhHtml: `<html>zh ${LANDING_VERSION_PLACEHOLDER}</html>`,
      enHtml: `<html>en ${LANDING_VERSION_PLACEHOLDER}</html>`,
      staticFiles: [{ path: "site-theme.css", content: ".x{}" }],
      media: [
        { from: "/tmp/note-light.png", to: "assets/note-light.png" },
        { from: "/tmp/icon.png", to: "icon.png" },
      ],
      version: "9.9.9",
    });

    expect(next.files.find((f) => f.path === "index.html")!.content).toBe(
      "<html>zh 9.9.9</html>",
    );
    expect(next.files.find((f) => f.path === "en/index.html")!.content).toBe(
      "<html>en 9.9.9</html>",
    );
    expect(next.files.find((f) => f.path === "site-theme.css")!.content).toBe(".x{}");
    expect(next.files.find((f) => f.path === "assets/site.js")!.content).toBe("/* site */");
    expect(next.media.map((m) => m.to)).toEqual([
      "assets/note-light.png",
      "icon.png",
    ]);
    // Original build object must stay unchanged.
    expect(built.files.find((f) => f.path === "index.html")!.content).toContain("redirect");
  });
});

describe("loadMarketingLandingFromFs", () => {
  it("loads real landing files and screenshot media plans from a temp vault", async () => {
    const vault = mkdtempSync(join(tmpdir(), "inimark-landing-"));
    const landing = join(vault, "landing");
    const assets = join(vault, "assets");
    mkdirSync(join(landing, "en"), { recursive: true });
    mkdirSync(assets, { recursive: true });

    writeFileSync(
      join(landing, "index.html"),
      `<html>zh ${LANDING_VERSION_PLACEHOLDER}</html>`,
      "utf8",
    );
    writeFileSync(
      join(landing, "en", "index.html"),
      `<html>en ${LANDING_VERSION_PLACEHOLDER}</html>`,
      "utf8",
    );
    writeFileSync(join(landing, "site-theme.css"), "/* theme */", "utf8");
    writeFileSync(join(landing, "site-theme.js"), "/* js */", "utf8");
    writeFileSync(join(landing, "site-topbar.css"), "/* topbar */", "utf8");
    writeFileSync(join(landing, "icon.png"), "icon-bytes");
    writeFileSync(join(landing, "favicon.png"), "fav-bytes");
    writeFileSync(join(assets, "note-light.png"), "shot-a");
    writeFileSync(join(assets, "note-dark.png"), "shot-b");

    const bundle = await loadMarketingLandingFromFs({
      vaultPath: vault,
      version: "1.2.3",
    });
    expect(bundle).not.toBeNull();
    expect(bundle!.zhHtml).toContain(LANDING_VERSION_PLACEHOLDER);
    expect(bundle!.enHtml).toContain("en");
    expect(bundle!.staticFiles.map((f) => f.path).sort()).toEqual([
      "site-theme.css",
      "site-theme.js",
      "site-topbar.css",
    ]);
    expect(bundle!.media.some((m) => m.to === "assets/note-light.png")).toBe(true);
    expect(bundle!.media.some((m) => m.to === "icon.png")).toBe(true);

    const applied = applyMarketingLanding(emptyBuild(), bundle!);
    expect(applied.files.find((f) => f.path === "index.html")!.content).toBe(
      "<html>zh 1.2.3</html>",
    );
  });

  it("returns null when landing/index.html is missing", async () => {
    const vault = mkdtempSync(join(tmpdir(), "inimark-no-landing-"));
    const bundle = await loadMarketingLandingFromFs({
      vaultPath: vault,
      version: "0.0.1",
    });
    expect(bundle).toBeNull();
  });
});
