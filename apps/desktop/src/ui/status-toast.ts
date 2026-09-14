const TOAST_MS = 1600;

const INFO_ICON = `<svg class="inimark-status-toast__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`;

const hosts = new WeakMap<
  HTMLElement,
  { el: HTMLElement | null; timer: ReturnType<typeof setTimeout> | null }
>();

function stateFor(host: HTMLElement) {
  let state = hosts.get(host);
  if (!state) {
    state = { el: null, timer: null };
    hosts.set(host, state);
  }
  return state;
}

/** Brief centered toast in a relatively positioned host (editor main column). */
export function showStatusToast(host: HTMLElement, message: string): void {
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
  icon.innerHTML = INFO_ICON;

  const text = document.createElement("span");
  text.className = "inimark-status-toast__text";
  text.textContent = message;

  el.append(icon, text);
  host.append(el);
  state.el = el;

  state.timer = setTimeout(() => {
    state.timer = null;
    el.remove();
    if (state.el === el) state.el = null;
  }, TOAST_MS);
}
