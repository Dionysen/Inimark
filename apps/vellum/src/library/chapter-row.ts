/** Local calendar date for Pure Writer timestamps (epoch ms). */
export function formatArticleTime(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** One-line preview: collapse whitespace and keep a single visual line. */
export function chapterPreviewText(summary: string | null | undefined): string {
  if (!summary) return "";
  return summary.replace(/\s+/g, " ").trim();
}

/**
 * Foot line: create — update — word count.
 * `wordCountLabel` is the already-localized count string (e.g. "120字").
 */
export function formatChapterFootline(
  createTime: number,
  updateTime: number,
  wordCountLabel: string,
): string {
  return `${formatArticleTime(createTime)} - ${formatArticleTime(updateTime)} - ${wordCountLabel}`;
}

export interface ChapterRowContent {
  title: string;
  summary: string | null;
  createTime: number;
  updateTime: number;
  /** Localized word-count fragment, e.g. from `t("library.wordCount", { count })`. */
  wordCountLabel: string;
}

/** Replace a tree label span with the three-line chapter block. */
export function fillChapterTreeLabel(
  label: HTMLElement,
  content: ChapterRowContent,
): void {
  label.classList.add("vellum-chapter-body");
  label.replaceChildren();

  const title = document.createElement("span");
  title.className = "vellum-chapter-title";
  title.textContent = content.title;

  const preview = document.createElement("span");
  preview.className = "vellum-chapter-preview";
  preview.textContent = chapterPreviewText(content.summary);

  const meta = document.createElement("span");
  meta.className = "vellum-chapter-meta";
  meta.textContent = formatChapterFootline(
    content.createTime,
    content.updateTime,
    content.wordCountLabel,
  );

  label.append(title, preview, meta);
}
