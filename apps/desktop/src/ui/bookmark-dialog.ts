import "../styles/bookmark-dialog.css";
import { t } from "../i18n/index.ts";
import {
  DEFAULT_BOOKMARK_GROUP_ID,
  createBookmarkGroup,
  getLibraryBookmarks,
  groupDisplayName,
  type BookmarkGroup,
} from "../bookmarks/store.ts";
import { createSelect } from "./widgets/select.ts";

export interface BookmarkDialogResult {
  confirmed: boolean;
  groupId: string;
}

export interface BookmarkDialogOptions {
  libraryId: string;
  path: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

let activeDialog: HTMLElement | null = null;

export function promptAddBookmark(
  options: BookmarkDialogOptions,
): Promise<BookmarkDialogResult> {
  if (activeDialog) {
    return Promise.resolve({
      confirmed: false,
      groupId: DEFAULT_BOOKMARK_GROUP_ID,
    });
  }

  const title = options.title ?? t("sidebar.bookmarks.addTitle");
  const confirmLabel = options.confirmLabel ?? t("sidebar.bookmarks.addConfirm");
  const cancelLabel = options.cancelLabel ?? t("common.cancel");
  const defaultGroupLabel = t("sidebar.bookmarks.defaultGroup");

  return new Promise((resolve) => {
    let groups = getLibraryBookmarks(options.libraryId).groups;
    let selectedGroupId =
      groups.find((g) => g.id === DEFAULT_BOOKMARK_GROUP_ID)?.id ??
      groups[0]?.id ??
      DEFAULT_BOOKMARK_GROUP_ID;

    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog inimark-bookmark-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel inimark-bookmark-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-bookmark-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-bookmark-title"></h2>
        <p class="inimark-confirm-dialog-message inimark-bookmark-dialog-path"></p>
        <div class="inimark-bookmark-dialog-field">
          <div class="inimark-bookmark-dialog-label" id="inimark-bookmark-group-label"></div>
          <div class="inimark-bookmark-dialog-select-host"></div>
        </div>
        <div class="inimark-bookmark-dialog-new">
          <input type="text" class="inimark-bookmark-dialog-input" />
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-action="create-group"></button>
        </div>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="confirm"></button>
        </div>
      </div>
    `;

    const panel = overlay.querySelector(".inimark-bookmark-dialog-panel")!;
    overlay.querySelector("#inimark-bookmark-title")!.textContent = title;
    const pathEl = overlay.querySelector(".inimark-bookmark-dialog-path")!;
    pathEl.textContent = options.path;
    (pathEl as HTMLElement).title = options.path;
    overlay.querySelector("#inimark-bookmark-group-label")!.textContent =
      t("sidebar.bookmarks.groupLabel");

    const selectHost = overlay.querySelector(
      ".inimark-bookmark-dialog-select-host",
    ) as HTMLElement;
    const input = overlay.querySelector<HTMLInputElement>(
      ".inimark-bookmark-dialog-input",
    )!;
    input.placeholder = t("sidebar.bookmarks.newGroupPlaceholder");
    input.setAttribute("aria-label", t("sidebar.bookmarks.newGroupPlaceholder"));

    const createBtn = overlay.querySelector<HTMLButtonElement>(
      '[data-action="create-group"]',
    )!;
    createBtn.textContent = t("sidebar.bookmarks.createGroup");

    const cancelBtn = overlay.querySelector<HTMLButtonElement>(
      '[data-choice="cancel"]',
    )!;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>(
      '[data-choice="confirm"]',
    )!;
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;

    function groupOptions() {
      return groups.map((group) => ({
        value: group.id,
        label: groupDisplayName(group, defaultGroupLabel),
      }));
    }

    const groupSelect = createSelect({
      value: selectedGroupId,
      options: groupOptions(),
      title: t("sidebar.bookmarks.groupLabel"),
      onChange(value) {
        selectedGroupId = value;
      },
    });
    groupSelect.el.classList.add("inimark-bookmark-dialog-select");
    selectHost.append(groupSelect.el);

    function finish(confirmed: boolean): void {
      cleanup();
      resolve({ confirmed, groupId: selectedGroupId });
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      groupSelect.destroy();
      overlay.remove();
      if (activeDialog === overlay) activeDialog = null;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        // Let an open select close first instead of dismissing the dialog.
        if (document.querySelector(".inimark-select-panel.is-open")) return;
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key === "Enter" && event.target !== input) {
        if (document.querySelector(".inimark-select-panel.is-open")) return;
        event.preventDefault();
        finish(true);
      }
    }

    function handleCreateGroup(): void {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      try {
        const created = createBookmarkGroup(options.libraryId, name);
        groups = getLibraryBookmarks(options.libraryId).groups;
        selectedGroupId = created.id;
        input.value = "";
        groupSelect.setOptions(groupOptions());
        groupSelect.setValue(created.id);
      } catch (error) {
        console.error(error);
      }
    }

    createBtn.addEventListener("click", () => handleCreateGroup());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCreateGroup();
      }
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    cancelBtn.addEventListener("click", () => finish(false));
    confirmBtn.addEventListener("click", () => finish(true));

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    activeDialog = overlay;
    confirmBtn.focus();
  });
}

export type { BookmarkGroup };
