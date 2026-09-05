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
  /* Three books — document library */
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M4 4.5h3.25v15H5.25A1.25 1.25 0 0 1 4 18.25V4.5z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7.25 4.5H11v15H7.25"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.75 5.75 20 4v14.5l-8.25 1.75V5.75z"/></svg>`;
}

export function settingsIcon(): string {
  /* Gear with hub */
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/></svg>`;
}

/** Sidebar panel toggle — open=true shows filled left pane. */
export function sidebarToggleIcon(open: boolean): string {
  if (open) {
    return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="2.5" width="5" height="13" rx="1" fill="currentColor" opacity="0.25"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
  return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

export function filesTabIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

export function searchTabIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg>`;
}

export function bookmarksTabIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
}

/** List / outline panel tab. */
export function outlineTabIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 6h13"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 12h13"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 18h13"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 6h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 12h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 18h.01"/></svg>`;
}

/** Right sidebar toggle — open=true shows filled right pane. */
export function rightSidebarToggleIcon(open: boolean): string {
  if (open) {
    return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="10.5" y="2.5" width="5" height="13" rx="1" fill="currentColor" opacity="0.25"/><line x1="10.5" y1="2.5" x2="10.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
  return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="10.5" y1="2.5" x2="10.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

/** File with corner fold + plus — from Tydora sidebar toolbar. */
export function newFileIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2v5a1 1 0 0 0 1 1h5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M14 19h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M17 16v6"/></svg>`;
}

/** Folder with plus — from Tydora sidebar toolbar. */
export function newFolderIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 10v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M9 13h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
}

/** Sort ascending arrow + bars — from Tydora sidebar toolbar. */
export function sortIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m3 8 4-4 4 4"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M7 4v16"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M11 12h4"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M11 16h7"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M11 20h10"/></svg>`;
}

/** Frame corners + focus line — from Tydora sidebar toolbar. */
export function locateFileIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 0 1 2-2h2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17 3h2a2 2 0 0 1 2 2v2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M21 17v2a2 2 0 0 1-2 2h-2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7 21H5a2 2 0 0 1-2-2v-2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M7 12h10"/></svg>`;
}

/** Chevrons collapse — from Tydora sidebar toolbar. */
export function collapseAllIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m7 20 5-5 5 5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m7 4 5 5 5-5"/></svg>`;
}
