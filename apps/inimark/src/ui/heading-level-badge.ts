/**
 * Shared H1–H6 (and paragraph) badges used by outline and editor menus.
 * Pass `0` for paragraph (`P`).
 */
export function headingLevelBadgeText(level: number): string {
  if (level >= 1 && level <= 6) return `H${level}`;
  return "P";
}

export function createHeadingLevelBadge(level: number): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "inimark-heading-level-badge";
  el.textContent = headingLevelBadgeText(level);
  el.setAttribute("aria-hidden", "true");
  return el;
}

export function headingLevelBadgeHtml(level: number): string {
  return `<span class="inimark-heading-level-badge" aria-hidden="true">${headingLevelBadgeText(level)}</span>`;
}
