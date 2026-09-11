/** Minimal Obsidian-style `[[…]]` / `![[…]]` parser for site link graphs. */

export interface WikiLinkRef {
  noteName: string;
  isEmbed: boolean;
}

/**
 * Extract wiki note targets from markdown source.
 * Skips image embeds (`![[foo.png]]`).
 */
export function parseWikiNoteTargets(markdown: string): WikiLinkRef[] {
  const regex = /!?\[\[([^\]]+)\]\]/g;
  const out: WikiLinkRef[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const raw = match[0]!;
    const content = match[1]!;
    const isEmbed = raw.startsWith("!");
    const pipeIndex = content.indexOf("|");
    const notePart = pipeIndex >= 0 ? content.slice(0, pipeIndex) : content;
    const hashIndex = notePart.indexOf("#");
    const noteName = (hashIndex >= 0 ? notePart.slice(0, hashIndex) : notePart).trim();
    if (!noteName) continue;
    if (isEmbed && /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|heic|heif|tiff?|apng|jfif|jxl)$/i.test(noteName)) {
      continue;
    }
    out.push({ noteName, isEmbed });
  }

  return out;
}
