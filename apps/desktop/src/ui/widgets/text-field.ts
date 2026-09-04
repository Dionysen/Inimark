export interface TextFieldOptions {
  value?: string;
  placeholder?: string;
  title?: string;
  mono?: boolean;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
}

export interface TextFieldController {
  el: HTMLLabelElement;
  input: HTMLInputElement;
  setValue(value: string): void;
  getValue(): string;
  focus(): void;
  destroy(): void;
}

export function createTextField(options: TextFieldOptions = {}): TextFieldController {
  const wrap = document.createElement("label");
  wrap.className = "inimark-control inimark-field";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inimark-field__input";
  if (options.mono) input.style.fontFamily = "var(--inimark-font-mono)";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.title) input.title = options.title;
  if (options.value != null) input.value = options.value;

  input.addEventListener("input", () => options.onInput?.(input.value));
  input.addEventListener("change", () => options.onChange?.(input.value));

  wrap.append(input);

  return {
    el: wrap,
    input,
    setValue(value) {
      input.value = value;
    },
    getValue() {
      return input.value;
    },
    focus() {
      input.focus();
    },
    destroy() {
      wrap.remove();
    },
  };
}
