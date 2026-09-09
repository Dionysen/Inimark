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

  const el = document.createElement("div");
  el.className = compact
    ? "inimark-graph-float-controls"
    : "inimark-graph-settings-controls";

  type Bound = {
    key: keyof GraphSettings;
    setValue: (value: boolean | number) => void;
  };
  const bounds: Bound[] = [];
  const groupTitles: HTMLElement[] = [];

  function appendFieldRows(parent: HTMLElement, fields: Field[]): void {
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
        parent.append(
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
      parent.append(
        createRow(
          t(field.titleKey),
          field.descKey ? t(field.descKey) : undefined,
          slider.el,
          compact,
          `graph.${String(field.key)}`,
        ),
      );
    }
  }

  function appendGroup(titleKey: string, fields: Field[]): void {
    if (compact) {
      const section = document.createElement("section");
      section.className = "inimark-graph-float-group";

      const title = document.createElement("div");
      title.className = "inimark-graph-float-group-title";
      title.textContent = t(titleKey);
      groupTitles.push(title);

      const body = document.createElement("div");
      body.className = "inimark-graph-float-group-body";
      appendFieldRows(body, fields);

      section.append(title, body);
      el.append(section);
      return;
    }

    const title = document.createElement("h3");
    title.className = "inimark-settings-section-title";
    title.textContent = t(titleKey);
    groupTitles.push(title);
    el.append(title);
    appendFieldRows(el, fields);
  }

  appendGroup("settings.group.graphAppearance", APPEARANCE_FIELDS);
  appendGroup("settings.group.graphForce", FORCE_FIELDS);

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

  const groupTitleKeys = [
    "settings.group.graphAppearance",
    "settings.group.graphForce",
  ];

  return {
    el,
    refresh(next) {
      settings = { ...next };
      for (const bound of bounds) {
        bound.setValue(settings[bound.key] as boolean | number);
      }
      groupTitleKeys.forEach((key, index) => {
        groupTitles[index]!.textContent = t(key);
      });
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
