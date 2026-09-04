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
  if (options.title) button.title = options.title;
  if (options.html) button.innerHTML = options.html;
  else button.innerHTML = options.label;
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}

export function libraryIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.5 3A1.5 1.5 0 0 1 4 1.5h2.2l.8.8H12A1.5 1.5 0 0 1 13.5 3.8v9.7A1.5 1.5 0 0 1 12 15H4a1.5 1.5 0 0 1-1.5-1.5V3zm1 0v10.5h8.5V3.8H6.6L5.8 3H3.5z"/></svg>`;
}

export function settingsIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 4.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5zm0-2.6a.75.75 0 0 1 .7.48l.2.55 1.02.15a.75.75 0 0 1 .42 1.28l-.74.72.17 1.02a.75.75 0 0 1-1.09.79L8 10.9l-.92.48a.75.75 0 0 1-1.09-.79l.17-1.02-.74-.72a.75.75 0 0 1 .42-1.28l1.02-.15.2-.55A.75.75 0 0 1 8 2.15z"/></svg>`;
}

/** Sidebar panel toggle — open=true shows filled left pane. */
export function sidebarToggleIcon(open: boolean): string {
  if (open) {
    return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="2.5" width="5" height="13" rx="1" fill="currentColor" opacity="0.25"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
  return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}
