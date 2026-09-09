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

/** Relationship graph tab. */
export function graphTabIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.25" stroke="currentColor" stroke-width="1.75"/><circle cx="18" cy="7" r="2.25" stroke="currentColor" stroke-width="1.75"/><circle cx="8" cy="18" r="2.25" stroke="currentColor" stroke-width="1.75"/><circle cx="17" cy="17" r="2.25" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 7.5 16 8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M7.5 8.2 9.2 15.8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M16.2 9.1 15.5 14.8"/></svg>`;
}

/** Graph scope: local (ego) neighborhood. */
export function graphLocalModeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/><circle cx="5" cy="8" r="1.75" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="8" r="1.75" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="18" r="1.75" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="18" r="1.75" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M9.4 10.2 6.6 8.7"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M14.6 10.2 17.4 8.7"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M10 14.5 8 16.7"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M14 14.5 16 16.7"/></svg>`;
}

/** Graph scope: whole vault. */
export function graphVaultModeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="6" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="17" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="17" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8.7 8.2 10.5 10.5"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M15.3 7.8 13.5 10.4"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8.5 15.4 10.4 13.3"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M15.5 15.4 13.6 13.3"/></svg>`;
}

/** Open graph in the main editor area. */
export function graphOpenEditorIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 9h18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m10 14 2-2 2 2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 12v5"/></svg>`;
}

/** Close overlay / dismiss. */
export function closeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 6 6 18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m6 6 12 12"/></svg>`;
}

/** Horizontal three-dot overflow / more menu. */
export function moreIcon(): string {
  return `<svg class="inimark-icon inimark-icon--more" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="4" cy="9" r="1.35" fill="currentColor"/><circle cx="9" cy="9" r="1.35" fill="currentColor"/><circle cx="14" cy="9" r="1.35" fill="currentColor"/></svg>`;
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

/** Chevrons expand — inverse of collapseAllIcon. */
export function expandAllIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m7 15 5 5 5-5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/></svg>`;
}

/** Nested lines — expand outline to a heading level. */
export function expandToLevelIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 6h16"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 12h12"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 18h8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m4 15 3 3 3-3"/></svg>`;
}

/** Settings nav — editor / typography. */
export function settingsEditorIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
}

/** Settings nav — appearance / interface. */
export function settingsAppearanceIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 9h18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M9 9v11"/></svg>`;
}

/** Settings nav — theme / colors. */
export function settingsThemeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 4-4 4h-1.5a1.5 1.5 0 0 0-1.4 2 2.5 2.5 0 0 1-2.4 3.3Z"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor"/><circle cx="12" cy="8" r="1.1" fill="currentColor"/><circle cx="16.5" cy="11.5" r="1.1" fill="currentColor"/></svg>`;
}

/** Settings nav — keyboard shortcuts. */
export function settingsShortcutsIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 10h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M10 10h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M14 10h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 10h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M8 14h8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 14h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 14h.01"/></svg>`;
}

/** Settings nav — images. */
export function settingsImageIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75"/><circle cx="9" cy="10" r="1.75" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m21 16-4.5-4.5L7 21"/></svg>`;
}

/** Settings nav — relationship graph. */
export function settingsGraphIcon(): string {
  return graphTabIcon();
}

/** Lucide wand-2 — Obsidian-style graph timelapse. */
export function graphTimelapseIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 4V2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 16v-2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M8 9h2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M20 9h2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17.8 11.8 19 13"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 9h.01"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17.8 6.2 19 5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m3 21 9-9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12.2 6.2 11 5"/></svg>`;
}

/** Fit all graph nodes into the viewport. */
export function graphFitViewIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 0 1 2-2h2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17 3h2a2 2 0 0 1 2 2v2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M21 17v2a2 2 0 0 1-2 2h-2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/></svg>`;
}

/** Outgoing wiki-link (current note → other). */
export function graphOutlinkIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7 17 17 7"/></svg>`;
}

/** Incoming wiki-link (other → current note). */
export function graphBacklinkIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17 17H7V7"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m17 7-10 10"/></svg>`;
}

/** Settings nav — about. */
export function settingsAboutIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 11v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 8h.01"/></svg>`;
}
