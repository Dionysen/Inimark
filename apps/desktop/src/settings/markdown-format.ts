import type { MarkdownFormatSettings } from "./store.ts";

/** Apply save-time Markdown hygiene options. Kept intentionally simple. */
export function formatMarkdown(source: string, options: MarkdownFormatSettings): string {
  let text = source.replace(/\r\n/g, "\n");

  if (options.trimTrailingWhitespace) {
    text = text
      .split("\n")
      .map((line) => {
        const hardBreak = line.match(/^(.*\S)( {2})$/);
        if (hardBreak) return `${hardBreak[1]}  `;
        return line.replace(/\s+$/, "");
      })
      .join("\n");
  }

  if (options.normalizeBlankLines) {
    text = text.replace(/\n{3,}/g, "\n\n");
  }

  if (options.cjkSpacing) {
    text = text
      .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, "$1 $2")
      .replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, "$1 $2");
  }

  if (options.ensureFinalNewline) {
    text = text.replace(/\s*$/, "\n");
  }

  return text;
}
