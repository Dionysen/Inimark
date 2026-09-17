import "../styles/confirm-dialog.css";
import { t } from "../i18n/index.ts";
import { createToggle } from "./widgets/toggle.ts";

export type LinkUpdateChoice = "update" | "skip" | "cancel";

export interface LinkUpdatePromptResult {
  choice: LinkUpdateChoice;
  always: boolean;
}

export interface LinkUpdatePromptOptions {
  filesCount: number;
  linksCount: number;
  title?: string;
  message?: string;
  updateLabel?: string;
  skipLabel?: string;
  alwaysLabel?: string;
}

let activeDialog: HTMLElement | null = null;

/** Ask whether to rewrite wiki links after a move/rename. */
export function promptLinkUpdate(
  options: LinkUpdatePromptOptions,
): Promise<LinkUpdatePromptResult> {
  if (activeDialog) {
    return Promise.resolve({ choice: "cancel", always: false });
  }

  const title = options.title ?? t("dialogs.linkUpdateTitle");
  const message =
    options.message ??
    t("dialogs.linkUpdateMessage", {
      links: options.linksCount,
      files: options.filesCount,
    });
  const updateLabel = options.updateLabel ?? t("dialogs.linkUpdateConfirm");
  const skipLabel = options.skipLabel ?? t("dialogs.linkUpdateSkip");
  const alwaysLabel = options.alwaysLabel ?? t("dialogs.linkUpdateAlways");

  return new Promise((resolve) => {
    let always = false;

    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";
    overlay.innerHTML = `
      <div class="inimark-confirm-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="inimark-link-update-title">
        <h2 class="inimark-confirm-dialog-title" id="inimark-link-update-title"></h2>
        <p class="inimark-confirm-dialog-message"></p>
        <div class="inimark-link-update-always"></div>
        <div class="inimark-confirm-dialog-actions">
          <button type="button" class="inimark-control inimark-btn inimark-confirm-dialog-btn" data-choice="skip"></button>
          <button type="button" class="inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn" data-choice="update"></button>
        </div>
      </div>
    `;

    overlay.querySelector(".inimark-confirm-dialog-title")!.textContent = title;
    overlay.querySelector(".inimark-confirm-dialog-message")!.textContent = message;

    const alwaysHost = overlay.querySelector(".inimark-link-update-always") as HTMLElement;
    const alwaysToggle = createToggle({
      checked: false,
      title: alwaysLabel,
      onChange(checked) {
        always = checked;
      },
    });
    const alwaysRow = document.createElement("label");
    alwaysRow.className = "inimark-link-update-always-row";
    const alwaysText = document.createElement("span");
    alwaysText.textContent = alwaysLabel;
    alwaysRow.append(alwaysToggle.el, alwaysText);
    alwaysHost.append(alwaysRow);

    const skipBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="skip"]')!;
    const updateBtn = overlay.querySelector<HTMLButtonElement>('[data-choice="update"]')!;
    skipBtn.textContent = skipLabel;
    updateBtn.textContent = updateLabel;

    const panel = overlay.querySelector(".inimark-confirm-dialog-panel")!;

    function finish(choice: LinkUpdateChoice): void {
      cleanup();
      resolve({ choice, always: choice === "update" ? always : false });
    }

    function cleanup(): void {
      document.removeEventListener("keydown", onKeyDown, true);
      alwaysToggle.destroy();
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
        finish("update");
      }
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish("cancel");
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    skipBtn.addEventListener("click", () => finish("skip"));
    updateBtn.addEventListener("click", () => finish("update"));

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    activeDialog = overlay;
    updateBtn.focus();
  });
}
