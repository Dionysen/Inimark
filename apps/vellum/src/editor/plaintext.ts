export interface PlaintextEditor {
  el: HTMLTextAreaElement;
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  destroy(): void;
}

export interface MountPlaintextOptions {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

/** Minimal textarea editor — no Markdown / @inimark/editor dependency. */
export function mountPlaintextEditor(
  host: HTMLElement,
  options: MountPlaintextOptions = {},
): PlaintextEditor {
  const el = document.createElement("textarea");
  el.className = "vellum-plaintext-editor inimark-scrollbar";
  el.spellcheck = true;
  el.placeholder = options.placeholder ?? "";
  el.value = options.value ?? "";

  const onInput = () => {
    options.onChange?.(el.value);
  };
  el.addEventListener("input", onInput);
  host.append(el);

  return {
    el,
    getValue: () => el.value,
    setValue: (value: string) => {
      el.value = value;
    },
    focus: () => el.focus(),
    destroy: () => {
      el.removeEventListener("input", onInput);
      el.remove();
    },
  };
}
