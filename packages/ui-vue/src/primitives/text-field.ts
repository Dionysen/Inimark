export type TextFieldType = "text" | "password" | "search" | "email" | "url";

export interface UiTextFieldProps {
  modelValue?: string;
  label?: string;
  ariaLabel?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  type?: TextFieldType;
  disabled?: boolean;
  readonly?: boolean;
  autocomplete?: string;
  name?: string;
}
