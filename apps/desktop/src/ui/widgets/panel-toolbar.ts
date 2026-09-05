import { createIconButton } from "./icon-button.ts";

export type PanelToolbarItem = {
  label: string;
  title?: string;
  icon: () => string;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
};

export interface PanelToolbarController {
  el: HTMLElement;
  buttons: HTMLButtonElement[];
  setHidden(hidden: boolean): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

/** Centered icon toolbar for a sidebar panel. Hide when the panel has no actions. */
export function createPanelToolbar(items: PanelToolbarItem[]): PanelToolbarController {
  const el = document.createElement("div");
  el.className = "inimark-panel-toolbar";
  el.setAttribute("role", "toolbar");

  const buttons: HTMLButtonElement[] = [];
  for (const item of items) {
    const btn = createIconButton({
      label: item.label,
      title: item.title ?? item.label,
      html: item.icon(),
      onClick: item.onClick,
    });
    if (item.disabled) btn.disabled = true;
    buttons.push(btn);
    el.append(btn);
  }

  if (items.length === 0) {
    el.hidden = true;
  }

  return {
    el,
    buttons,
    setHidden(hidden) {
      el.hidden = hidden;
    },
    setDisabled(disabled) {
      for (const btn of buttons) btn.disabled = disabled;
    },
    destroy() {
      el.replaceChildren();
      el.remove();
    },
  };
}
