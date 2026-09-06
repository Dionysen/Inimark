import "../styles/folder-picker-dialog.css";
import { t } from "../i18n/index.ts";
import type { WorkspaceTreeNode } from "../platform/types.ts";

export interface FolderPickerResult {
  confirmed: boolean;
  /** Relative folder path; empty string = vault root. */
  path: string;
}

export interface FolderPickerOptions {
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  sourcePath: string;
  sourceLabel?: string;
  rootLabel: string;
  folders: WorkspaceTreeNode[];
  /** Paths that must not be selectable (and their descendants are omitted). */
  excludePaths?: string[];
  initialPath?: string;
}

let activeDialog: HTMLElement | null = null;

type FolderRow = { path: string; label: string; depth: number };

function isExcluded(path: string, exclude: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  return exclude.some((ex) => {
    const e = ex.replace(/\\/g, "/");
    return normalized === e || normalized.startsWith(`${e}/`);
  });
}

function collectFolderRows(
  nodes: WorkspaceTreeNode[],
  exclude: string[],
  depth = 0,
  out: FolderRow[] = [],
): FolderRow[] {
  for (const node of nodes) {
    if (node.kind !== "directory") continue;
    if (isExcluded(node.path, exclude)) continue;
    out.push({ path: node.path, label: node.name, depth });
    if (node.children?.length) {
      collectFolderRows(node.children, exclude, depth + 1, out);
    }
  }
  return out;
}

export function promptPickFolder(
  options: FolderPickerOptions,
): Promise<FolderPickerResult> {
  if (activeDialog) {
    return Promise.resolve({ confirmed: false, path: "" });
  }

  const confirmLabel = options.confirmLabel ?? t("common.confirm");
  const cancelLabel = options.cancelLabel ?? t("common.cancel");
  const exclude = options.excludePaths ?? [];
  const rows = collectFolderRows(options.folders, exclude);

  return new Promise((resolve) => {
    let selected =
      options.initialPath != null &&
      !isExcluded(options.initialPath, exclude) &&
      (options.initialPath === "" ||
        rows.some((row) => row.path === options.initialPath))
        ? options.initialPath
        : "";

    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog inimark-folder-picker-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel inimark-folder-picker-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-folder-picker-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-folder-picker-title"></h2>
        <p class="inimark-confirm-dialog-message inimark-folder-picker-source"></p>
        <div class="inimark-folder-picker-list" role="listbox"></div>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="confirm"></button>
        </div>
      </div>
    `;

    overlay.querySelector("#inimark-folder-picker-title")!.textContent = options.title;
    const sourceEl = overlay.querySelector(".inimark-folder-picker-source") as HTMLElement;
    sourceEl.textContent = options.sourceLabel ?? options.sourcePath;
    sourceEl.title = options.sourcePath;

    const list = overlay.querySelector(".inimark-folder-picker-list") as HTMLElement;
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="confirm"]')!;
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;

    const panel = overlay.querySelector(".inimark-folder-picker-panel")!;

    function finish(confirmed: boolean): void {
      cleanup();
      resolve({ confirmed, path: confirmed ? selected : "" });
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      if (activeDialog === overlay) activeDialog = null;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      }
    }

    function renderList(): void {
      list.replaceChildren();
      const all: FolderRow[] = [
        { path: "", label: options.rootLabel, depth: 0 },
        ...rows.map((row) => ({
          ...row,
          depth: row.depth + 1,
        })),
      ];

      for (const row of all) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "inimark-folder-picker-item";
        btn.setAttribute("role", "option");
        btn.style.setProperty("--folder-depth", String(row.depth));
        if (row.path === selected) {
          btn.classList.add("is-selected");
          btn.setAttribute("aria-selected", "true");
        } else {
          btn.setAttribute("aria-selected", "false");
        }

        const icon = document.createElement("span");
        icon.className = "inimark-folder-picker-item-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML =
          `<svg viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;

        const label = document.createElement("span");
        label.className = "inimark-folder-picker-item-label";
        label.textContent = row.label;

        btn.append(icon, label);
        btn.addEventListener("click", () => {
          selected = row.path;
          renderList();
        });
        btn.addEventListener("dblclick", () => finish(true));
        list.append(btn);
      }
    }

    cancelBtn.addEventListener("click", () => finish(false));
    confirmBtn.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", () => finish(false));
    panel.addEventListener("click", (event) => event.stopPropagation());

    renderList();
    document.body.append(overlay);
    activeDialog = overlay;
    document.addEventListener("keydown", onKeyDown, true);
    queueMicrotask(() => confirmBtn.focus());
  });
}
