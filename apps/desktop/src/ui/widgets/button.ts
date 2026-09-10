import { bindTooltip } from "./tooltip.ts";

export type ButtonVariant = "default" | "ghost" | "primary" | "danger";

export interface ButtonOptions {
  label: string;
  /** Inline SVG / HTML shown to the left of the label. */
  icon?: string;
  variant?: ButtonVariant;
  title?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `inimark-control inimark-btn inimark-btn--${options.variant ?? "default"}`;
  if (options.icon) {
    button.classList.add("inimark-btn--with-icon");
    button.innerHTML = `${options.icon}<span>${options.label}</span>`;
  } else {
    button.textContent = options.label;
  }
  if (options.title) bindTooltip(button, options.title);
  if (options.disabled) button.disabled = true;
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}
