/** Options for the explicit, user-triggered plain-text formatter. */
export interface PlaintextFormatOptions {
  /** Reduce each run of blank lines to one blank line. */
  collapseBlankLines: boolean;
  /** Add the configured number of ideographic spaces to every non-empty paragraph. */
  indentParagraphs: boolean;
  /** Ensure adjacent paragraph blocks have exactly one blank line between them. */
  separateParagraphs: boolean;
  /** Collapse horizontal whitespace and trim each line. */
  trimExtraSpaces: boolean;
  /** Add one space at CJK/Latin/number boundaries. */
  cjkSpacing: boolean;
}

/** Format plain text without interpreting Markdown syntax. */
export function formatPlaintext(
  source: string,
  options: PlaintextFormatOptions,
  firstLineIndent = 2,
): string {
  let lines = source.replace(/\r\n?/g, "\n").split("\n");

  if (options.trimExtraSpaces) {
    lines = lines.map((line) => line.replace(/[ \t]+/g, " ").trim());
  }

  if (options.cjkSpacing) {
    lines = lines.map((line) =>
      line
        .replace(/([\u3400-\u9fff])([A-Za-z0-9])/g, "$1 $2")
        .replace(/([A-Za-z0-9])([\u3400-\u9fff])/g, "$1 $2"),
    );
  }

  if (options.separateParagraphs) {
    const paragraphs: string[][] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (line.trim() === "") {
        if (current.length > 0) {
          paragraphs.push(current);
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) paragraphs.push(current);
    lines = paragraphs.flatMap((paragraph, index) =>
      index === 0 ? paragraph : ["", ...paragraph],
    );
  } else if (options.collapseBlankLines) {
    const collapsed: string[] = [];
    for (const line of lines) {
      if (line.trim() === "" && collapsed.at(-1)?.trim() === "") continue;
      collapsed.push(line);
    }
    lines = collapsed;
  }

  if (options.indentParagraphs) {
    lines = lines.map((line) => {
      if (line.trim() === "") return line;
      const content = line.replace(/^　+/u, "");
      return `${"　".repeat(Math.max(0, Math.floor(firstLineIndent)))}${content}`;
    });
  }

  return lines.join("\n");
}
