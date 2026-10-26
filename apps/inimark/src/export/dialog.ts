import "../styles/confirm-dialog.css";
import "../styles/export-dialog.css";
import { t } from "../i18n/index.ts";
import { showStatusToast } from "../ui/status-toast.ts";
import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../ui/exclusive-layer.ts";
import { createSelect } from "../ui/widgets/select.ts";
import { closeIcon, createIconButton } from "../ui/widgets/icon-button.ts";
import {
  buildExportDocument,
  listExportThemes,
  resolveDefaultExportSelection,
  type ExportAppearance,
  type ExportFormat,
} from "./build-document.ts";
import { saveExport } from "./write.ts";

export interface ExportDialogOptions {
  markdown: string;
  title: string;
  /** Suggested download / save base name. */
  baseName: string;
  rewriteSrc?: (src: string) => string | null | Promise<string | null>;
  onOpenChange?: (open: boolean) => void;
}

export interface ExportDialogHandle {
  close(): void;
  isOpen(): boolean;
}

let activeDialog: ExportDialogHandle | null = null;

export function isExportDialogOpen(): boolean {
  return activeDialog?.isOpen() ?? false;
}

export function closeExportDialog(): void {
  activeDialog?.close();
}

export async function showExportDialog(
  options: ExportDialogOptions,
): Promise<void> {
  if (activeDialog) {
    activeDialog.close();
  }

  const defaults = resolveDefaultExportSelection();
  let format: ExportFormat = "html";
  let themeId = defaults.themeId;
  let appearance: ExportAppearance = defaults.appearance;
  let currentHtml = "";
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let exporting = false;
  let closed = false;

  const themes = await listExportThemes();
  if (!themes.some((th) => th.id === themeId) && themes[0]) {
    themeId = themes[0].id;
  }

  const overlay = document.createElement("div");
  overlay.className = "inimark-confirm-dialog inimark-export-dialog";

  const panel = document.createElement("div");
  panel.className = "inimark-confirm-dialog-panel inimark-export-dialog-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "inimark-export-title");

  const header = document.createElement("header");
  header.className = "inimark-export-dialog-header";

  const titleEl = document.createElement("h2");
  titleEl.className = "inimark-confirm-dialog-title";
  titleEl.id = "inimark-export-title";
  titleEl.textContent = t("export.title");

  const closeBtn = createIconButton({
    label: t("common.close"),
    title: t("common.close"),
    html: closeIcon(),
    onClick() {
      close();
    },
  });
  closeBtn.classList.add("inimark-export-dialog-close");

  header.append(titleEl, closeBtn);

  const body = document.createElement("div");
  body.className = "inimark-export-dialog-body";

  const sidebar = document.createElement("aside");
  sidebar.className = "inimark-export-dialog-sidebar";

  const formatField = document.createElement("fieldset");
  formatField.className = "inimark-export-dialog-fieldset";
  const formatLegend = document.createElement("div");
  formatLegend.className = "inimark-export-dialog-label";
  formatLegend.textContent = t("export.format");
  formatField.append(formatLegend);

  const formatOptions: Array<{ value: ExportFormat; label: string }> = [
    { value: "html", label: t("export.formatHtml") },
    { value: "png", label: t("export.formatPng") },
    { value: "pdf", label: t("export.formatPdf") },
  ];
  for (const opt of formatOptions) {
    const label = document.createElement("label");
    label.className = "inimark-export-dialog-radio";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "export-format";
    input.value = opt.value;
    input.checked = opt.value === format;
    input.addEventListener("change", () => {
      if (input.checked) format = opt.value;
    });
    const span = document.createElement("span");
    span.textContent = opt.label;
    label.append(input, span);
    formatField.append(label);
  }

  const themeField = document.createElement("div");
  themeField.className = "inimark-export-dialog-field";
  const themeLabel = document.createElement("div");
  themeLabel.className = "inimark-export-dialog-label";
  themeLabel.textContent = t("export.theme");
  const themeHost = document.createElement("div");
  themeHost.className = "inimark-export-dialog-select-host";
  function syncDialogTheme(): void {
    panel.dataset.theme = themeId;
    panel.dataset.appearance = appearance;
  }

  const themeSelect = createSelect({
    value: themeId,
    options: themes.map((th) => ({ value: th.id, label: th.label })),
    matchTriggerWidth: true,
    searchable: themes.length > 8,
    onChange(value) {
      themeId = value;
      syncDialogTheme();
      schedulePreview();
    },
  });
  themeSelect.el.classList.add("inimark-export-dialog-select");
  themeHost.append(themeSelect.el);
  themeField.append(themeLabel, themeHost);

  const appearanceField = document.createElement("div");
  appearanceField.className = "inimark-export-dialog-field";
  const appearanceLabel = document.createElement("div");
  appearanceLabel.className = "inimark-export-dialog-label";
  appearanceLabel.textContent = t("export.appearance");
  const appearanceHost = document.createElement("div");
  appearanceHost.className = "inimark-export-dialog-select-host";
  const appearanceSelect = createSelect({
    value: appearance,
    options: [
      { value: "light", label: t("export.appearanceLight") },
      { value: "dark", label: t("export.appearanceDark") },
    ],
    matchTriggerWidth: true,
    onChange(value) {
      appearance = value as ExportAppearance;
      syncDialogTheme();
      schedulePreview();
    },
  });
  appearanceSelect.el.classList.add("inimark-export-dialog-select");
  appearanceHost.append(appearanceSelect.el);
  appearanceField.append(appearanceLabel, appearanceHost);

  syncDialogTheme();

  sidebar.append(formatField, themeField, appearanceField);

  const previewPane = document.createElement("section");
  previewPane.className = "inimark-export-dialog-preview-pane";
  const previewLabel = document.createElement("div");
  previewLabel.className = "inimark-export-dialog-label";
  previewLabel.textContent = t("export.preview");
  const iframe = document.createElement("iframe");
  iframe.className = "inimark-export-dialog-preview";
  iframe.title = t("export.preview");
  iframe.sandbox.add("allow-same-origin");
  previewPane.append(previewLabel, iframe);

  body.append(sidebar, previewPane);

  const footer = document.createElement("footer");
  footer.className = "inimark-export-dialog-footer";

  const statusEl = document.createElement("span");
  statusEl.className = "inimark-export-dialog-status";
  statusEl.setAttribute("aria-live", "polite");

  const actions = document.createElement("div");
  actions.className = "inimark-confirm-dialog-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className =
    "inimark-control inimark-btn inimark-confirm-dialog-btn";
  cancelBtn.textContent = t("common.cancel");
  cancelBtn.addEventListener("click", () => close());

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className =
    "inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn";
  exportBtn.textContent = t("export.export");
  exportBtn.addEventListener("click", () => {
    void runExport();
  });

  actions.append(cancelBtn, exportBtn);
  footer.append(statusEl, actions);

  panel.append(header, body, footer);
  overlay.append(panel);

  function syncExportButton(): void {
    exportBtn.textContent = exporting ? t("export.exporting") : t("export.export");
    exportBtn.disabled = exporting;
    cancelBtn.disabled = exporting;
  }

  async function refreshPreview(): Promise<void> {
    if (closed) return;
    try {
      const doc = await buildExportDocument({
        markdown: options.markdown,
        title: options.title,
        themeId,
        appearance,
        rewriteSrc: options.rewriteSrc,
        inlineLocalImages: false,
      });
      currentHtml = doc.html;
      iframe.srcdoc = doc.html;
      statusEl.textContent = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statusEl.textContent = message;
    }
  }

  function schedulePreview(): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      void refreshPreview();
    }, 80);
  }

  function setStatus(message: string): void {
    statusEl.textContent = message;
  }

  function close(): void {
    if (closed) return;
    closed = true;
    if (previewTimer) clearTimeout(previewTimer);
    window.removeEventListener("keydown", onKeyDown, true);
    releaseExclusiveLayer(overlay);
    themeSelect.destroy();
    appearanceSelect.destroy();
    overlay.remove();
    if (activeDialog === handle) activeDialog = null;
    options.onOpenChange?.(false);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  async function runExport(): Promise<void> {
    if (exporting || closed) return;
    exporting = true;
    syncExportButton();
    setStatus("");

    try {
      let html = currentHtml;
      if (format === "html") {
        const doc = await buildExportDocument({
          markdown: options.markdown,
          title: options.title,
          themeId,
          appearance,
          rewriteSrc: options.rewriteSrc,
          inlineLocalImages: true,
        });
        html = doc.html;
        currentHtml = html;
        iframe.srcdoc = html;
        await new Promise<void>((resolve) => {
          iframe.addEventListener("load", () => resolve(), { once: true });
        });
      }

      const result = await saveExport({
        format,
        baseName: options.baseName,
        html,
        previewFrame: iframe,
      });

      if (result.status === "saved") {
        showStatusToast(document.body, t("export.success"));
        close();
        return;
      }
      if (result.status === "cancelled") {
        setStatus(t("export.cancelled"));
      } else {
        const msg = result.message || t("export.failed");
        setStatus(msg);
        showStatusToast(document.body, msg);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const msg = message || t("export.failed");
      setStatus(msg);
      showStatusToast(document.body, msg);
    } finally {
      exporting = false;
      syncExportButton();
    }
  }

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  panel.addEventListener("mousedown", (event) => event.stopPropagation());

  const handle: ExportDialogHandle = {
    close,
    isOpen: () => !closed,
  };
  activeDialog = handle;
  options.onOpenChange?.(true);

  document.body.append(overlay);
  // Suppress overlay scrollbars while the modal is open (rails sit in a fixed
  // layer that otherwise reappears on gutter hover and can paint through).
  acquireExclusiveLayer(overlay, close, {
    contains(node) {
      if (!node) return false;
      if (overlay.contains(node)) return true;
      // createSelect panels mount on document.body.
      return (
        node instanceof Element &&
        Boolean(node.closest(".inimark-select-panel"))
      );
    },
  });
  window.addEventListener("keydown", onKeyDown, true);
  exportBtn.focus();
  await refreshPreview();
}
