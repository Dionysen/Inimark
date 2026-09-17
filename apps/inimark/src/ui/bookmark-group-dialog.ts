import "../styles/bookmark-dialog.css";
import "../styles/confirm-dialog.css";
import { t } from "../i18n/index.ts";

export type CopyBookmarkGroupChoice = "cancel" | "empty" | "with-items";

let activeDialog: HTMLElement | null = null;

export function promptRenameBookmarkGroup(
  currentName: string,
): Promise<string | null> {
  return promptBookmarkGroupName({
    title: t("sidebar.bookmarks.renameGroup"),
    initialName: currentName,
  });
}

export function promptCreateBookmarkGroup(): Promise<string | null> {
  return promptBookmarkGroupName({
    title: t("sidebar.bookmarks.createGroupTitle"),
    initialName: "",
  });
}

function promptBookmarkGroupName(options: {
  title: string;
  initialName: string;
}): Promise<string | null> {
  if (activeDialog) return Promise.resolve(null);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog inimark-bookmark-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel inimark-bookmark-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-bookmark-group-name-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-bookmark-group-name-title"></h2>
        <div class="inimark-bookmark-dialog-field">
          <div class="inimark-bookmark-dialog-label" id="inimark-bookmark-group-name-label"></div>
          <input type="text" class="inimark-bookmark-dialog-input" />
        </div>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="confirm"></button>
        </div>
      </div>
    `;

    overlay.querySelector("#inimark-bookmark-group-name-title")!.textContent =
      options.title;
    overlay.querySelector("#inimark-bookmark-group-name-label")!.textContent =
      t("sidebar.bookmarks.groupLabel");
    const input = overlay.querySelector<HTMLInputElement>(".inimark-bookmark-dialog-input")!;
    input.value = options.initialName;
    input.placeholder = t("sidebar.bookmarks.newGroupPlaceholder");

    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="confirm"]')!;
    cancelBtn.textContent = t("common.cancel");
    confirmBtn.textContent = t("common.confirm");

    const panel = overlay.querySelector(".inimark-confirm-dialog-panel")!;

    function finish(value: string | null): void {
      cleanup();
      resolve(value);
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      if (activeDialog === overlay) activeDialog = null;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const next = input.value.trim();
        finish(next || null);
      }
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    cancelBtn.addEventListener("click", () => finish(null));
    confirmBtn.addEventListener("click", () => {
      const next = input.value.trim();
      finish(next || null);
    });

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    activeDialog = overlay;
    input.focus();
    if (options.initialName) input.select();
  });
}

export function promptCopyBookmarkGroup(
  groupName: string,
): Promise<CopyBookmarkGroupChoice> {
  if (activeDialog) return Promise.resolve("cancel");

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-bookmark-group-copy-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-bookmark-group-copy-title"></h2>
        <p class="inimark-confirm-dialog-message"></p>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="empty"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="with-items"></button>
        </div>
      </div>
    `;

    overlay.querySelector("#inimark-bookmark-group-copy-title")!.textContent =
      t("sidebar.bookmarks.copyGroup");
    overlay.querySelector(".inimark-confirm-dialog-message")!.textContent =
      t("sidebar.bookmarks.copyGroupMessage", { name: groupName });

    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const emptyBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="empty"]')!;
    const withItemsBtn = overlay.querySelector<HTMLButtonElement>(
      '[data-choice="with-items"]',
    )!;
    cancelBtn.textContent = t("common.cancel");
    emptyBtn.textContent = t("sidebar.bookmarks.copyGroupEmpty");
    withItemsBtn.textContent = t("sidebar.bookmarks.copyGroupWithItems");

    const panel = overlay.querySelector(".inimark-confirm-dialog-panel")!;

    function finish(choice: CopyBookmarkGroupChoice): void {
      cleanup();
      resolve(choice);
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      if (activeDialog === overlay) activeDialog = null;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        finish("cancel");
      }
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish("cancel");
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    cancelBtn.addEventListener("click", () => finish("cancel"));
    emptyBtn.addEventListener("click", () => finish("empty"));
    withItemsBtn.addEventListener("click", () => finish("with-items"));

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    activeDialog = overlay;
    withItemsBtn.focus();
  });
}
