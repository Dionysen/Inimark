import type { ChatAttachment } from "./types.ts";

/**
 * Build the attachment list for a send.
 * User file/folder chips win; only when none are present may we silently
 * include the current note (never shown as a chip).
 */
export function resolveSendAttachments(options: {
  userAttachments: readonly ChatAttachment[];
  activeFilePath: string | null | undefined;
  attachActiveNote: boolean;
  makeId: () => string;
  labelForPath: (path: string) => string;
}): ChatAttachment[] {
  const explicit = options.userAttachments.filter(
    (a) => a.kind === "file" || a.kind === "directory",
  );
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
  const next = existing.filter((a) => a.kind === "file" || a.kind === "directory");
  const seen = new Set(next.map((a) => `${a.kind}:${a.path}`));
  for (const item of items) {
    const path = item.path.trim();
    if (!path) continue;
    const key = `${item.kind}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = path.split(/[/\\]/).pop() || path;
    next.push({
      id: makeId(),
      kind: item.kind,
      path,
      label: item.kind === "directory" ? `${base}/` : base,
    });
  }
  return next;
}
