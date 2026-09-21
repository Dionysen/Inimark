export interface UiDialogProps {
  modelValue?: boolean;
  title: string;
  description?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  size?: "small" | "medium" | "large";
}
