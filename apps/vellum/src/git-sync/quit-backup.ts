export type CloudBackupChoice = "retry" | "exit";

export interface QuitBackupDeps {
  flushEdits(): Promise<void>;
  /** True when a cloud repo is ready. Throw when the session itself cannot be read. */
  cloudReady(): Promise<boolean>;
  /** Start the detached push. The main window closes after this resolves. */
  startBackground(): Promise<void>;
  askRetry(error: string): Promise<CloudBackupChoice>;
  destroy(): Promise<void>;
}

function errorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return String(err);
}

/**
 * Save, hand the upload to a background process, then close.
 * Starting that process can still fail here; the user may retry or quit.
 * A failed upload is handled by the background process, not this window.
 */
export function createQuitFlow(deps: QuitBackupDeps): () => Promise<void> {
  let quitting = false;

  return async function quit() {
    if (quitting) return;
    quitting = true;
    try {
      await deps.flushEdits();
      for (;;) {
        let ready = false;
        try {
          ready = await deps.cloudReady();
        } catch (err) {
          if ((await deps.askRetry(errorText(err))) === "exit") {
            await deps.destroy();
            return;
          }
          continue;
        }
        if (!ready) {
          await deps.destroy();
          return;
        }
        try {
          await deps.startBackground();
          await deps.destroy();
          return;
        } catch (err) {
          if ((await deps.askRetry(errorText(err))) === "exit") {
            await deps.destroy();
            return;
          }
        }
      }
    } finally {
      quitting = false;
    }
  };
}

export interface CloudBackupFailurePrompt {
  title: string;
  message: string;
  retryLabel: string;
  exitLabel: string;
}

/** Two-button dialog. Backdrop and Escape do not choose for the user. */
export function promptCloudBackupFailure(
  options: CloudBackupFailurePrompt,
): Promise<CloudBackupChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";

    const panel = document.createElement("div");
    panel.className = "inimark-confirm-dialog-panel";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "inimark-confirm-dialog-title";
    title.id = "vellum-quit-backup-title";
    title.textContent = options.title;
    panel.setAttribute("aria-labelledby", title.id);

    const message = document.createElement("p");
    message.className = "inimark-confirm-dialog-message";
    message.textContent = options.message;

    const actions = document.createElement("div");
    actions.className = "inimark-confirm-dialog-actions";

    const exitBtn = document.createElement("button");
    exitBtn.type = "button";
    exitBtn.className = "inimark-control inimark-btn inimark-confirm-dialog-btn";
    exitBtn.textContent = options.exitLabel;

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className =
      "inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn";
    retryBtn.textContent = options.retryLabel;

    const finish = (choice: CloudBackupChoice) => {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      resolve(choice);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    exitBtn.addEventListener("click", () => finish("exit"));
    retryBtn.addEventListener("click", () => finish("retry"));
    overlay.addEventListener("click", (event) => event.stopPropagation());

    actions.append(exitBtn, retryBtn);
    panel.append(title, message, actions);
    overlay.append(panel);
    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    retryBtn.focus();
  });
}
