/**
 * Bottom-right status bar: a typewriter-mode toggle and a live character count.
 *
 * Clicking the count opens a small panel to switch between "pure text" and
 * "with punctuation" counting. First-line indentation (ideographic spaces) is
 * whitespace, so it is excluded in both modes.
 *
 * Auto-hide is CSS-driven via `html[data-auto-hide-statusbar="true"]` (set by
 * `applySettings`) together with the shared `vellum-status-corner` class, so the
 * bottom-left sync button honours the same setting.
 */

import { createToggle, onOutsideClick, typewriterIcon } from "@dionysen/ui";
import { onLocaleChange, t } from "../i18n/index.ts";
import type { AppSettings, WordCountSettings } from "../settings/store.ts";
import type { PlaintextEditor } from "./plaintext.ts";
import { mountPlaintextFormatPanel } from "./plaintext-format-panel.ts";

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
  onWordCountChange(partial: Partial<WordCountSettings>): void;
}

const UPDATE_DEBOUNCE_MS = 120;

/**
 * Count characters. `includeSymbols` counts everything non-whitespace; otherwise
 * only letters and numbers (Unicode `\p{L}` / `\p{N}`, which covers CJK).
 * Whitespace — including the U+3000 first-line indent — is always excluded.
 */
export function countText(text: string, includeSymbols: boolean): number {
  if (includeSymbols) return text.replace(/\s/g, "").length;
  const matches = text.match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

export function mountStatusBar(options: StatusBarOptions): StatusBarController {
  const { host, editor, getSettings, onTypewriterModeChange, onWordCountChange } =
    options;

  const root = document.createElement("div");
  root.className = "vellum-status-bar vellum-status-bar--right vellum-status-corner";

  const typewriterBtn = document.createElement("button");
  typewriterBtn.type = "button";
  typewriterBtn.className = "vellum-status-btn vellum-typewriter-btn";
  typewriterBtn.innerHTML = typewriterIcon;

  const formatAnchor = document.createElement("div");
  formatAnchor.className = "vellum-status-format";

  const footer = document.createElement("div");
  footer.className = "vellum-status-footer";

  const countBtn = document.createElement("button");
  countBtn.type = "button";
  countBtn.className = "vellum-status-count";

  const panel = document.createElement("div");
  panel.className = "vellum-status-panel vellum-word-count-panel";
  panel.hidden = true;

  const panelTitle = document.createElement("div");
  panelTitle.className = "vellum-status-panel-title";

  const row = document.createElement("div");
  row.className = "vellum-status-panel-row";

  const rowMeta = document.createElement("div");
  rowMeta.className = "vellum-status-panel-meta";
  const rowTitle = document.createElement("div");
  rowTitle.className = "vellum-status-panel-row-title";
  const rowDesc = document.createElement("p");
  rowDesc.className = "vellum-status-panel-row-desc";
  rowMeta.append(rowTitle, rowDesc);

  const rowControl = document.createElement("div");
  rowControl.className = "vellum-status-panel-control";
  const includeSymbolsToggle = createToggle({
    checked: getSettings().wordCount.includeSymbols,
    onChange(checked) {
      onWordCountChange({ includeSymbols: checked });
      renderCount();
    },
  });
  rowControl.append(includeSymbolsToggle.el);

  row.append(rowMeta, rowControl);
  panel.append(panelTitle, row);

  footer.append(countBtn, panel);
  root.append(formatAnchor, typewriterBtn, footer);
  host.append(root);

  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  let open = false;
  const formatPanel = mountPlaintextFormatPanel({
    root,
    anchor: formatAnchor,
    editor,
    getFirstLineIndent: () => getSettings().firstLineIndent,
    onApplied: scheduleUpdate,
    onOpen: closePanel,
  });

  function renderCount(): void {
    const value = countText(
      editor.getValue(),
      getSettings().wordCount.includeSymbols,
    ).toLocaleString();
    countBtn.textContent = t("wordCount.label", { count: value });
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

  function openPanel(): void {
    if (open) return;
    formatPanel.close();
    open = true;
    panel.hidden = false;
    countBtn.classList.add("is-active");
    root.classList.add("is-open");
    countBtn.setAttribute("aria-expanded", "true");
  }

  function closePanel(): void {
    if (!open) return;
    open = false;
    panel.hidden = true;
    countBtn.classList.remove("is-active");
    root.classList.remove("is-open");
    countBtn.setAttribute("aria-expanded", "false");
  }

  function refreshLabels(): void {
    const typewriterLabel = t("editor.typewriter");
    typewriterBtn.title = typewriterLabel;
    typewriterBtn.setAttribute("aria-label", typewriterLabel);

    countBtn.title = t("wordCount.panelTitle");
    countBtn.setAttribute("aria-label", t("wordCount.panelTitle"));
    panelTitle.textContent = t("wordCount.panelTitle");
    rowTitle.textContent = t("wordCount.includeSymbols");
    rowDesc.textContent = t("wordCount.includeSymbolsDesc");
    includeSymbolsToggle.el.title = t("wordCount.includeSymbols");
    renderCount();
  }

  function syncChrome(): void {
    syncTypewriterButton();
    // Keep the typewriter toggle in step with the stored setting.
    const desired = getSettings().typewriterMode;
    if (editor.isTypewriterMode() !== desired) editor.setTypewriterMode(desired);
    syncTypewriterButton();
    // Reflect any external change to the counting mode.
    includeSymbolsToggle.setChecked(getSettings().wordCount.includeSymbols);
    renderCount();
  }

  typewriterBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = !editor.isTypewriterMode();
    editor.setTypewriterMode(next);
    onTypewriterModeChange(next);
    syncTypewriterButton();
  });

  countBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (open) closePanel();
    else openPanel();
  });

  const disposeOutsideClick = onOutsideClick([root], () => closePanel());

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) closePanel();
  };
  document.addEventListener("keydown", onKeyDown);

  const unsubscribeLocale = onLocaleChange(() => refreshLabels());
  const unsubscribeFormatLocale = onLocaleChange(() => formatPanel.refreshLabels());

  refreshLabels();
  syncChrome();

  return {
    scheduleUpdate,
    syncChrome,
    destroy() {
      if (updateTimer != null) clearTimeout(updateTimer);
      disposeOutsideClick();
      document.removeEventListener("keydown", onKeyDown);
      unsubscribeLocale();
      unsubscribeFormatLocale();
      includeSymbolsToggle.destroy();
      formatPanel.destroy();
      root.remove();
    },
  };
}
