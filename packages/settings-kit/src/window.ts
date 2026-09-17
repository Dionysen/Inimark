export interface OpenAuxWindowOptions {
  /** Window / popup name. Default: `"settings"`. */
  label?: string;
  /** Browser popup path. Default: `"/settings.html"`. */
  url?: string;
  /** Optional hash fragment (without `#`), e.g. a section id. */
  hash?: string;
  width?: number;
  height?: number;
  /** When set with `section`, write the section id before opening. */
  navigateStorageKey?: string;
  section?: string;
  /** Detect Tauri runtime. Default: checks `__TAURI*` globals. */
  isTauri?: () => boolean;
  /** Tauri command when opening with an explicit section. Default: `show_settings_window`. */
  showCommand?: string;
  /** Tauri command when toggling without a section. Default: `toggle_settings_window`. */
  toggleCommand?: string;
}

let browserPopup: Window | null = null;

function defaultIsTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Open or toggle an auxiliary window (settings by default).
 * In Tauri, invokes configurable show/toggle commands; in browser, uses `window.open`.
 */
export async function openAuxWindow(
  options: OpenAuxWindowOptions = {},
): Promise<void> {
  const label = options.label ?? "settings";
  const baseUrl = options.url ?? "/settings.html";
  const width = options.width ?? 920;
  const height = options.height ?? 640;
  const isTauri = options.isTauri ?? defaultIsTauri;
  const showCommand = options.showCommand ?? "show_settings_window";
  const toggleCommand = options.toggleCommand ?? "toggle_settings_window";
  const hash = options.hash ?? options.section;

  if (options.section && options.navigateStorageKey) {
    localStorage.setItem(options.navigateStorageKey, options.section);
  }

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    if (options.section) {
      await invoke(showCommand);
    } else {
      await invoke(toggleCommand);
    }
    return;
  }

  if (browserPopup && !browserPopup.closed) {
    if (options.section) {
      browserPopup.focus();
      return;
    }
    browserPopup.close();
    browserPopup = null;
    return;
  }

  const url = hash ? `${baseUrl}#${hash}` : baseUrl;
  browserPopup = window.open(
    url,
    label,
    `width=${width},height=${height},resizable=yes`,
  );

  if (!browserPopup) {
    throw new Error("Popup blocked — allow popups for this site to open the window.");
  }
}

/** Queue a section id for the next settings window open (cross-window handoff). */
export function queueAuxWindowSection(
  storageKey: string,
  section: string,
): void {
  localStorage.setItem(storageKey, section);
}
