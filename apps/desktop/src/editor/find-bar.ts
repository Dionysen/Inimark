import type { Editor, FindOptions } from "@inimark/editor";
import { onLocaleChange, t } from "../i18n/index.ts";
import { isInMarkdownEditor } from "../shortcuts/guard.ts";

export interface FindBarController {
  open(prefillSelection?: boolean): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

function svg(paths: string, size = 16): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  prev: svg(`<polyline points="18 15 12 9 6 15"/>`),
  next: svg(`<polyline points="6 9 12 15 18 9"/>`),
  close: svg(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`),
  chevronDown: svg(`<polyline points="6 9 12 15 18 9"/>`, 14),
  chevronRight: svg(`<polyline points="9 18 15 12 9 6"/>`, 14),
};

function readOptions(
  findInput: HTMLInputElement,
  caseBtn: HTMLButtonElement,
  wordBtn: HTMLButtonElement,
  regexBtn: HTMLButtonElement,
): FindOptions {
  return {
    query: findInput.value,
    caseSensitive: caseBtn.classList.contains("is-active"),
    wholeWord: wordBtn.classList.contains("is-active"),
    regex: regexBtn.classList.contains("is-active"),
  };
}

function formatMatchLabel(index: number, total: number): string {
  if (total === 0) return t("editor.find.noResults");
  return t("editor.find.matchCount", { current: String(index + 1), total: String(total) });
}

function createOptionButton(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "inimark-find-bar__option";
  btn.textContent = label;
  btn.title = title;
  return btn;
}

/**
 * VSCode-style find/replace widget pinned to the editor pane top-right.
 * Styled with menu glass tokens; does not use exclusive-layer dismissal.
 */
export function mountFindBar(
  editorPane: HTMLElement,
  editor: Editor,
): FindBarController {
  const root = document.createElement("div");
  root.className = "inimark-find-bar inimark-glass";
  root.hidden = true;
  editorPane.append(root);

  let open = false;
  let replaceOpen = false;

  const toggleReplaceBtn = document.createElement("button");
  toggleReplaceBtn.type = "button";
  toggleReplaceBtn.className = "inimark-find-bar__toggle";
  toggleReplaceBtn.innerHTML = ICONS.chevronRight;
  toggleReplaceBtn.title = t("editor.find.toggleReplace");
  toggleReplaceBtn.setAttribute("aria-expanded", "false");

  const findField = document.createElement("label");
  findField.className = "inimark-control inimark-field inimark-find-bar__field";

  const findInput = document.createElement("input");
  findInput.type = "text";
  findInput.className = "inimark-field__input inimark-find-bar__input";
  findInput.placeholder = t("editor.find.placeholder");
  findInput.setAttribute("aria-label", t("editor.find.placeholder"));
  findInput.autocomplete = "off";
  findInput.spellcheck = false;

  const inlineOptions = document.createElement("div");
  inlineOptions.className = "inimark-find-bar__inline-options";

  const caseBtn = createOptionButton("Aa", t("editor.find.matchCase"));
  const wordBtn = createOptionButton("ab", t("editor.find.wholeWord"));
  const regexBtn = createOptionButton(".*", t("editor.find.useRegex"));
  inlineOptions.append(caseBtn, wordBtn, regexBtn);
  findField.append(findInput, inlineOptions);

  const findActions = document.createElement("div");
  findActions.className = "inimark-find-bar__actions";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "inimark-find-bar__icon-btn";
  prevBtn.innerHTML = ICONS.prev;
  prevBtn.title = t("editor.find.previous");
  prevBtn.setAttribute("aria-label", t("editor.find.previous"));

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "inimark-find-bar__icon-btn";
  nextBtn.innerHTML = ICONS.next;
  nextBtn.title = t("editor.find.next");
  nextBtn.setAttribute("aria-label", t("editor.find.next"));

  const countEl = document.createElement("span");
  countEl.className = "inimark-find-bar__count";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "inimark-find-bar__icon-btn";
  closeBtn.innerHTML = ICONS.close;
  closeBtn.title = t("editor.find.close");
  closeBtn.setAttribute("aria-label", t("editor.find.close"));

  findActions.append(prevBtn, nextBtn, countEl, closeBtn);

  const findRow = document.createElement("div");
  findRow.className = "inimark-find-bar__row";
  findRow.append(toggleReplaceBtn, findField, findActions);

  const replaceRow = document.createElement("div");
  replaceRow.className = "inimark-find-bar__row inimark-find-bar__row--replace";
  replaceRow.hidden = true;

  const replaceSpacer = document.createElement("span");
  replaceSpacer.className = "inimark-find-bar__toggle-spacer";
  replaceSpacer.setAttribute("aria-hidden", "true");

  const replaceField = document.createElement("label");
  replaceField.className = "inimark-control inimark-field inimark-find-bar__field";

  const replaceInput = document.createElement("input");
  replaceInput.type = "text";
  replaceInput.className = "inimark-field__input inimark-find-bar__input";
  replaceInput.placeholder = t("editor.find.replacePlaceholder");
  replaceInput.setAttribute("aria-label", t("editor.find.replacePlaceholder"));
  replaceInput.autocomplete = "off";
  replaceInput.spellcheck = false;
  replaceField.append(replaceInput);

  const replaceActions = document.createElement("div");
  replaceActions.className = "inimark-find-bar__actions";

  const replaceBtn = document.createElement("button");
  replaceBtn.type = "button";
  replaceBtn.className = "inimark-find-bar__text-btn";
  replaceBtn.textContent = t("editor.find.replace");

  const replaceAllBtn = document.createElement("button");
  replaceAllBtn.type = "button";
  replaceAllBtn.className = "inimark-find-bar__text-btn";
  replaceAllBtn.textContent = t("editor.find.replaceAll");

  replaceActions.append(replaceBtn, replaceAllBtn);
  replaceRow.append(replaceSpacer, replaceField, replaceActions);
  root.append(findRow, replaceRow);

  function setVisible(next: boolean): void {
    open = next;
    root.hidden = !next;
    root.classList.toggle("is-open", next);
  }

  function syncCount(): void {
    const session = editor.getFindSession();
    if (!session) {
      countEl.textContent = "";
      return;
    }
    countEl.textContent = formatMatchLabel(session.index, session.matches.length);
  }

  function refreshLabels(): void {
    toggleReplaceBtn.title = t("editor.find.toggleReplace");
    findInput.placeholder = t("editor.find.placeholder");
    findInput.setAttribute("aria-label", t("editor.find.placeholder"));
    caseBtn.title = t("editor.find.matchCase");
    wordBtn.title = t("editor.find.wholeWord");
    regexBtn.title = t("editor.find.useRegex");
    prevBtn.title = t("editor.find.previous");
    prevBtn.setAttribute("aria-label", t("editor.find.previous"));
    nextBtn.title = t("editor.find.next");
    nextBtn.setAttribute("aria-label", t("editor.find.next"));
    closeBtn.title = t("editor.find.close");
    closeBtn.setAttribute("aria-label", t("editor.find.close"));
    replaceInput.placeholder = t("editor.find.replacePlaceholder");
    replaceInput.setAttribute("aria-label", t("editor.find.replacePlaceholder"));
    replaceBtn.textContent = t("editor.find.replace");
    replaceAllBtn.textContent = t("editor.find.replaceAll");
    syncCount();
  }

  function runFind(): void {
    if (!open) return;
    const options = readOptions(findInput, caseBtn, wordBtn, regexBtn);
    editor.configureFind(options);
    syncCount();
  }

  function toggleOption(btn: HTMLButtonElement): void {
    btn.classList.toggle("is-active");
    runFind();
  }

  function setReplaceOpen(next: boolean): void {
    replaceOpen = next;
    replaceRow.hidden = !replaceOpen;
    toggleReplaceBtn.innerHTML = replaceOpen ? ICONS.chevronDown : ICONS.chevronRight;
    toggleReplaceBtn.setAttribute("aria-expanded", String(replaceOpen));
    if (replaceOpen) replaceInput.focus();
  }

  function closeBar(): void {
    setVisible(false);
    setReplaceOpen(false);
    editor.clearFind();
    countEl.textContent = "";
  }

  function openBar(prefillSelection = true): void {
    setVisible(true);
    if (prefillSelection && !findInput.value) {
      const selected = editor.getSelectedText().replace(/\n/g, " ").trim();
      if (selected && selected.length <= 200) findInput.value = selected;
    }
    runFind();
    findInput.focus();
    findInput.select();
  }

  toggleReplaceBtn.addEventListener("mousedown", (event) => event.preventDefault());
  toggleReplaceBtn.addEventListener("click", () => setReplaceOpen(!replaceOpen));

  prevBtn.addEventListener("mousedown", (event) => event.preventDefault());
  prevBtn.addEventListener("click", () => {
    editor.findPrevious();
    syncCount();
  });

  nextBtn.addEventListener("mousedown", (event) => event.preventDefault());
  nextBtn.addEventListener("click", () => {
    editor.findNext();
    syncCount();
  });

  closeBtn.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeBar();
    editor.focus();
  });

  replaceBtn.addEventListener("click", () => {
    editor.replaceCurrent(replaceInput.value);
    syncCount();
  });
  replaceAllBtn.addEventListener("click", () => {
    editor.replaceAll(replaceInput.value);
    syncCount();
  });

  findInput.addEventListener("input", () => runFind());
  caseBtn.addEventListener("mousedown", (event) => event.preventDefault());
  wordBtn.addEventListener("mousedown", (event) => event.preventDefault());
  regexBtn.addEventListener("mousedown", (event) => event.preventDefault());
  caseBtn.addEventListener("click", () => toggleOption(caseBtn));
  wordBtn.addEventListener("click", () => toggleOption(wordBtn));
  regexBtn.addEventListener("click", () => toggleOption(regexBtn));

  findInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) editor.findPrevious();
      else editor.findNext();
      syncCount();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeBar();
      editor.focus();
    }
  });

  replaceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) editor.replaceAll(replaceInput.value);
      else editor.replaceCurrent(replaceInput.value);
      syncCount();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeBar();
      editor.focus();
    }
  });

  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeBar();
      editor.focus();
    }
  };

  const onCtrlF = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() !== "f") return;
    if (!isInMarkdownEditor(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      findInput.focus();
      findInput.select();
    } else {
      openBar(true);
    }
  };

  const onCtrlH = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() !== "h") return;
    if (!isInMarkdownEditor(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!open) openBar(true);
    setReplaceOpen(true);
    replaceInput.focus();
  };

  window.addEventListener("keydown", onWindowKeyDown, true);
  window.addEventListener("keydown", onCtrlF, true);
  window.addEventListener("keydown", onCtrlH, true);

  const unsubscribeLocale = onLocaleChange(() => refreshLabels());

  return {
    open: openBar,
    close: closeBar,
    isOpen: () => open,
    destroy() {
      window.removeEventListener("keydown", onWindowKeyDown, true);
      window.removeEventListener("keydown", onCtrlF, true);
      window.removeEventListener("keydown", onCtrlH, true);
      unsubscribeLocale();
      closeBar();
      root.remove();
    },
  };
}
