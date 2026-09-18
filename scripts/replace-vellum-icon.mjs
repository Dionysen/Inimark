#!/usr/bin/env node
/**
 * Generate multi-platform icons from apps/vellum/app-icon.svg into
 * apps/vellum/src-tauri/icons/ (same pipeline as replace-icon.mjs).
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
const sourcePath = path.join(root, "apps/vellum/app-icon.svg");
const iconsDir = path.join(root, "apps/vellum/src-tauri/icons");

const DOCK_OPTICAL_SCALE = 0.82;
const CANVAS_SIZE = 1024;
const CORNER_RATIO = 0.2237;

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

/**
 * Render the SVG at the icon canvas size.
 * Sharp's default 72dpi keeps the file's own pixel size, then a later resize
 * would only upscale that raster.
 */
async function rasterizeSvg(svgPath) {
  const probe = await sharp(svgPath).metadata();
  const sourceWidth = probe.width ?? CANVAS_SIZE;
  const density = Math.max(72, Math.ceil((72 * CANVAS_SIZE) / sourceWidth));
  const outPath = path.join(tmpdir(), `vellum-icon-svg-${Date.now()}.png`);
  await sharp(svgPath, { density })
    .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: "fill" })
    .png()
    .toFile(outPath);
  return outPath;
}

async function createDesktopSource(src) {
  const outPath = path.join(tmpdir(), `vellum-icon-desktop-${Date.now()}.png`);
  const masked = await applyAppleCorners(src, CANVAS_SIZE);
  await sharp(masked).toFile(outPath);
  return outPath;
}

async function createMacSource(src) {
  const contentSize = Math.round(CANVAS_SIZE * DOCK_OPTICAL_SCALE);
  const offset = Math.round((CANVAS_SIZE - contentSize) / 2);
  const outPath = path.join(tmpdir(), `vellum-icon-mac-${Date.now()}.png`);
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
    `pnpm --filter @vellum/app exec tauri icon "${input}" --output "${output}"`,
    { cwd: root, stdio: "inherit" },
  );
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
  process.exit(1);
}

const raster = await rasterizeSvg(sourcePath);
const desktopSource = await createDesktopSource(raster);
const macSource = await createMacSource(raster);
const desktopOut = path.join(tmpdir(), `vellum-icons-desktop-${Date.now()}`);
const macOut = path.join(tmpdir(), `vellum-icons-mac-${Date.now()}`);

try {
  console.log("[1/2] Generating Windows / Linux icons...");
  runTauriIcon(desktopSource, desktopOut);
  console.log("[2/2] Generating macOS icons...");
  runTauriIcon(macSource, macOut);
  copyDir(desktopOut, iconsDir);
  const macIcns = path.join(macOut, "icon.icns");
  if (fs.existsSync(macIcns)) {
    fs.copyFileSync(macIcns, path.join(iconsDir, "icon.icns"));
  }
  console.log(`Icons written to ${iconsDir}`);
} catch (error) {
  console.error("Failed to generate icons:", error.message);
  process.exit(1);
} finally {
  fs.rmSync(raster, { force: true });
  fs.rmSync(desktopSource, { force: true });
  fs.rmSync(macSource, { force: true });
  fs.rmSync(desktopOut, { recursive: true, force: true });
  fs.rmSync(macOut, { recursive: true, force: true });
}
