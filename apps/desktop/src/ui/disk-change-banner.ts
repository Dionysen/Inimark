import { t } from "../i18n/index.ts";
import "../styles/disk-change-banner.css";

export type DiskChangeBannerKind = "modified" | "deleted";

export interface DiskChangeBannerController {
  showModified(handlers: { onReload: () => void; onKeep: () => void }): void;
  showDeleted(handlers: { onClose: () => void; onSaveAs: () => void }): void;
  hide(): void;
  isVisible(): boolean;
  destroy(): void;
}

/** Non-modal bar at the top of the editor pane for external disk changes. */
export function mountDiskChangeBanner(host: HTMLElement): DiskChangeBannerController {
  const el = document.createElement("div");
  el.className = "inimark-disk-change-banner";
  el.hidden = true;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  host.prepend(el);

  let visible = false;

  function render(
    kind: DiskChangeBannerKind,
    actions: Array<{ label: string; primary?: boolean; onClick: () => void }>,
  ): void {
    el.replaceChildren();
    el.dataset.kind = kind;

    const message = document.createElement("p");
    message.className = "inimark-disk-change-banner__message";
    message.textContent =
      kind === "deleted"
        ? t("editor.disk.deletedMessage")
        : t("editor.disk.modifiedMessage");

    const actionsEl = document.createElement("div");
    actionsEl.className = "inimark-disk-change-banner__actions";
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = action.primary
        ? "inimark-control inimark-btn inimark-btn--primary inimark-disk-change-banner__btn"
        : "inimark-control inimark-btn inimark-disk-change-banner__btn";
      btn.textContent = action.label;
      btn.addEventListener("click", action.onClick);
      actionsEl.append(btn);
    }

    el.append(message, actionsEl);
    el.hidden = false;
    visible = true;
  }

  return {
    showModified({ onReload, onKeep }) {
      render("modified", [
        { label: t("editor.disk.keep"), onClick: onKeep },
        { label: t("editor.disk.reload"), primary: true, onClick: onReload },
      ]);
    },
    showDeleted({ onClose, onSaveAs }) {
      render("deleted", [
        { label: t("editor.disk.saveAs"), onClick: onSaveAs },
        { label: t("editor.disk.close"), primary: true, onClick: onClose },
      ]);
    },
    hide() {
      el.hidden = true;
      el.replaceChildren();
      visible = false;
    },
    isVisible() {
      return visible;
    },
    destroy() {
      el.remove();
      visible = false;
    },
  };
}
