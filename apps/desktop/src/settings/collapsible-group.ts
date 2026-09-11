const DEV_SETTINGS_COLLAPSED_KEY = "inimark:dev-settings-collapsed";

const CHEVRON = `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export interface CollapsibleSettingsGroupOptions {
  id: string;
  title: string;
  /** When no stored preference exists, expand by default. */
  defaultExpanded?: boolean;
}

export interface CollapsibleSettingsGroup {
  el: HTMLElement;
  body: HTMLElement;
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
}

function loadCollapsedMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DEV_SETTINGS_COLLAPSED_KEY);
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

function readCollapsed(id: string, defaultExpanded: boolean): boolean {
  const map = loadCollapsedMap();
  if (Object.prototype.hasOwnProperty.call(map, id)) return map[id]!;
  return !defaultExpanded;
}

function writeCollapsed(id: string, collapsed: boolean): void {
  const map = loadCollapsedMap();
  map[id] = collapsed;
  localStorage.setItem(DEV_SETTINGS_COLLAPSED_KEY, JSON.stringify(map));
}

/** Collapsible section used inside the Dev settings panel. */
export function createCollapsibleSettingsGroup(
  options: CollapsibleSettingsGroupOptions,
): CollapsibleSettingsGroup {
  const defaultExpanded = options.defaultExpanded !== false;
  let collapsed = readCollapsed(options.id, defaultExpanded);

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
    writeCollapsed(options.id, collapsed);
  }

  return {
    el,
    body,
    setCollapsed,
    isCollapsed: () => collapsed,
  };
}
