/** Compact product icons for Vellum chrome (aligned with Inimark). */

export function libraryIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M4 4.5h3.25v15H5.25A1.25 1.25 0 0 1 4 18.25V4.5z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7.25 4.5H11v15H7.25"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.75 5.75 20 4v14.5l-8.25 1.75V5.75z"/></svg>`;
}

export function settingsIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/></svg>`;
}

export function sidebarToggleIcon(open: boolean): string {
  if (open) {
    return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="2.5" width="5" height="13" rx="1" fill="currentColor" opacity="0.25"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
  return `<svg class="inimark-icon inimark-icon--sidebar-toggle" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
}

export function newFileIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14 2v5a1 1 0 0 0 1 1h5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M14 19h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M17 16v6"/></svg>`;
}

export function saveIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-8H7v8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7 3v5h8"/></svg>`;
}

/** Settings nav: general prefs (sliders, not locale/globe). */
export function settingsGeneralIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 21v-7"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 10V3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 21v-9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 8V3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M20 21v-5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M20 12V3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M2 14h4"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M10 8h4"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 16h4"/></svg>`;
}

/** Settings nav: cloud sync — cloud only. */
export function settingsSyncIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17.5 19a4.5 4.5 0 0 0 .4-9 6 6 0 0 0-11.5-1.5A4 4 0 0 0 6.5 19Z"/></svg>`;
}

export function settingsEditorIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
}

export function settingsThemeIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 4-4 4h-1.5a1.5 1.5 0 0 0-1.4 2 2.5 2.5 0 0 1-2.4 3.3Z"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor"/><circle cx="12" cy="8" r="1.1" fill="currentColor"/><circle cx="16.5" cy="11.5" r="1.1" fill="currentColor"/></svg>`;
}

export function settingsAboutIcon(): string {
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 11v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 8h.01"/></svg>`;
}
