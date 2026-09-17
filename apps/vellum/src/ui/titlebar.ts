import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
  usesNativeWindowControls,
} from "@dionysen/shell";
import {
  createIconButton,
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "@dionysen/ui";
import { t } from "../i18n/index.ts";
import { sidebarToggleIcon } from "./product-icons.ts";

export interface TitleBarController {
  setTitle(title: string): void;
  /** Sync expand-toggle visibility (hidden while sidebar is open). */
  setSidebarOpen(open: boolean): void;
  destroy(): void;
}

export interface SidebarToggleOptions {
  open: boolean;
  onToggle: () => void;
}

export interface TitleBarOptions {
  title?: string;
  controlMode?: "full" | "close-only";
  sidebarToggle?: SidebarToggleOptions;
  onClose?: () => void | Promise<void>;
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

/** Product titlebar with optional sidebar expand toggle and window chrome. */
export function mountTitleBar(
  host: HTMLElement,
  options: TitleBarOptions = {},
): TitleBarController {
  const controlMode = options.controlMode ?? "full";
  const showControls =
    !usesNativeWindowControls() && supportsWindowChrome();
  let sidebarOpen = options.sidebarToggle?.open ?? true;

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");
  host.replaceChildren();

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  let sidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.sidebarToggle) {
    sidebarToggleBtn = createIconButton({
      label: sidebarOpen
        ? t("common.collapseSidebar")
        : t("common.expandSidebar"),
      title: sidebarOpen
        ? t("common.collapseSidebar")
        : t("common.expandSidebar"),
      onClick: options.sidebarToggle.onToggle,
    });
    sidebarToggleBtn.className = "inimark-sidebar-toggle-btn";
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    // Obsidian-style: titlebar only shows the expand control while collapsed.
    sidebarToggleBtn.hidden = sidebarOpen;
    markNoDrag(sidebarToggleBtn);
    leading.append(sidebarToggleBtn);
  }

  const center = document.createElement("div");
  center.className = "inimark-titlebar-center";
  const titleEl = document.createElement("span");
  titleEl.className = "inimark-titlebar-title";
  titleEl.textContent = options.title ?? "";
  center.append(titleEl);

  const trailing = document.createElement("div");
  trailing.className = "inimark-titlebar-trailing";
  markNoDrag(trailing);

  let unlistenMaximize: (() => void) | null = null;

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";
    if (controlMode === "close-only") {
      controls.classList.add("inimark-titlebar-controls--close-only");
    }

    if (controlMode === "full") {
      const minBtn = document.createElement("button");
      minBtn.type = "button";
      minBtn.className = "inimark-titlebar-btn";
      minBtn.setAttribute("aria-label", t("common.close"));
      minBtn.innerHTML = windowMinimizeIcon();
      minBtn.addEventListener("click", () => void minimizeWindow());

      const maxBtn = document.createElement("button");
      maxBtn.type = "button";
      maxBtn.className = "inimark-titlebar-btn";
      maxBtn.innerHTML = windowMaximizeIcon();
      maxBtn.addEventListener("click", () => void toggleMaximizeWindow());
      void onWindowMaximizedChange((maximized) => {
        maxBtn.innerHTML = maximized
          ? windowRestoreIcon()
          : windowMaximizeIcon();
      }).then((fn) => {
        unlistenMaximize = fn;
      });

      controls.append(minBtn, maxBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
    closeBtn.setAttribute("aria-label", t("common.close"));
    closeBtn.innerHTML = windowCloseIcon();
    closeBtn.addEventListener("click", () => {
      void (options.onClose?.() ?? closeWindow());
    });
    controls.append(closeBtn);
    trailing.append(controls);
  }

  host.append(leading, center, trailing);

  return {
    setTitle(title: string) {
      titleEl.textContent = title;
    },
    setSidebarOpen(open: boolean) {
      sidebarOpen = open;
      if (!sidebarToggleBtn) return;
      sidebarToggleBtn.hidden = open;
      sidebarToggleBtn.innerHTML = sidebarToggleIcon(open);
      const label = open
        ? t("common.collapseSidebar")
        : t("common.expandSidebar");
      sidebarToggleBtn.title = label;
      sidebarToggleBtn.setAttribute("aria-label", label);
    },
    destroy() {
      unlistenMaximize?.();
      host.replaceChildren();
    },
  };
}
