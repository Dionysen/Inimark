/**
 * Bottom-right status bar: a typewriter-mode toggle and a live character count.
 *
 * Auto-hide is CSS-driven via `html[data-auto-hide-statusbar="true"]` (set by
 * `applySettings`) together with the shared `vellum-status-corner` class, so the
 * bottom-left sync button honours the same setting.
 */

import { onLocaleChange, t } from "../i18n/index.ts";
import type { AppSettings } from "../settings/store.ts";
import type { PlaintextEditor } from "./plaintext.ts";

export interface StatusBarController {
  scheduleUpdate(): void;
  syncChrome(): void;
  destroy(): void;
}

export interface StatusBarOptions {
  /** Positioning host (the app shell). */
  host: HTMLElement;
  editor: PlaintextEditor;
  getSettings(): AppSettings;
  onTypewriterModeChange(enabled: boolean): void;
}

const UPDATE_DEBOUNCE_MS = 120;

const TYPEWRITER_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 8h12"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 8v8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M6 16h12"/></svg>`;

/** Count visible characters — whitespace (incl. ideographic indent spaces) is excluded. */
function countCharacters(editor: PlaintextEditor): number {
  return editor.getValue().replace(/\s/g, "").length;
}

export function mountStatusBar(options: StatusBarOptions): StatusBarController {
  const { host, editor, getSettings, onTypewriterModeChange } = options;

  const root = document.createElement("div");
  root.className = "vellum-status-bar vellum-status-bar--right vellum-status-corner";

  const typewriterBtn = document.createElement("button");
  typewriterBtn.type = "button";
  typewriterBtn.className = "vellum-status-btn";
  typewriterBtn.innerHTML = TYPEWRITER_ICON;

  const count = document.createElement("span");
  count.className = "vellum-status-count";

  root.append(typewriterBtn, count);
  host.append(root);

  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  function renderCount(): void {
    const value = countCharacters(editor).toLocaleString();
    count.textContent = t("wordCount.label", { count: value });
  }

  function scheduleUpdate(): void {
    if (updateTimer != null) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      renderCount();
    }, UPDATE_DEBOUNCE_MS);
  }

  function syncTypewriterButton(): void {
    const on = editor.isTypewriterMode();
    typewriterBtn.classList.toggle("is-active", on);
    typewriterBtn.setAttribute("aria-pressed", String(on));
  }

  function refreshLabels(): void {
    const label = t("editor.typewriter");
    typewriterBtn.title = label;
    typewriterBtn.setAttribute("aria-label", label);
    renderCount();
  }

  function syncChrome(): void {
    syncTypewriterButton();
    // Keep the toggle in step when the setting changes from the settings window.
    const desired = getSettings().typewriterMode;
    if (editor.isTypewriterMode() !== desired) editor.setTypewriterMode(desired);
    syncTypewriterButton();
  }

  typewriterBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = !editor.isTypewriterMode();
    editor.setTypewriterMode(next);
    onTypewriterModeChange(next);
    syncTypewriterButton();
  });

  const unsubscribeLocale = onLocaleChange(() => refreshLabels());

  refreshLabels();
  syncChrome();

  return {
    scheduleUpdate,
    syncChrome,
    destroy() {
      if (updateTimer != null) clearTimeout(updateTimer);
      unsubscribeLocale();
      root.remove();
    },
  };
}
