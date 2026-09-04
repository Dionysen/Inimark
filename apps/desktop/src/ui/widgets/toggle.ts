export interface ToggleOptions {
  checked?: boolean;
  title?: string;
  onChange?: (checked: boolean) => void;
}

export interface ToggleController {
  el: HTMLButtonElement;
  setChecked(checked: boolean): void;
  isChecked(): boolean;
  destroy(): void;
}

export function createToggle(options: ToggleOptions = {}): ToggleController {
  let checked = options.checked ?? false;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "inimark-control inimark-toggle";
  el.setAttribute("role", "switch");
  if (options.title) el.title = options.title;

  const thumb = document.createElement("span");
  thumb.className = "inimark-toggle__thumb";
  el.append(thumb);

  function sync(): void {
    el.classList.toggle("is-on", checked);
    el.setAttribute("aria-checked", checked ? "true" : "false");
  }

  el.addEventListener("click", () => {
    checked = !checked;
    sync();
    options.onChange?.(checked);
  });

  sync();

  return {
    el,
    setChecked(next) {
      checked = next;
      sync();
    },
    isChecked() {
      return checked;
    },
    destroy() {
      el.remove();
    },
  };
}
