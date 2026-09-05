import "../styles/confirm-dialog.css";

export type UnsavedChoice = "save" | "discard" | "cancel";

export interface UnsavedPromptOptions {
  title?: string;
  message?: string;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
}

let activeDialog: HTMLElement | null = null;

export function promptUnsavedChanges(
  options: UnsavedPromptOptions = {},
): Promise<UnsavedChoice> {
  if (activeDialog) {
    return Promise.resolve("cancel");
  }

  const title = options.title ?? "Save changes?";
  const message =
    options.message ?? "Your changes will be lost if you don't save them.";
  const saveLabel = options.saveLabel ?? "Save";
  const discardLabel = options.discardLabel ?? "Don't Save";
  const cancelLabel = options.cancelLabel ?? "Cancel";

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-confirm-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-confirm-title"></h2>
        <p class="inimark-confirm-dialog-message"></p>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-btn inimark-confirm-dialog-btn inimark-confirm-dialog-btn--discard" data-choice="discard"></button>
          <button type="button" class="inimark-btn inimark-confirm-dialog-btn inimark-confirm-dialog-btn--primary" data-choice="save"></button>
        </div>
      </div>
    `;

    overlay.querySelector(".inimark-confirm-dialog-title")!.textContent = title;
    overlay.querySelector(".inimark-confirm-dialog-message")!.textContent = message;
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const discardBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="discard"]')!;
    const saveBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="save"]')!;
    cancelBtn.textContent = `${cancelLabel} (N)`;
    discardBtn.textContent = `${discardLabel} (X)`;
    saveBtn.textContent = `${saveLabel} (Y)`;

    const panel = overlay.querySelector(".inimark-confirm-dialog-panel")!;

    function finish(choice: UnsavedChoice): void {
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
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        finish("save");
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "y") {
        event.preventDefault();
        finish("save");
      } else if (key === "n") {
        event.preventDefault();
        finish("cancel");
      } else if (key === "x" || key === "d") {
        event.preventDefault();
        finish("discard");
      }
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish("cancel");
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    cancelBtn.addEventListener("click", () => finish("cancel"));
    discardBtn.addEventListener("click", () => finish("discard"));
    saveBtn.addEventListener("click", () => finish("save"));

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
  activeDialog = overlay;
  saveBtn.focus();
  });
}

export interface ConfirmPromptOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** Simple confirm / cancel dialog. Resolves `true` when confirmed. */
export function promptConfirm(options: ConfirmPromptOptions = {}): Promise<boolean> {
  if (activeDialog) {
    return Promise.resolve(false);
  }

  const title = options.title ?? "Confirm";
  const message = options.message ?? "Are you sure?";
  const confirmLabel = options.confirmLabel ?? "Confirm";
  const cancelLabel = options.cancelLabel ?? "Cancel";
  const danger = options.danger ?? false;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-confirm-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-confirm-title"></h2>
        <p class="inimark-confirm-dialog-message"></p>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-btn inimark-confirm-dialog-btn" data-choice="cancel"></button>
          <button type="button" class="inimark-btn inimark-confirm-dialog-btn inimark-confirm-dialog-btn--primary" data-choice="confirm"></button>
        </div>
      </div>
    `;

    overlay.querySelector(".inimark-confirm-dialog-title")!.textContent = title;
    overlay.querySelector(".inimark-confirm-dialog-message")!.textContent = message;
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="confirm"]')!;
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;
    if (danger) {
      confirmBtn.classList.add("inimark-confirm-dialog-btn--discard");
      confirmBtn.classList.remove("inimark-confirm-dialog-btn--primary");
    }

    const panel = overlay.querySelector(".inimark-confirm-dialog-panel")!;

    function finish(ok: boolean): void {
      cleanup();
      resolve(ok);
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

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    cancelBtn.addEventListener("click", () => finish(false));
    confirmBtn.addEventListener("click", () => finish(true));

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    activeDialog = overlay;
    (danger ? cancelBtn : confirmBtn).focus();
  });
}
