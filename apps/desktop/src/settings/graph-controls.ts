import { t } from "../i18n/index.ts";
import { createSlider, createToggle } from "../ui/widgets/index.ts";
import type { GraphSettings } from "./store.ts";

export interface GraphControlsController {
  el: HTMLElement;
  refresh(settings: GraphSettings): void;
  destroy(): void;
}

export interface GraphControlsOptions {
  /** Compact stacked rows for the editor floating panel. */
  compact?: boolean;
  settings: GraphSettings;
  onChange: (partial: Partial<GraphSettings>) => void;
  /** Obsidian-style timelapse replay (global graph float). */
  onPlayTimelapse?: () => void;
}

type Field =
  | {
      kind: "toggle";
      key: keyof GraphSettings;
      titleKey: string;
      descKey?: string;
    }
  | {
      kind: "slider";
      key: keyof GraphSettings;
      titleKey: string;
      descKey?: string;
      min: number;
      max: number;
      /** Display transform for the value label (stored value unchanged). */
      formatValue?: (value: number) => string;
    };

const APPEARANCE_FIELDS: Field[] = [
  {
    kind: "toggle",
    key: "showArrows",
    titleKey: "settings.graph.showArrows",
    descKey: "settings.graph.showArrowsDesc",
  },
  {
    kind: "slider",
    key: "textOpacity",
    titleKey: "settings.graph.textOpacity",
    descKey: "settings.graph.textOpacityDesc",
    min: 0,
    max: 100,
    formatValue: (value) => String(value - 50),
  },
  {
    kind: "slider",
    key: "nodeSize",
    titleKey: "settings.graph.nodeSize",
    descKey: "settings.graph.nodeSizeDesc",
    min: 0,
    max: 100,
  },
  {
    kind: "slider",
    key: "linkThickness",
    titleKey: "settings.graph.linkThickness",
    descKey: "settings.graph.linkThicknessDesc",
    min: 0,
    max: 100,
  },
  {
    kind: "toggle",
    key: "animate",
    titleKey: "settings.graph.animate",
    descKey: "settings.graph.animateDesc",
  },
];

const FORCE_FIELDS: Field[] = [
  {
    kind: "slider",
    key: "centerForce",
    titleKey: "settings.graph.centerForce",
    descKey: "settings.graph.centerForceDesc",
    min: 0,
    max: 100,
  },
  {
    kind: "slider",
    key: "repulsion",
    titleKey: "settings.graph.repulsion",
    descKey: "settings.graph.repulsionDesc",
    min: 0,
    max: 100,
  },
  {
    kind: "slider",
    key: "linkForce",
    titleKey: "settings.graph.linkForce",
    descKey: "settings.graph.linkForceDesc",
    min: 0,
    max: 100,
  },
  {
    kind: "slider",
    key: "linkDistance",
    titleKey: "settings.graph.linkDistance",
    descKey: "settings.graph.linkDistanceDesc",
    min: 0,
    max: 100,
  },
];

const COLLAPSED_KEY = "inimark-graph-controls-collapsed";

const CHEVRON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6"/></svg>`;

type GroupId = "appearance" | "forces";

function loadCollapsed(): Set<GroupId> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is GroupId => id === "appearance" || id === "forces"),
    );
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<GroupId>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function createRow(
  title: string,
  description: string | undefined,
  control: HTMLElement,
  compact: boolean,
  settingId?: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = compact
    ? "inimark-graph-float-row"
    : "inimark-settings-row";
  if (!compact && settingId) row.dataset.settingId = settingId;
  const meta = document.createElement("div");
  meta.className = compact
    ? "inimark-graph-float-row-meta"
    : "inimark-settings-row-meta";
  const h = document.createElement("div");
  h.className = compact
    ? "inimark-graph-float-row-title"
    : "inimark-settings-row-title";
  h.textContent = title;
  meta.append(h);
  if (!compact && description) {
    const p = document.createElement("p");
    p.className = "inimark-settings-row-desc";
    p.textContent = description;
    meta.append(p);
  }
  const ctrl = document.createElement("div");
  ctrl.className = compact
    ? "inimark-graph-float-row-control"
    : "inimark-settings-row-control";
  ctrl.append(control);
  row.append(meta, ctrl);
  return row;
}

