import "../styles/quick-open.css";
import { t } from "../i18n/index.ts";
import { fileNameFromPath } from "../platform/env.ts";
import type { QuickOpenFile } from "../quick-open/search.ts";
import { filterQuickOpenFiles } from "../quick-open/search.ts";
import { recentFilesToItems } from "../quick-open/recent-files.ts";

export interface QuickOpenDialogOptions {
  files: QuickOpenFile[];
  recentPaths: string[];
  currentFilePath: string | null;
  hasWorkspace: boolean;
}

let activeDialog: HTMLElement | null = null;

const FILE_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

const SEARCH_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

function appendHighlightedText(
  parent: HTMLElement,
  text: string,
  query: string,
): void {
  if (!query) {
    parent.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    parent.textContent = text;
    return;
  }
  parent.append(text.slice(0, idx));
  const mark = document.createElement("span");
  mark.className = "inimark-quick-open-highlight";
  mark.textContent = text.slice(idx, idx + query.length);
  parent.append(mark, text.slice(idx + query.length));
}

export function showQuickOpenDialog(
  options: QuickOpenDialogOptions,
): Promise<string | null> {
  if (activeDialog) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let query = "";
    let selectedIndex = 0;
    let isKeyboardNav = false;
    let keyboardNavTimer: ReturnType<typeof setTimeout> | null = null;

    const recentItems = recentFilesToItems(
      options.recentPaths,
      options.currentFilePath,
      fileNameFromPath,
    );

    const overlay = document.createElement("div");
    overlay.className = "inimark-quick-open-overlay";
    overlay.innerHTML = `
      <div class="inimark-quick-open-dialog" role="dialog" aria-modal="true" aria-label="${t("quickOpen.title")}">
        <div class="inimark-quick-open-header">
          <span class="inimark-quick-open-icon">${SEARCH_ICON}</span>
          <input type="text" class="inimark-quick-open-input" autocomplete="off" spellcheck="false" />
        </div>
        <div class="inimark-quick-open-results inimark-scrollbar" role="listbox"></div>
        <div class="inimark-quick-open-footer">
          <span class="inimark-quick-open-hint"></span>
          <span class="inimark-quick-open-count"></span>
        </div>
      </div>
    `;

    const dialog = overlay.querySelector(".inimark-quick-open-dialog") as HTMLElement;
    const input = overlay.querySelector(".inimark-quick-open-input") as HTMLInputElement;
    const results = overlay.querySelector(".inimark-quick-open-results") as HTMLElement;
    const hint = overlay.querySelector(".inimark-quick-open-hint") as HTMLElement;
    const count = overlay.querySelector(".inimark-quick-open-count") as HTMLElement;

    input.placeholder = t("quickOpen.placeholder");
    hint.innerHTML = `
      <kbd>↑</kbd> <kbd>↓</kbd> ${t("quickOpen.select")}&nbsp;
      <kbd>Enter</kbd> ${t("quickOpen.open")}&nbsp;
      <kbd>Esc</kbd> ${t("quickOpen.close")}
    `;

    function markKeyboardNav(): void {
      isKeyboardNav = true;
      if (keyboardNavTimer) clearTimeout(keyboardNavTimer);
      keyboardNavTimer = setTimeout(() => {
        isKeyboardNav = false;
      }, 200);
    }

    function currentItems(): QuickOpenFile[] {
      const q = query.trim();
      if (q) return filterQuickOpenFiles(options.files, q);
      return recentItems;
    }

    function finish(path: string | null): void {
      cleanup();
      resolve(path);
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      if (activeDialog === overlay) activeDialog = null;
      if (keyboardNavTimer) clearTimeout(keyboardNavTimer);
    }

    function scrollSelectedIntoView(): void {
      const selected = results.querySelector(".inimark-quick-open-item.is-selected");
      selected?.scrollIntoView({ block: "nearest" });
    }

    function render(): void {
      const items = currentItems();
      const searchMode = query.trim().length > 0;
      selectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(items.length - 1, 0)));
      results.replaceChildren();

      if (!options.hasWorkspace) {
        const empty = document.createElement("div");
        empty.className = "inimark-quick-open-empty";
        empty.textContent = t("quickOpen.noLibrary");
        results.append(empty);
        count.textContent = t("quickOpen.results", { count: 0 });
        return;
      }

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "inimark-quick-open-empty";
        const title = document.createElement("div");
        title.className = "inimark-quick-open-empty-title";
        title.textContent = searchMode
          ? t("quickOpen.noMatch")
          : t("quickOpen.recentFiles");
        empty.append(title);
        if (!searchMode) {
          const hintEl = document.createElement("div");
          hintEl.className = "inimark-quick-open-empty-hint";
          hintEl.textContent = t("quickOpen.searchHint");
          empty.append(hintEl);
        }
        results.append(empty);
        count.textContent = t("quickOpen.results", { count: 0 });
        return;
      }

      if (!searchMode) {
        const label = document.createElement("div");
        label.className = "inimark-quick-open-section-label";
        label.textContent = t("quickOpen.recentAccess");
        results.append(label);
      }

      items.forEach((file, idx) => {
        const row = document.createElement("div");
        row.className = "inimark-quick-open-item";
        row.setAttribute("role", "option");
        if (idx === selectedIndex) {
          row.classList.add("is-selected");
          row.setAttribute("aria-selected", "true");
        } else {
          row.setAttribute("aria-selected", "false");
        }

        const icon = document.createElement("span");
        icon.className = "inimark-quick-open-item-icon";
        icon.innerHTML = FILE_ICON;

        const name = document.createElement("span");
        name.className = "inimark-quick-open-item-name";
        appendHighlightedText(name, file.name, searchMode ? query : "");

        const path = document.createElement("span");
        path.className = "inimark-quick-open-item-path";
        appendHighlightedText(path, file.path, searchMode ? query : "");

        row.append(icon, name, path);
        row.addEventListener("click", () => finish(file.path));
        row.addEventListener("mouseenter", () => {
          if (isKeyboardNav) return;
          selectedIndex = idx;
          render();
        });
        results.append(row);
      });

      count.textContent = t("quickOpen.results", { count: items.length });
      scrollSelectedIntoView();
    }

    function moveSelection(delta: number): void {
      const items = currentItems();
      if (!items.length) return;
      markKeyboardNav();
      selectedIndex = Math.max(0, Math.min(selectedIndex + delta, items.length - 1));
      render();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key === "j") {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveSelection(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "Enter": {
          event.preventDefault();
          const items = currentItems();
          const item = items[selectedIndex];
          if (item) finish(item.path);
          break;
        }
        case "Escape":
          event.preventDefault();
          finish(null);
          break;
      }
    }

    input.addEventListener("input", () => {
      query = input.value;
      selectedIndex = 0;
      render();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    dialog.addEventListener("click", (event) => event.stopPropagation());

    document.body.append(overlay);
    activeDialog = overlay;
    document.addEventListener("keydown", onKeyDown, true);
    render();
    queueMicrotask(() => input.focus());
  });
}
