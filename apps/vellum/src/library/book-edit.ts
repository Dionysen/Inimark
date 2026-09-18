export interface BookEditDraft {
  name: string;
  /** Empty when the book has no tag. */
  tags: string;
}

export interface BookEditPrompt {
  title: string;
  nameLabel: string;
  tagsLabel: string;
  tagsPlaceholder: string;
  name: string;
  tags: string;
  saveLabel: string;
  cancelLabel: string;
  nameRequired: string;
}

/** Tag shown in the book list. Blank when the field is missing or only whitespace. */
export function bookTagText(tags: string | null | undefined): string {
  return tags?.trim() ?? "";
}

let active: HTMLElement | null = null;

/**
 * Edit a book's name and optional tag.
 * Resolves `null` when cancelled. An empty name stays open and shows `nameRequired`.
 */
export function promptBookEdit(options: BookEditPrompt): Promise<BookEditDraft | null> {
  if (active) return Promise.resolve(null);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "inimark-confirm-dialog";
    const panel = document.createElement("form");
    panel.className = "inimark-confirm-dialog-panel vellum-book-edit";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "inimark-confirm-dialog-title";
    title.id = "vellum-book-edit-title";
    title.textContent = options.title;
    panel.setAttribute("aria-labelledby", title.id);

    const nameInput = labeledInput(options.nameLabel, options.name, "");
    nameInput.input.required = true;
    const tagsInput = labeledInput(options.tagsLabel, options.tags, options.tagsPlaceholder);

    const error = document.createElement("p");
    error.className = "vellum-book-edit-error";
    error.hidden = true;

    const actions = document.createElement("div");
    actions.className = "inimark-confirm-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "inimark-control inimark-btn inimark-confirm-dialog-btn";
    cancelBtn.textContent = options.cancelLabel;
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className =
      "inimark-control inimark-btn inimark-btn--primary inimark-confirm-dialog-btn";
    saveBtn.textContent = options.saveLabel;
    actions.append(cancelBtn, saveBtn);

    panel.append(title, nameInput.label, tagsInput.label, error, actions);
    overlay.append(panel);

    const finish = (draft: BookEditDraft | null) => {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      if (active === overlay) active = null;
      resolve(draft);
    };

    const submit = () => {
      const name = nameInput.input.value.trim();
      if (!name) {
        error.hidden = false;
        error.textContent = options.nameRequired;
        nameInput.input.focus();
        return;
      }
      finish({ name, tags: bookTagText(tagsInput.input.value) });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    };

    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });
    cancelBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });

    document.addEventListener("keydown", onKeyDown, true);
    document.body.append(overlay);
    active = overlay;
    nameInput.input.focus();
    nameInput.input.select();
  });
}

function labeledInput(caption: string, value: string, placeholder: string) {
  const label = document.createElement("label");
  label.className = "vellum-book-edit-label";
  label.append(caption);
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inimark-control inimark-field__input";
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  label.append(input);
  return { label, input };
}