/** Shared appearance + force controls for settings page and editor float. */
export function mountGraphControls(
  options: GraphControlsOptions,
): GraphControlsController {
  const compact = options.compact ?? false;
  let settings = { ...options.settings };
  const collapsed = loadCollapsed();

  const el = document.createElement("div");
  el.className = compact
    ? "inimark-graph-float-controls"
    : "inimark-graph-settings-controls";

  type Bound = {
    key: keyof GraphSettings;
    setValue: (value: boolean | number) => void;
  };
  const bounds: Bound[] = [];
  const groupTitles = new Map<GroupId, HTMLElement>();

  function appendGroup(
    id: GroupId,
    titleKey: string,
    fields: Field[],
  ): void {
    const section = document.createElement("section");
    section.className = compact
      ? "inimark-graph-float-group"
      : "inimark-graph-settings-group";
    section.dataset.groupId = id;

    const header = document.createElement("button");
    header.type = "button";
    header.className = compact
      ? "inimark-graph-float-group-header"
      : "inimark-graph-settings-group-header";

    const chevron = document.createElement("span");
    chevron.className = compact
      ? "inimark-graph-float-group-chevron"
      : "inimark-graph-settings-group-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = CHEVRON;

    const title = document.createElement("span");
    title.className = compact
      ? "inimark-graph-float-group-title"
      : "inimark-graph-settings-group-title";
    title.textContent = t(titleKey);
    groupTitles.set(id, title);

    header.append(chevron, title);

    const body = document.createElement("div");
    body.className = compact
      ? "inimark-graph-float-group-body"
      : "inimark-graph-settings-group-body";

    for (const field of fields) {
      if (field.kind === "toggle") {
        const toggle = createToggle({
          checked: Boolean(settings[field.key]),
          title: t(field.titleKey),
          onChange(checked) {
            options.onChange({ [field.key]: checked } as Partial<GraphSettings>);
          },
        });
        bounds.push({
          key: field.key,
          setValue(value) {
            toggle.setChecked(Boolean(value));
          },
        });
        body.append(
          createRow(
            t(field.titleKey),
            field.descKey ? t(field.descKey) : undefined,
            toggle.el,
            compact,
            `graph.${String(field.key)}`,
          ),
        );
        continue;
      }

      const slider = createSlider({
        min: field.min,
        max: field.max,
        step: 1,
        value: Number(settings[field.key]),
        formatValue: field.formatValue ?? ((value) => String(value)),
        showValue: !compact,
        onChange(value) {
          options.onChange({ [field.key]: value } as Partial<GraphSettings>);
        },
        onInput(value) {
          options.onChange({ [field.key]: value } as Partial<GraphSettings>);
        },
      });
      bounds.push({
        key: field.key,
        setValue(value) {
          slider.setValue(Number(value));
        },
      });
      body.append(
        createRow(
          t(field.titleKey),
          field.descKey ? t(field.descKey) : undefined,
          slider.el,
          compact,
          `graph.${String(field.key)}`,
        ),
      );
    }

    function applyCollapsed(isCollapsed: boolean): void {
      section.classList.toggle("is-collapsed", isCollapsed);
      chevron.classList.toggle("is-expanded", !isCollapsed);
      header.setAttribute("aria-expanded", String(!isCollapsed));
      body.hidden = isCollapsed;
    }

    applyCollapsed(collapsed.has(id));

    header.addEventListener("click", () => {
      const next = !section.classList.contains("is-collapsed");
      if (next) collapsed.add(id);
      else collapsed.delete(id);
      saveCollapsed(collapsed);
      applyCollapsed(next);
    });

    section.append(header, body);
    el.append(section);
  }

  appendGroup("appearance", "settings.group.graphAppearance", APPEARANCE_FIELDS);
  appendGroup("forces", "settings.group.graphForce", FORCE_FIELDS);

  let playBtn: HTMLButtonElement | null = null;
  if (options.onPlayTimelapse) {
    playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = compact
      ? "inimark-graph-float-timelapse-btn"
      : "inimark-btn inimark-graph-timelapse-btn";
    playBtn.textContent = t("settings.graph.playTimelapse");
    playBtn.title = t("settings.graph.playTimelapseDesc");
    playBtn.addEventListener("click", () => options.onPlayTimelapse?.());
    el.append(playBtn);
  }

  return {
    el,
    refresh(next) {
      settings = { ...next };
      for (const bound of bounds) {
        bound.setValue(settings[bound.key] as boolean | number);
      }
      groupTitles.get("appearance")!.textContent = t(
        "settings.group.graphAppearance",
      );
      groupTitles.get("forces")!.textContent = t("settings.group.graphForce");
      if (playBtn) {
        playBtn.textContent = t("settings.graph.playTimelapse");
        playBtn.title = t("settings.graph.playTimelapseDesc");
      }
    },
    destroy() {
      el.replaceChildren();
      el.remove();
    },
  };
}
