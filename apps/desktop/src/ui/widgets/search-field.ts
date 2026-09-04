const SEARCH_ICON = `<svg class="inimark-search__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
const CLEAR_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export interface SearchFieldOptions {
  value?: string;
  placeholder?: string;
  onInput?: (value: string) => void;
}

export interface SearchFieldController {
  el: HTMLDivElement;
  input: HTMLInputElement;
  setValue(value: string): void;
  getValue(): string;
  focus(): void;
  destroy(): void;
}

export function createSearchField(options: SearchFieldOptions = {}): SearchFieldController {
  const root = document.createElement("div");
  root.className = "inimark-search";

  const field = document.createElement("label");
  field.className = "inimark-control inimark-field";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "inimark-field__input";
  input.placeholder = options.placeholder ?? "Search…";
  input.setAttribute("aria-label", options.placeholder ?? "Search");
  input.autocomplete = "off";
  input.spellcheck = false;
  if (options.value) input.value = options.value;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "inimark-search__clear";
  clearBtn.title = "Clear search";
  clearBtn.innerHTML = CLEAR_ICON;
  clearBtn.hidden = !input.value;

  function syncClear(): void {
    clearBtn.hidden = input.value.trim().length === 0;
  }

  input.addEventListener("input", () => {
    syncClear();
    options.onInput?.(input.value);
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    syncClear();
    options.onInput?.("");
    input.focus();
  });

  field.append(input);
  root.insertAdjacentHTML("afterbegin", SEARCH_ICON);
  root.append(field, clearBtn);

  return {
    el: root,
    input,
    setValue(value) {
      input.value = value;
      syncClear();
    },
    getValue() {
      return input.value;
    },
    focus() {
      input.focus();
    },
    destroy() {
      root.remove();
    },
  };
}
