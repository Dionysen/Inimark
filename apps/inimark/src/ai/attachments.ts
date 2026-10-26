import type { ChatAttachment } from "./types.ts";
import { isAiVisionImagePath } from "./vision.ts";

function isExplicitAttachment(kind: ChatAttachment["kind"]): boolean {
  return kind === "file" || kind === "directory" || kind === "image";
}

/**
 * Build the attachment list for a send.
 * User file/folder/image chips win; only when none are present may we silently
 * include the current note (never shown as a chip).
 */
export function resolveSendAttachments(options: {
  userAttachments: readonly ChatAttachment[];
  activeFilePath: string | null | undefined;
  attachActiveNote: boolean;
  makeId: () => string;
  labelForPath: (path: string) => string;
}): ChatAttachment[] {
  const explicit = options.userAttachments.filter((a) => isExplicitAttachment(a.kind));
  if (explicit.length > 0) return [...explicit];
  const path = options.activeFilePath?.trim();
  if (!options.attachActiveNote || !path) return [];
  return [
    {
      id: options.makeId(),
      kind: "active-note",
      path,
      label: options.labelForPath(path),
    },
  ];
}

/** Merge vault paths into the user-visible attachment chips (dedupe by kind+path). */
export function mergeVaultPathAttachments(
  existing: readonly ChatAttachment[],
  items: readonly { path: string; kind: "file" | "directory" }[],
  makeId: () => string,
): ChatAttachment[] {
  const next = existing.filter((a) => isExplicitAttachment(a.kind));
  const seen = new Set(next.map((a) => `${a.kind}:${a.path}`));
  for (const item of items) {
    const path = item.path.trim();
    if (!path) continue;
    const kind =
      item.kind === "file" && isAiVisionImagePath(path) ? "image" : item.kind;
    const key = `${kind}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = path.split(/[/\\]/).pop() || path;
    next.push({
      id: makeId(),
      kind,
      path,
      label: kind === "directory" ? `${base}/` : base,
    });
  }
  return next;
}
