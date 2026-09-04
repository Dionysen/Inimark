export type ButtonVariant = "default" | "ghost" | "primary";

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  title?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `inimark-control inimark-btn inimark-btn--${options.variant ?? "default"}`;
  button.textContent = options.label;
  if (options.title) button.title = options.title;
  if (options.disabled) button.disabled = true;
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}
