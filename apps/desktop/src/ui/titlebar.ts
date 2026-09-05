import { onLocaleChange, t } from "../i18n/index.ts";
import { usesNativeWindowControls } from "../platform/platform.ts";
import {
  closeWindow,
  minimizeWindow,
  onWindowMaximizedChange,
  supportsWindowChrome,
  toggleMaximizeWindow,
} from "../platform/window-chrome.ts";
import {
  createIconButton,
  rightSidebarToggleIcon,
  sidebarToggleIcon,
} from "./icon-button.ts";
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
  setRightSidebarOpen(open: boolean): void;
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
  rightSidebarToggle?: SidebarToggleOptions;
  onClose?: () => void | Promise<void>;
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
  let rightSidebarOpen = options.rightSidebarToggle?.open ?? true;

  host.className = "inimark-titlebar";
  host.setAttribute("data-tauri-drag-region", "deep");

  const leading = document.createElement("div");
  leading.className = "inimark-titlebar-leading";

  let sidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.sidebarToggle) {
    sidebarToggleBtn = createIconButton({
      label: sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar"),
      title: sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar"),
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

  let rightSidebarToggleBtn: HTMLButtonElement | null = null;
  if (options.rightSidebarToggle) {
    rightSidebarToggleBtn = createIconButton({
      label: rightSidebarOpen
        ? t("common.collapseRightSidebar")
        : t("common.expandRightSidebar"),
      title: rightSidebarOpen
        ? t("common.collapseRightSidebar")
        : t("common.expandRightSidebar"),
      onClick: options.rightSidebarToggle.onToggle,
    });
    rightSidebarToggleBtn.className =
      "inimark-sidebar-toggle-btn inimark-right-sidebar-titlebar-toggle";
    rightSidebarToggleBtn.innerHTML = rightSidebarToggleIcon(rightSidebarOpen);
    markNoDrag(rightSidebarToggleBtn);
    trailing.append(rightSidebarToggleBtn);
  }

  if (showControls) {
    const controls = document.createElement("div");
    controls.className = "inimark-titlebar-controls inimark-titlebar-controls--native";
    if (controlMode === "close-only") {
      controls.classList.add("inimark-titlebar-controls--close-only");
    }

    if (controlMode === "full") {
      const btnMinimize = createIconButton({
        label: t("common.minimize"),
        title: t("common.minimize"),
      });
      btnMinimize.className = "inimark-titlebar-btn";
      btnMinimize.innerHTML = windowMinimizeIcon();
      markNoDrag(btnMinimize);
      btnMinimize.addEventListener("click", () => void minimizeWindow());

      const btnMaximize = createIconButton({
        label: t("common.maximize"),
        title: t("common.maximize"),
      });
      btnMaximize.className = "inimark-titlebar-btn";
      btnMaximize.innerHTML = windowMaximizeIcon();
      markNoDrag(btnMaximize);

      function setMaximized(maximized: boolean): void {
        btnMaximize.innerHTML = maximized ? windowRestoreIcon() : windowMaximizeIcon();
        btnMaximize.title = maximized ? t("common.restore") : t("common.maximize");
        btnMaximize.setAttribute(
          "aria-label",
          maximized ? t("common.restore") : t("common.maximize"),
        );
      }

      btnMaximize.addEventListener("click", () => {
        void toggleMaximizeWindow();
      });

      const btnClose = createIconButton({
        label: t("common.close"),
        title: t("common.close"),
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => {
        void (options.onClose ?? closeWindow)();
      });

      controls.append(btnMinimize, btnMaximize, btnClose);

      void onWindowMaximizedChange(setMaximized).then((unlisten) => {
        unlistenMaximize = unlisten;
      });
    } else {
      const btnClose = createIconButton({
        label: t("common.close"),
        title: t("common.close"),
      });
      btnClose.className = "inimark-titlebar-btn inimark-titlebar-btn--close";
      btnClose.innerHTML = windowCloseIcon();
      markNoDrag(btnClose);
      btnClose.addEventListener("click", () => {
        void (options.onClose ?? closeWindow)();
      });
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
    // Obsidian-style: titlebar toggle only when sidebar is collapsed.
    sidebarToggleBtn.hidden = sidebarOpen;
    sidebarToggleBtn.innerHTML = sidebarToggleIcon(sidebarOpen);
    const label = sidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar");
    sidebarToggleBtn.title = label;
    sidebarToggleBtn.setAttribute("aria-label", label);
  }

  function updateRightSidebarToggle(): void {
    if (!rightSidebarToggleBtn) return;
    // Windows: keep the titlebar toggle always visible (fixed left of captions).
    // Other platforms: Obsidian-style — only when the right sidebar is collapsed.
    const pinToggle =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("platform-windows");
    rightSidebarToggleBtn.hidden = pinToggle ? false : rightSidebarOpen;
    rightSidebarToggleBtn.innerHTML = rightSidebarToggleIcon(rightSidebarOpen);
    const label = rightSidebarOpen
      ? t("common.collapseRightSidebar")
      : t("common.expandRightSidebar");
    rightSidebarToggleBtn.title = label;
    rightSidebarToggleBtn.setAttribute("aria-label", label);
  }

  updateSidebarToggle();
  updateRightSidebarToggle();
  const unsubscribeLocale = onLocaleChange(() => {
    updateSidebarToggle();
    updateRightSidebarToggle();
  });

  return {
    setTitle(title) {
      titleEl.textContent = title;
    },
    setSidebarOpen(open) {
      sidebarOpen = open;
      updateSidebarToggle();
    },
    setRightSidebarOpen(open) {
      rightSidebarOpen = open;
      updateRightSidebarToggle();
    },
    destroy() {
      unsubscribeLocale();
      unlistenMaximize?.();
      host.replaceChildren();
      host.className = "";
      host.removeAttribute("data-tauri-drag-region");
    },
  };
}
