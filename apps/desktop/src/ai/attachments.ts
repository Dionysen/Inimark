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
