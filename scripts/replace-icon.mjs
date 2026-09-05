#!/usr/bin/env node
/**
 * Generate multi-platform icons from apps/desktop/app-icon.png and replace
 * apps/desktop/src-tauri/icons/.
 *
 * Usage:
 *   pnpm replace-icon
 *   pnpm replace-icon path/to/source.png
 *
 * Mirrors Tydora's approach:
 *   - Windows / Linux: full-bleed + Apple-like rounded corners
 *   - macOS (.icns):   ~82% optical scale for Dock sizing + same corners
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultSource = path.join(root, "apps/desktop/app-icon.png");
const iconsDir = path.join(root, "apps/desktop/src-tauri/icons");
const desktopAppIcon = path.join(root, "apps/desktop/app-icon.png");

const DOCK_OPTICAL_SCALE = 0.82;
const CANVAS_SIZE = 1024;
const CORNER_RATIO = 0.2237;

const sourcePath = path.resolve(process.argv[2] || defaultSource);

function cornerMaskSvg(size) {
  const r = Math.round(size * CORNER_RATIO * 1000) / 1000;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/>` +
      `</svg>`,
  );
}

async function applyAppleCorners(input, size = CANVAS_SIZE) {
  const squared = await sharp(input)
    .ensureAlpha()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp(squared)
    .composite([{ input: cornerMaskSvg(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function createDesktopSource(src) {
  const outPath = path.join(tmpdir(), `inimark-icon-desktop-${Date.now()}.png`);
  const masked = await applyAppleCorners(src, CANVAS_SIZE);
  await sharp(masked).toFile(outPath);
  return outPath;
}

async function createMacSource(src) {
  const contentSize = Math.round(CANVAS_SIZE * DOCK_OPTICAL_SCALE);
  const offset = Math.round((CANVAS_SIZE - contentSize) / 2);
  const outPath = path.join(tmpdir(), `inimark-icon-mac-${Date.now()}.png`);
  const masked = await applyAppleCorners(src, contentSize);

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: masked, left: offset, top: offset }])
    .png()
    .toFile(outPath);

  return outPath;
}

function runTauriIcon(input, output) {
  fs.mkdirSync(output, { recursive: true });
  execSync(
    `pnpm --filter @inimark/desktop exec tauri icon "${input}" --output "${output}"`,
    { cwd: root, stdio: "inherit" },
  );
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Source icon not found: ${sourcePath}`);
  console.error("Place a square PNG at apps/desktop/app-icon.png and retry.");
  process.exit(1);
}

console.log(`Using source image: ${sourcePath}`);
console.log(
  `Corners: ${(CORNER_RATIO * 100).toFixed(2)}% radius | macOS content: ${Math.round(DOCK_OPTICAL_SCALE * 100)}%`,
);

const desktopSource = await createDesktopSource(sourcePath);
const macSource = await createMacSource(sourcePath);
const desktopOut = path.join(tmpdir(), `inimark-icons-desktop-${Date.now()}`);
const macOut = path.join(tmpdir(), `inimark-icons-mac-${Date.now()}`);

try {
  console.log("\n[1/2] Generating Windows / Linux icons (full-bleed + corners)...");
  runTauriIcon(desktopSource, desktopOut);

  console.log("\n[2/2] Generating macOS icons (82% + same corners)...");
  runTauriIcon(macSource, macOut);

  copyDir(desktopOut, iconsDir);

  const macIcns = path.join(macOut, "icon.icns");
  if (fs.existsSync(macIcns)) {
    copyFile(macIcns, path.join(iconsDir, "icon.icns"));
  }

  // Keep the master source in sync when generating from an alternate path.
  if (path.resolve(sourcePath) !== path.resolve(desktopAppIcon)) {
    copyFile(sourcePath, desktopAppIcon);
    console.log(`Updated master source: ${desktopAppIcon}`);
  }

  console.log("\nIcons written to apps/desktop/src-tauri/icons/");
  console.log("  Windows / Linux: full size + Apple-like corners");
  console.log("  macOS (.icns):   82% optical scale + same corners");
} catch (error) {
  console.error("Failed to generate icons:", error.message);
  process.exit(1);
} finally {
  fs.rmSync(desktopSource, { force: true });
  fs.rmSync(macSource, { force: true });
  fs.rmSync(desktopOut, { recursive: true, force: true });
  fs.rmSync(macOut, { recursive: true, force: true });
}

console.log("Done!");
