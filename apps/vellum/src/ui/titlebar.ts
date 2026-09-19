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
  createMenu,
  menuIcons,
  moreIcon,
  windowCloseIcon,
  windowMaximizeIcon,
  windowMinimizeIcon,
  windowRestoreIcon,
} from "@dionysen/ui";
import { onLocaleChange, t } from "../i18n/index.ts";
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

/** Actions for the trailing overflow menu. Omitted on windows that have no editor. */
export interface TitleBarMenuActions {
  getImmersive(): boolean;
  onToggleImmersive(): void;
  /** False when there is no open chapter that can be renamed. */
  canRename(): boolean;
  onRename(): void;
}

export interface TitleBarOptions {
  title?: string;
  controlMode?: "full" | "close-only";
  sidebarToggle?: SidebarToggleOptions;
  menuActions?: TitleBarMenuActions;
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
  let unsubscribeLocale: (() => void) | null = null;
  const menuActions = options.menuActions;
  let moreBtn: HTMLButtonElement | null = null;
  let moreMenu: ReturnType<typeof createMenu> | null = null;

  if (menuActions) {
    moreMenu = createMenu();
    moreMenu.el.classList.add("inimark-titlebar-more-menu");
    moreMenu.setPath("");
    // Fixed menu on body: the titlebar row is only one grid track tall.
    document.body.append(moreMenu.el);

    moreBtn = createIconButton({
      label: t("titlebar.more"),
      title: t("titlebar.more"),
      onClick: () => toggleMoreMenu(),
    });
    moreBtn.className = "inimark-sidebar-toggle-btn inimark-titlebar-more-btn";
    moreBtn.innerHTML = moreIcon();
    moreBtn.setAttribute("aria-haspopup", "menu");
    moreBtn.setAttribute("aria-expanded", "false");
    markNoDrag(moreBtn);
    moreBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    trailing.append(moreBtn);
    moreMenu.setDismissAnchors([moreBtn]);
    unsubscribeLocale = onLocaleChange(() => updateMoreButton());
  }

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

  function closeMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    moreMenu.setOpen(false);
    moreBtn.setAttribute("aria-expanded", "false");
  }

  function positionMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    const rect = moreBtn.getBoundingClientRect();
    const menuWidth = Math.max(160, moreMenu.el.offsetWidth || 160);
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    moreMenu.el.style.top = `${rect.bottom + 4}px`;
    moreMenu.el.style.left = `${left}px`;
  }

  function renderMoreMenu(): void {
    if (!moreMenu || !menuActions) return;
    moreMenu.clear();
    moreMenu.setPath("");
    moreMenu.addItem({
      label: t("titlebar.immersive"),
      icon: menuIcons.immersive,
      checked: menuActions.getImmersive(),
      onClick() {
        menuActions.onToggleImmersive();
        closeMoreMenu();
      },
    });
    moreMenu.addItem({
      label: t("titlebar.rename"),
      icon: menuIcons.rename,
      disabled: !menuActions.canRename(),
      onClick() {
        closeMoreMenu();
        menuActions.onRename();
      },
    });
  }

  function toggleMoreMenu(): void {
    if (!moreMenu || !moreBtn) return;
    if (moreMenu.isOpen()) {
      closeMoreMenu();
      return;
    }
    renderMoreMenu();
    moreMenu.setOpen(true);
    moreBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => positionMoreMenu());
  }

  function updateMoreButton(): void {
    if (!moreBtn) return;
    const label = t("titlebar.more");
    moreBtn.title = label;
    moreBtn.setAttribute("aria-label", label);
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
      unsubscribeLocale?.();
      moreMenu?.destroy();
      host.replaceChildren();
    },
  };
}
