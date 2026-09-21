export type IconButtonVariant = "ghost" | "default" | "danger";
export type IconButtonSize = "small" | "medium";

export interface UiIconButtonProps {
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  type?: "button" | "submit" | "reset";
}
