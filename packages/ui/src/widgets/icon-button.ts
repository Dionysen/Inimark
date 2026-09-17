import { bindTooltip } from "./tooltip.ts";

export interface IconButtonOptions {
  label: string;
  title?: string;
  html?: string;
  onClick?: (event: MouseEvent) => void;
}

export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "inimark-control inimark-icon-btn";
  button.setAttribute("aria-label", options.label);
  if (options.title) bindTooltip(button, options.title);
  if (options.html) button.innerHTML = options.html;
  else button.innerHTML = options.label;
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}

/** Close overlay / dismiss. */
export function closeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 6 6 18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m6 6 12 12"/></svg>`;
}

/** Horizontal three-dot overflow / more menu. */
export function moreIcon(): string {
  return `<svg class="inimark-icon inimark-icon--more" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="4" cy="9" r="1.35" fill="currentColor"/><circle cx="9" cy="9" r="1.35" fill="currentColor"/><circle cx="14" cy="9" r="1.35" fill="currentColor"/></svg>`;
}

/** Document — explorer tree file row. */
export function treeFileIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2v6h6"/></svg>`;
}

/** Closed folder — explorer tree directory row. */
export function treeFolderIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
}

/** Open folder — expanded explorer tree directory row. */
export function treeFolderOpenIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z"/><path d="M3 10h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z"/></svg>`;
}
