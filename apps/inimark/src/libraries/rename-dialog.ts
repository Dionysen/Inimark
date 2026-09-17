import "../styles/bookmark-dialog.css";
import "../styles/confirm-dialog.css";
import { t } from "../i18n/index.ts";

let activeDialog: HTMLElement | null = null;

/** Modal dialog to rename a saved library. Returns trimmed name or null when cancelled. */
export function promptRenameLibrary(currentName: string): Promise<string | null> {
  if (activeDialog) return Promise.resolve(null);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog inimark-bookmark-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel inimark-bookmark-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-library-rename-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-library-rename-title"></h2>
        <div class="inimark-bookmark-dialog-field">
          <div class="inimark-bookmark-dialog-label" id="inimark-library-rename-label"></div>
          <input type="text" class="inimark-bookmark-dialog-input" />
        </div>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="confirm"></button>
        </div>
      </div>
    `;

    overlay.querySelector("#inimark-library-rename-title")!.textContent =
      t("settings.libraries.renameTitle");
    overlay.querySelector("#inimark-library-rename-label")!.textContent =
      t("settings.libraries.renameLabel");
    const input = overlay.querySelector<HTMLInputElement>(".inimark-bookmark-dialog-input")!;
    input.value = currentName;
    input.placeholder = t("settings.libraries.renamePlaceholder");

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
    input.select();
  });
}
