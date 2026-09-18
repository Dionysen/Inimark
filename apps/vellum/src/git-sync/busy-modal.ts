export interface BusyModal {
  setMessage(message: string): void;
  close(): void;
}

interface BusySession {
  overlay: HTMLElement;
  panel: HTMLElement;
  message: HTMLElement;
  token: symbol;
}

let current: BusySession | null = null;

/**
 * Modal spinner for a cloud-sync operation that cannot be cancelled.
 * A later open replaces the previous one; `close` only removes the session it opened.
 */
export function openBusyModal(message: string): BusyModal {
  const token = Symbol();
  const overlay = document.createElement("div");
  overlay.className = "vellum-busy-overlay";

  const panel = document.createElement("div");
  panel.className = "vellum-busy-panel";
  panel.setAttribute("role", "alertdialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-busy", "true");

  const spinner = document.createElement("div");
  spinner.className = "vellum-busy-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const label = document.createElement("p");
  label.className = "vellum-busy-message";
  label.textContent = message;

  panel.setAttribute("aria-label", message);
  panel.append(spinner, label);
  overlay.append(panel);
  document.body.append(overlay);

  const session: BusySession = { overlay, panel, message: label, token };
  current?.overlay.remove();
  current = session;

  return {
    setMessage(next: string) {
      if (current?.token !== token) return;
      label.textContent = next;
      panel.setAttribute("aria-label", next);
    },
    close() {
      if (current?.token !== token) return;
      overlay.remove();
      current = null;
    },
  };
}

/**
 * Two frames: the first applies layout, the second is the painted spinner.
 * Without this, a command that starts in the same turn hides the modal before it appears.
 */
function afterPaint(): Promise<void> {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis);
  if (!raf) return Promise.resolve();
  return new Promise((resolve) => {
    raf(() => raf(() => resolve()));
  });
}

/** Shows the spinner for the duration of `work`, including when `work` throws. */
export async function withBusy<T>(
  message: string,
  work: (modal: BusyModal) => Promise<T>,
): Promise<T> {
  const modal = openBusyModal(message);
  try {
    await afterPaint();
    return await work(modal);
  } finally {
    modal.close();
  }
}
