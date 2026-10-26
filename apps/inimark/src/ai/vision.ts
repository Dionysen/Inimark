/** Vision / multimodal helpers for AI chat attachments. */

import {
  customModelProfile,
  getModelProfile,
  getProviderProfile,
  type ProviderId,
} from "./catalog/index.ts";
import type { AiPrefs } from "./secrets.ts";

/** Formats DeepSeek / OpenAI / Anthropic / Gemini commonly accept for vision. */
const AI_VISION_IMAGE =
  /\.(png|jpe?g|gif|webp)$/i;

export function isAiVisionImagePath(pathOrName: string): boolean {
  const base = pathOrName.replace(/\\/g, "/");
  const slash = base.lastIndexOf("/");
  const name = slash >= 0 ? base.slice(slash + 1) : base;
  return AI_VISION_IMAGE.test(name);
}

export function aiVisionImageMime(pathOrName: string): string {
  const base = pathOrName.replace(/\\/g, "/");
  const slash = base.lastIndexOf("/");
  const name = slash >= 0 ? base.slice(slash + 1) : base;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/** Whether the active prefs resolve to a vision-capable catalog model. */
export function prefsSupportVision(prefs: Pick<AiPrefs, "providerId" | "modelId" | "customModel">): boolean {
  if (prefs.providerId === "custom") {
    return Boolean(customModelProfile(prefs.customModel.trim() || "custom").vision);
  }
  const model =
    getModelProfile(prefs.providerId, prefs.modelId) ??
    getModelProfile(
      prefs.providerId,
      getProviderProfile(prefs.providerId as ProviderId)?.defaultModelId ?? "",
    );
  return Boolean(model?.vision);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
