/** Desktop injects vault-aware wiki-link helpers into the editor package. */

export type WikiNoteHit = { name: string; path: string };

/** How wiki-link note previews are triggered in the editor. */
export type WikiLinkPreviewTrigger = "modifier" | "hover";

export interface WikiLinkBridge {
  resolveNote(noteName: string): string | null;
  resolveImage(name: string): string | null;
  /** Absolute or app-usable URL for an image relative path. */
  imageUrl?(relativePath: string): string | null;
  searchNotes(query: string, limit?: number): WikiNoteHit[];
  /** Recently opened notes (browse mode only). */
  recentNotes?(limit?: number): WikiNoteHit[];
  openNote(noteName: string, heading?: string): void;
  createNote?(noteName: string): void;
  /** Markdown source for hover card (rendered by the editor). */
  previewNote?(noteName: string): Promise<string | null>;
  /**
   * Preview trigger mode. Defaults to `modifier` (Ctrl/⌘ + hover).
   * Prefer a live getter so settings changes apply without rebinding the bridge.
   */
  previewTrigger?(): WikiLinkPreviewTrigger;
}

let bridge: WikiLinkBridge | null = null;

export function setWikiLinkBridge(next: WikiLinkBridge | null): void {
  bridge = next;
}

export function getWikiLinkBridge(): WikiLinkBridge | null {
  return bridge;
}
