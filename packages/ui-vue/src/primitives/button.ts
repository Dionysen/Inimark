export type ButtonVariant = "default" | "ghost" | "primary" | "danger";
export type ButtonSize = "small" | "medium";

export interface UiButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}
