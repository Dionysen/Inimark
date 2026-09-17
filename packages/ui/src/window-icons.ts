/** Shared SVG icons for custom window caption buttons (Inimark-compatible 10×10 set). */

const ICON_CLASS = "inimark-titlebar-icon";

export function windowMinimizeIcon(): string {
  return `<svg class="${ICON_CLASS}" viewBox="0 0 10 10" aria-hidden="true"><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

export function windowMaximizeIcon(): string {
  return `<svg class="${ICON_CLASS}" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

export function windowRestoreIcon(): string {
  return `<svg class="${ICON_CLASS}" viewBox="0 0 10 10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.1" d="M3.5 1.5H8.5V6.5H6.5V8.5H1.5V3.5H3.5V1.5z"/><path fill="none" stroke="currentColor" stroke-width="1.1" d="M3.5 3.5H8.5V8.5H3.5z"/></svg>`;
}

export function windowCloseIcon(): string {
  return `<svg class="${ICON_CLASS}" viewBox="0 0 10 10" aria-hidden="true"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.2"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}
