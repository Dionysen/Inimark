export interface CollapsibleGroupOptions {
  id: string;
  title: string;
  /** When no stored preference exists, expand by default. */
  defaultExpanded?: boolean;
  /** localStorage key for collapsed-state map. */
  storageKey?: string;
}

export interface CollapsibleGroup {
  el: HTMLElement;
  body: HTMLElement;
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
}

const DEFAULT_COLLAPSED_KEY = "dionysen:settings-collapsed";

const CHEVRON = `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function loadCollapsedMap(storageKey: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function readCollapsed(
  storageKey: string,
  id: string,
  defaultExpanded: boolean,
): boolean {
  const map = loadCollapsedMap(storageKey);
  if (Object.prototype.hasOwnProperty.call(map, id)) return map[id]!;
  return !defaultExpanded;
}

function writeCollapsed(storageKey: string, id: string, collapsed: boolean): void {
  const map = loadCollapsedMap(storageKey);
  map[id] = collapsed;
  localStorage.setItem(storageKey, JSON.stringify(map));
}

/** Collapsible subsection used inside a settings panel body. */
export function createCollapsibleGroup(
  options: CollapsibleGroupOptions,
): CollapsibleGroup {
  const storageKey = options.storageKey ?? DEFAULT_COLLAPSED_KEY;
  const defaultExpanded = options.defaultExpanded !== false;
  let collapsed = readCollapsed(storageKey, options.id, defaultExpanded);

  const el = document.createElement("section");
  el.className = "inimark-settings-collapse-group";
  el.dataset.groupId = options.id;

  const header = document.createElement("button");
  header.type = "button";
  header.className = "inimark-settings-collapse-header";
  header.setAttribute("aria-expanded", String(!collapsed));

  const chevron = document.createElement("span");
  chevron.className = `inimark-settings-collapse-chevron${collapsed ? "" : " is-expanded"}`;
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = CHEVRON;

  const title = document.createElement("span");
  title.className = "inimark-settings-collapse-title";
  title.textContent = options.title;

  header.append(chevron, title);

  const body = document.createElement("div");
  body.className = "inimark-settings-collapse-body";
  body.hidden = collapsed;

  header.addEventListener("click", () => {
    setCollapsed(!collapsed);
  });

  el.append(header, body);

  function setCollapsed(next: boolean): void {
    collapsed = next;
    body.hidden = collapsed;
    header.setAttribute("aria-expanded", String(!collapsed));
    chevron.classList.toggle("is-expanded", !collapsed);
    writeCollapsed(storageKey, options.id, collapsed);
  }

  return {
    el,
    body,
    setCollapsed,
    isCollapsed: () => collapsed,
  };
}
