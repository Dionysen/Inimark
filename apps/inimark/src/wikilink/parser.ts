export interface WikiLink {
  raw: string;
  noteName: string;
  heading?: string;
  alias?: string;
  isEmbed: boolean;
  startIndex: number;
  endIndex: number;
}

/** Parse Obsidian-style `[[…]]` / `![[…]]` from markdown source. */
export function parseWikiLinks(markdown: string): WikiLink[] {
  const regex = /!?\[\[([^\]]+)\]\]/g;
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const raw = match[0]!;
    const content = match[1]!;
    const isEmbed = raw.startsWith("!");

    const pipeIndex = content.indexOf("|");
    const displayPart = pipeIndex >= 0 ? content.slice(pipeIndex + 1) : undefined;
    const notePart = pipeIndex >= 0 ? content.slice(0, pipeIndex) : content;

    const hashIndex = notePart.indexOf("#");
    const noteName = hashIndex >= 0 ? notePart.slice(0, hashIndex) : notePart;
    const heading = hashIndex >= 0 ? notePart.slice(hashIndex + 1) : undefined;

    links.push({
      raw,
      noteName: noteName.trim(),
      heading: heading?.trim() || undefined,
      alias: displayPart?.trim() || undefined,
      isEmbed,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  return links;
}

export function isImageWikiTarget(noteName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|heic|heif|tiff?|apng|jfif|jxl)$/i.test(
    noteName,
  );
}
