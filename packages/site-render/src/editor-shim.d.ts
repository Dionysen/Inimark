declare module "@inimark/editor" {
  export interface OutlineItem {
    id: string;
    level: number;
    text: string;
  }

  export interface StaticExportOptions {
    rewriteSrc?: (src: string) => string | null;
    resolveWikiHref?: (
      note: string,
      heading?: string,
    ) => { href: string; unresolved?: boolean } | null;
  }

  export interface StaticExportResult {
    html: string;
    outline: OutlineItem[];
    assetSrcs: string[];
  }

  export function renderMarkdownToStaticHtml(
    markdown: string,
    options?: StaticExportOptions,
  ): StaticExportResult;

  export interface WikiLinkBridge {
    resolveNote(noteName: string): string | null;
    resolveImage(name: string): string | null;
    imageUrl?(relativePath: string): string | null;
    searchNotes(
      query: string,
      limit?: number,
    ): Array<{ name: string; path: string }>;
    recentNotes?(limit?: number): Array<{ name: string; path: string }>;
    openNote(noteName: string, heading?: string): void;
    createNote?(noteName: string): void;
    previewNote?(noteName: string): Promise<string | null>;
  }

  export function setWikiLinkBridge(next: WikiLinkBridge | null): void;
}
