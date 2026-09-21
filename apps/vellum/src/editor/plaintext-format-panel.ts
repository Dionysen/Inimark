import { createToggle, onOutsideClick } from "@dionysen/ui";
import { t } from "../i18n/index.ts";
import type { PlaintextEditor } from "./plaintext.ts";
import {
  formatPlaintext,
  type PlaintextFormatOptions,
} from "./plaintext-format.ts";

const FORMAT_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M5 6h14M5 12h9M5 18h14"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m17 10 2 2-2 2"/></svg>`;

const FORMAT_DEFAULTS: PlaintextFormatOptions = {
  collapseBlankLines: true,
  indentParagraphs: false,
  separateParagraphs: true,
  trimExtraSpaces: true,
  cjkSpacing: true,
};

export interface PlaintextFormatPanelOptions {
  root: HTMLElement;
  anchor: HTMLElement;
  editor: PlaintextEditor;
  getFirstLineIndent(): number;
  onApplied(): void;
}

export interface PlaintextFormatPanelController {
  refreshLabels(): void;
  destroy(): void;
}

/** Mount the format button and its plain-text formatting panel. */
export function mountPlaintextFormatPanel(
  options: PlaintextFormatPanelOptions,
): PlaintextFormatPanelController {
  const { root, anchor, editor, getFirstLineIndent, onApplied } = options;
  const formatOptions = { ...FORMAT_DEFAULTS };
  const formatBtn = document.createElement("button");
  formatBtn.type = "button";
  formatBtn.className = "vellum-status-btn vellum-format-btn";
  formatBtn.innerHTML = FORMAT_ICON;
  formatBtn.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "vellum-status-panel vellum-format-panel";
  panel.hidden = true;

  const title = document.createElement("div");
  title.className = "vellum-status-panel-title";
  const description = document.createElement("p");
  description.className = "vellum-format-desc";

  const toggles: Array<ReturnType<typeof createToggle>> = [];
  const rows: Array<{
    key: keyof PlaintextFormatOptions;
    title: HTMLElement;
    description: HTMLElement;
    toggle: ReturnType<typeof createToggle>;
  }> = [];

  const addRow = (key: keyof PlaintextFormatOptions): void => {
    const row = document.createElement("div");
    row.className = "vellum-status-panel-row vellum-format-row";
    const meta = document.createElement("div");
    meta.className = "vellum-status-panel-meta";
    const rowTitle = document.createElement("div");
    rowTitle.className = "vellum-status-panel-row-title";
    const rowDescription = document.createElement("p");
    rowDescription.className = "vellum-status-panel-row-desc";
    meta.append(rowTitle, rowDescription);
    const control = document.createElement("div");
    control.className = "vellum-status-panel-control";
    const toggle = createToggle({
      checked: formatOptions[key],
      onChange: (checked) => {
        formatOptions[key] = checked;
      },
    });
    control.append(toggle.el);
    row.append(meta, control);
    panel.append(row);
    toggles.push(toggle);
    rows.push({ key, title: rowTitle, description: rowDescription, toggle });
  };

  panel.append(title, description);
  addRow("collapseBlankLines");
  addRow("indentParagraphs");
  addRow("separateParagraphs");
  addRow("trimExtraSpaces");
  addRow("cjkSpacing");

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "inimark-btn inimark-btn--primary vellum-format-apply";
  panel.append(applyButton);
  anchor.append(formatBtn, panel);

  let open = false;

  const close = (): void => {
    if (!open) return;
    open = false;
    panel.hidden = true;
    formatBtn.classList.remove("is-active");
    formatBtn.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
  };

  const openPanel = (): void => {
    if (open) return;
    open = true;
    panel.hidden = false;
    formatBtn.classList.add("is-active");
    formatBtn.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
  };

  formatBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (open) close();
    else openPanel();
  });

  applyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const current = editor.getValue();
    const next = formatPlaintext(current, formatOptions, getFirstLineIndent());
    if (next !== current) editor.setValue(next, true);
    editor.focusAtEnd();
    onApplied();
    close();
  });

  const disposeOutsideClick = onOutsideClick([anchor], close);

  function refreshLabels(): void {
    formatBtn.title = t("editor.formatText");
    formatBtn.setAttribute("aria-label", t("editor.formatText"));
    title.textContent = t("editor.formatText");
    description.textContent = t("editor.formatTextDesc");
    applyButton.textContent = t("editor.applyFormat");
    const labels = {
      collapseBlankLines: [t("editor.formatCollapseBlankLines"), t("editor.formatCollapseBlankLinesDesc")],
      indentParagraphs: [t("editor.formatIndentParagraphs"), t("editor.formatIndentParagraphsDesc")],
      separateParagraphs: [t("editor.formatSeparateParagraphs"), t("editor.formatSeparateParagraphsDesc")],
      trimExtraSpaces: [t("editor.formatTrimExtraSpaces"), t("editor.formatTrimExtraSpacesDesc")],
      cjkSpacing: [t("editor.formatCjkSpacing"), t("editor.formatCjkSpacingDesc")],
    } satisfies Record<keyof PlaintextFormatOptions, readonly [string, string]>;
    for (const row of rows) {
      const [rowTitle, rowDescription] = labels[row.key];
      row.title.textContent = rowTitle;
      row.description.textContent = rowDescription;
      row.toggle.el.title = rowTitle;
    }
  }

  refreshLabels();

  return {
    refreshLabels,
    destroy() {
      disposeOutsideClick();
      for (const toggle of toggles) toggle.destroy();
      formatBtn.remove();
      panel.remove();
    },
  };
}
