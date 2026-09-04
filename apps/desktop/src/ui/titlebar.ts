import { usesNativeWindowControls } from "../platform/platform.ts";
import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
} from "../platform/window-chrome.ts";
import { createIconButton, sidebarToggleIcon } from "./icon-button.ts";
import {
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "./window-icons.ts";

export type WindowControlMode = "full" | "close-only";

export interface TitleBarController {
  setTitle(title: string): void;
  setSidebarOpen(open: boolean): void;
  destroy(): void;
}

export interface SidebarToggleOptions {
  open: boolean;
  onToggle: () => void;
}

export interface TitleBarOptions {
  title?: string;
  /** When omitted, shows custom controls in Tauri on non-macOS platforms. */
  showWindowControls?: boolean;
  controlMode?: WindowControlMode;
  sidebarToggle?: SidebarToggleOptions;
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

export function mountTitleBar(
  host: HTMLElement,
  options: TitleBarOptions = {},
): TitleBarController {
  const controlMode = options.controlMode ?? "full";
  const showControls =
    !usesNativeWindowControls() &&
    (options.showWindowControls ?? supportsWindowChrome());
  let unlistenMaximize: (() => void) | null = null;
  let sidebarOpen = options.sidebarToggle?.open ?? true;

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  let sidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.sidebarToggle) {
    sidebarToggleBtn = createIconButton({
      label: sidebarOpen ? "Collapse sidebar" : "Expand sidebar",
      title: sidebarOpen ? "Collapse sidebar" : "Expand sidebar",
      onClick: options.sidebarToggle.onToggle,
    });
    sidebarToggleBtn.className = "inimark-sidebar-toggle-btn";
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    markNoDrag(sidebarToggleBtn);
    leading.append(sidebarToggleBtn);
  }

  const center = document.createElement("div");
  center.className = "inimark-titlebar-center";

  const titleEl = document.createElement("span");
  titleEl.className = "inimark-titlebar-title";
  titleEl.textContent = options.title ?? "";

  const trailing = document.createElement("div");
  trailing.className = "inimark-titlebar-trailing";
  markNoDrag(trailing);

  center.append(titleEl);

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";

    if (controlMode === "full") {
      const btnMinimize = createIconButton({
        label: "Minimize",
        title: "Minimize",
      });
      btnMinimize.className = "inimark-titlebar-btn";
      btnMinimize.innerHTML = windowMinimizeIcon();
      markNoDrag(btnMinimize);
      btnMinimize.addEventListener("click", () => void minimizeWindow());

      const btnMaximize = createIconButton({
        label: "Maximize",
        title: "Maximize",
      });
      btnMaximize.className = "inimark-titlebar-btn";
      btnMaximize.innerHTML = windowMaximizeIcon();
      markNoDrag(btnMaximize);

      function setMaximized(maximized: boolean): void {
        btnMaximize.innerHTML = maximized ? windowRestoreIcon() : windowMaximizeIcon();
        btnMaximize.title = maximized ? "Restore" : "Maximize";
        btnMaximize.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
      }

      btnMaximize.addEventListener("click", () => {
        void toggleMaximizeWindow();
      });

      const btnClose = createIconButton({
        label: "Close",
        title: "Close",
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => void closeWindow());

      controls.append(btnMinimize, btnMaximize, btnClose);

      void onWindowMaximizedChange(setMaximized).then((unlisten) => {
        unlistenMaximize = unlisten;
      });
    } else {
      const btnClose = createIconButton({
        label: "Close",
        title: "Close",
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => void closeWindow());
      controls.append(btnClose);
    }

    trailing.append(controls);
  }

  host.append(leading, center, trailing);

  const onDoubleClick = () => {
    if (!showControls || controlMode !== "full") return;
    void toggleMaximizeWindow();
  };
  leading.addEventListener("dblclick", onDoubleClick);
  center.addEventListener("dblclick", onDoubleClick);

  function updateSidebarToggle(): void {
    if (!sidebarToggleBtn) return;
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    sidebarToggleBtn.title = sidebarOpen ? "Collapse sidebar" : "Expand sidebar";
    sidebarToggleBtn.setAttribute(
      "aria-label",
      sidebarOpen ? "Collapse sidebar" : "Expand sidebar",
    );
  }

  return {
    setTitle(title) {
      titleEl.textContent = title;
    },
    setSidebarOpen(open) {
      sidebarOpen = open;
      updateSidebarToggle();
    },
    destroy() {
      unlistenMaximize?.();
      host.replaceChildren();
      host.className = "";
      host.removeAttribute("data-tauri-drag-region");
    },
  };
}
