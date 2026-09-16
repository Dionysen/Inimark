import type { ChatAttachment } from "../types.ts";

/** Soft character budget for packed attachment context (~tokens*4). */
export const DEFAULT_CONTEXT_BUDGET = 48_000;

export interface PackedAttachmentBlock {
  path: string;
  kind: ChatAttachment["kind"];
  body: string;
  truncated: boolean;
}

export interface ContextPackResult {
  text: string;
  blocks: PackedAttachmentBlock[];
}

export interface AttachmentContent {
  attachment: ChatAttachment;
  /** Full file text, or directory listing text. */
  content: string;
}

/**
 * Pack explicit attachments into a context string under a character budget.
 * Larger items are truncated with a clear marker; directories stay as listings.
 */
export function packAttachmentContext(
  items: AttachmentContent[],
  budget: number = DEFAULT_CONTEXT_BUDGET,
): ContextPackResult {
  const blocks: PackedAttachmentBlock[] = [];
  let remaining = Math.max(0, budget);
  const parts: string[] = [];

  for (const item of items) {
    if (remaining <= 0) break;
    const header =
      item.attachment.kind === "directory"
        ? `### Directory: ${item.attachment.path || item.attachment.label}`
        : item.attachment.kind === "active-note"
          ? `### Active note: ${item.attachment.path || item.attachment.label}`
          : `### File: ${item.attachment.path || item.attachment.label}`;

    const overhead = header.length + 8;
    const available = Math.max(0, remaining - overhead);
    let body = item.content;
    let truncated = false;
    if (body.length > available) {
      body = `${body.slice(0, available)}\n\n[truncated]`;
      truncated = true;
    }
    const block: PackedAttachmentBlock = {
      path: item.attachment.path,
      kind: item.attachment.kind,
      body,
      truncated,
    };
    blocks.push(block);
    const chunk = `${header}\n\n${body}`;
    parts.push(chunk);
    remaining -= chunk.length + 2;
  }

  return {
    text: parts.join("\n\n"),
    blocks,
  };
}

/** Build a compact directory tree listing (name + kind per line). */
export function formatDirectoryListing(
  entries: Array<{ name: string; kind: "file" | "directory"; path: string }>,
  maxEntries = 200,
): string {
  const slice = entries.slice(0, maxEntries);
  const lines = slice.map((e) => `${e.kind === "directory" ? "dir" : "file"}\t${e.path}`);
  if (entries.length > maxEntries) {
    lines.push(`… ${entries.length - maxEntries} more`);
  }
  return lines.join("\n");
}
