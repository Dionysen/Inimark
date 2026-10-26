import { domToPng } from "modern-screenshot";
import { jsPDF } from "jspdf";

import { isTauri } from "../platform/env.ts";
import type { ExportFormat } from "./build-document.ts";

export interface SaveExportOptions {
  format: ExportFormat;
  /** Suggested file name without extension. */
  baseName: string;
  /** Full HTML document (HTML format). */
  html?: string;
  /** Preview iframe whose article DOM should be captured (PNG / PDF). */
  previewFrame?: HTMLIFrameElement | null;
}

export type SaveExportResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

function sanitizeBaseName(name: string): string {
  const trimmed = name.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return trimmed || "export";
}

function extensionFor(format: ExportFormat): string {
  if (format === "html") return "html";
  if (format === "png") return "png";
  return "pdf";
}

function filterFor(format: ExportFormat): { name: string; extensions: string[] } {
  if (format === "html") return { name: "HTML", extensions: ["html"] };
  if (format === "png") return { name: "PNG", extensions: ["png"] };
  return { name: "PDF", extensions: ["pdf"] };
}

async function pickSavePath(format: ExportFormat, baseName: string): Promise<string | null> {
  const safe = sanitizeBaseName(baseName);
  const ext = extensionFor(format);
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: `${safe}.${ext}`,
      filters: [filterFor(format)],
    });
    return typeof path === "string" ? path : null;
  }

  // Browser: no path picker — caller downloads via blob.
  return `${safe}.${ext}`;
}

async function writeBytes(path: string, bytes: Uint8Array, mime: string): Promise<void> {
  if (isTauri()) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, bytes);
    return;
  }
  const blob = new Blob([bytes.slice()], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeText(path: string, text: string): Promise<void> {
  if (isTauri()) {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, text);
    return;
  }
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path;
  a.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function capturePreviewPng(frame: HTMLIFrameElement): Promise<string> {
  const doc = frame.contentDocument;
  if (!doc?.body) throw new Error("Preview is not ready");
  const target =
    doc.querySelector<HTMLElement>(".inimark-export-page") ?? doc.body;

  // Wait for images inside the preview.
  const images = [...target.querySelectorAll("img")];
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );

  return domToPng(target, {
    backgroundColor: getComputedStyle(doc.documentElement).backgroundColor || "#ffffff",
    scale: Math.min(2, window.devicePixelRatio || 2),
  });
}

async function pngDataUrlToPdfBytes(pngDataUrl: string): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load PNG for PDF"));
    el.src = pngDataUrl;
  });

  const pageWidth = 210; // A4 mm
  const pageHeight = 297;
  const margin = 10;
  const usableWidthMm = pageWidth - margin * 2;
  const usableHeightMm = pageHeight - margin * 2;

  const pxPerMm = img.naturalWidth / usableWidthMm;
  const sliceHeightPx = Math.max(1, Math.floor(usableHeightMm * pxPerMm));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  let y = 0;
  let page = 0;
  while (y < img.naturalHeight) {
    const h = Math.min(sliceHeightPx, img.naturalHeight - y);
    canvas.height = h;
    ctx.clearRect(0, 0, canvas.width, h);
    ctx.drawImage(img, 0, y, img.naturalWidth, h, 0, 0, img.naturalWidth, h);
    const sliceUrl = canvas.toDataURL("image/png");
    const sliceHeightMm = h / pxPerMm;

    if (page > 0) pdf.addPage();
    pdf.addImage(
      sliceUrl,
      "PNG",
      margin,
      margin,
      usableWidthMm,
      sliceHeightMm,
      undefined,
      "FAST",
    );
    y += h;
    page += 1;
    if (page > 50) break;
  }

  const ab = pdf.output("arraybuffer");
  return new Uint8Array(ab);
}

export async function saveExport(options: SaveExportOptions): Promise<SaveExportResult> {
  try {
    const path = await pickSavePath(options.format, options.baseName);
    if (!path) return { status: "cancelled" };

    if (options.format === "html") {
      if (!options.html) throw new Error("Missing HTML document");
      await writeText(path, options.html);
      return { status: "saved", path };
    }

    if (!options.previewFrame) throw new Error("Preview is not ready");
    const pngDataUrl = await capturePreviewPng(options.previewFrame);

    if (options.format === "png") {
      await writeBytes(path, dataUrlToBytes(pngDataUrl), "image/png");
      return { status: "saved", path };
    }

    const pdfBytes = await pngDataUrlToPdfBytes(pngDataUrl);
    await writeBytes(path, pdfBytes, "application/pdf");
    return { status: "saved", path };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}
