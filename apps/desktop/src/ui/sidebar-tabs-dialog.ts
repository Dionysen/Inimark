import "../styles/confirm-dialog.css";
import "../styles/settings.css";
import "../styles/sidebar-tabs-dialog.css";
import { t } from "../i18n/index.ts";
import { createSidebarTabsControl } from "../settings/sidebar-tabs-control.ts";
import type { SidebarTabLayout } from "../sidebar/tab-layout.ts";

export interface SidebarTabsDialogOptions {
  layout: SidebarTabLayout;
  onChange(layout: SidebarTabLayout): void;
}

let activeDialog: HTMLElement | null = null;

export function showSidebarTabsDialog(options: SidebarTabsDialogOptions): void {
  if (activeDialog) return;

  const closeLabel = t("common.close");

  const overlay = document.createElement("div");
  overlay.className = "inimark-confirm-dialog inimark-sidebar-tabs-dialog";

  const panel = document.createElement("div");
  panel.className = "inimark-confirm-dialog-panel inimark-sidebar-tabs-dialog-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "inimark-sidebar-tabs-dialog-title");

  const title = document.createElement("h2");
  title.className = "inimark-confirm-dialog-title";
  title.id = "inimark-sidebar-tabs-dialog-title";
  title.textContent = t("titlebar.more.sidebarTabs");

  const tabsControl = createSidebarTabsControl({
    layout: options.layout,
    onChange: options.onChange,
  });

  const actions = document.createElement("div");
  actions.className = "inimark-confirm-dialog-actions";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn";
  closeBtn.textContent = closeLabel;

  actions.append(closeBtn);
  panel.append(title, tabsControl.el, actions);
  overlay.append(panel);

  function finish(): void {
    if (activeDialog !== overlay) return;
    activeDialog = null;
    tabsControl.destroy();
    overlay.remove();
    window.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  }

  closeBtn.addEventListener("click", finish);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) finish();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());

  activeDialog = overlay;
  document.body.append(overlay);
  window.addEventListener("keydown", onKeyDown);
  closeBtn.focus();
}
