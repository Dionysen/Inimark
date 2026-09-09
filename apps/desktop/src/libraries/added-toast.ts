import { t } from "../i18n/index.ts";

const TOAST_MS = 1500;

const SUCCESS_ICON = `<svg class="inimark-status-toast__icon inimark-status-toast__icon--success" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m8 12.5 2.5 2.5L16 9"/></svg>`;

const hosts = new WeakMap<HTMLElement, { el: HTMLElement | null; timer: ReturnType<typeof setTimeout> | null }>();

function stateFor(host: HTMLElement) {
  let state = hosts.get(host);
  if (!state) {
    state = { el: null, timer: null };
    hosts.set(host, state);
  }
  return state;
}

/** Brief top toast when a new library is added (same placement as font zoom). */
export function showLibraryAddedToast(host: HTMLElement, name: string): void {
  const state = stateFor(host);
  if (state.timer != null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.el?.remove();

  const el = document.createElement("div");
  el.className = "inimark-status-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  const icon = document.createElement("span");
  icon.className = "inimark-status-toast__icon-wrap";
  icon.innerHTML = SUCCESS_ICON;

  const text = document.createElement("span");
  text.className = "inimark-status-toast__text";
  text.textContent = t("settings.libraries.added", { name });

  el.append(icon, text);
  host.append(el);
  state.el = el;

  state.timer = setTimeout(() => {
    state.timer = null;
    el.remove();
    if (state.el === el) state.el = null;
  }, TOAST_MS);
}
