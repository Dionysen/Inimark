import { t } from "../i18n/index.ts";
import { createSlider, createToggle, createButton, createSelect, type SelectController } from "../ui/widgets/index.ts";
import { linkIndex } from "../wikilink/index.ts";
import { tagIndex } from "../tags/index.ts";
import {
  paletteColorAt,
  type GraphColorGroup,
  type GraphSettings,
} from "./store.ts";
import type { GraphMatchMode, GraphSuggestCatalog } from "../graph/index.ts";
import {
  attachGraphQueryAutocomplete,
  type GraphQueryAutocompleteController,
} from "./graph-query-autocomplete.ts";

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

function newGroupId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Ids / enable / color / mode — value text alone does not count as a structural change. */
function colorGroupsStructureEqual(
  a: readonly GraphColorGroup[],
  b: readonly GraphColorGroup[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((group, index) => {
    const next = b[index];
    return (
      !!next &&
      group.id === next.id &&
      group.enabled === next.enabled &&
      group.color === next.color &&
      group.mode === next.mode
    );
  });
}

function matchModeOptions(): Array<{ value: GraphMatchMode; label: string }> {
  return [
    { value: "path", label: t("settings.graph.matchModePath") },
    { value: "file", label: t("settings.graph.matchModeFile") },
    { value: "tag", label: t("settings.graph.matchModeTag") },
    { value: "name", label: t("settings.graph.matchModeName") },
  ];
}

function valuePlaceholder(mode: GraphMatchMode): string {
  if (mode === "path") return t("settings.graph.matchValuePath");
  if (mode === "file") return t("settings.graph.matchValueFile");
  if (mode === "tag") return t("settings.graph.matchValueTag");
  return t("settings.graph.matchValueName");
}

function suggestCatalog(): GraphSuggestCatalog {
  return {
    tags: tagIndex.listTags("name-asc").map((entry) => entry.name),
    notes: linkIndex.getAllNotes(),
  };
}

type MountedGroup = {
  titleKey: string;
  titleEl: HTMLElement;
  section: HTMLElement;
};

/** Shared appearance + force controls for settings page and editor float. */
export function mountGraphControls(
  options: GraphControlsOptions,
): GraphControlsController {
  const compact = options.compact ?? false;
  let settings = {
    ...options.settings,
    colorGroups: [...(options.settings.colorGroups ?? [])],
  };

  const el = document.createElement("div");
  el.className = compact
    ? "inimark-graph-float-controls"
    : "inimark-graph-settings-controls";

  type Bound = {
    key: keyof GraphSettings;
    setValue: (value: boolean | number) => void;
  };
  const bounds: Bound[] = [];
  const mountedGroups: MountedGroup[] = [];
  const queryAutocompletes: GraphQueryAutocompleteController[] = [];
  const modeSelects: SelectController[] = [];

  // Float panel only: keep color groups open; collapse appearance/forces to save height.
  const openState = new Map<string, boolean>([
    ["appearance", false],
    ["forces", false],
    ["colors", true],
  ]);

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

  /**
   * Float panel: collapsible sections with chevrons.
   * Settings page: plain section titles (same as other settings groups).
   */
  function mountGroup(
    id: string,
    titleKey: string,
    fillBody: (body: HTMLElement) => void,
  ): MountedGroup {
    if (!compact) {
      const title = document.createElement("h3");
      title.className = "inimark-settings-section-title";
      title.textContent = t(titleKey);
      el.append(title);
      fillBody(el);
      const group: MountedGroup = { titleKey, titleEl: title, section: el };
      mountedGroups.push(group);
      return group;
    }

    const section = document.createElement("section");
    section.className = "inimark-graph-float-group";
    section.dataset.groupId = id;

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "inimark-graph-float-group-title inimark-graph-group-toggle";

    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevron.setAttribute("class", "inimark-graph-group-chevron");
    chevron.setAttribute("viewBox", "0 0 24 24");
    chevron.setAttribute("aria-hidden", "true");
    const chevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chevronPath.setAttribute("fill", "none");
    chevronPath.setAttribute("stroke", "currentColor");
    chevronPath.setAttribute("stroke-width", "2.25");
    chevronPath.setAttribute("stroke-linecap", "round");
    chevronPath.setAttribute("stroke-linejoin", "round");
    chevronPath.setAttribute("d", "M9 6l6 6-6 6");
    chevron.append(chevronPath);

    const label = document.createElement("span");
    label.className = "inimark-graph-group-toggle-label";
    label.textContent = t(titleKey);
    titleBtn.append(chevron, label);

    const body = document.createElement("div");
    body.className = "inimark-graph-float-group-body";
    fillBody(body);

    function setOpen(open: boolean): void {
      openState.set(id, open);
      section.classList.toggle("is-collapsed", !open);
      titleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      body.hidden = !open;
    }

    titleBtn.addEventListener("click", () => {
      setOpen(!(openState.get(id) ?? true));
    });

    section.append(titleBtn, body);
    el.append(section);
    setOpen(openState.get(id) ?? true);

    const group: MountedGroup = { titleKey, titleEl: label, section };
    mountedGroups.push(group);
    return group;
  }

  mountGroup("appearance", "settings.group.graphAppearance", (body) => {
    appendFieldRows(body, APPEARANCE_FIELDS);
  });
  mountGroup("forces", "settings.group.graphForce", (body) => {
    appendFieldRows(body, FORCE_FIELDS);
  });

  const colorDesc = document.createElement("p");
  colorDesc.className = compact
    ? "inimark-graph-color-groups-hint"
    : "inimark-settings-row-desc";
  colorDesc.textContent = t("settings.graph.colorGroupsDesc");

  const colorList = document.createElement("div");
  colorList.className = "inimark-graph-color-group-list";

  const addBtn = createButton({
    label: t("settings.graph.addColorGroup"),
    variant: "ghost",
    onClick() {
      const next: GraphColorGroup[] = [
        ...settings.colorGroups,
        {
          id: newGroupId(),
          mode: "tag",
          value: "",
          color: paletteColorAt(settings.colorGroups.length),
          enabled: true,
        },
      ];
      emitColorGroups(next);
    },
  });
  addBtn.classList.add("inimark-graph-color-group-add");

  function clearQueryAutocompletes(): void {
    for (const ac of queryAutocompletes) ac.destroy();
    queryAutocompletes.length = 0;
    for (const select of modeSelects) select.destroy();
    modeSelects.length = 0;
  }

  function emitColorGroups(next: GraphColorGroup[], rerender = true): void {
    settings = { ...settings, colorGroups: next };
    options.onChange({ colorGroups: next });
    if (rerender) renderColorGroups();
  }

  function moveGroup(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= settings.colorGroups.length) return;
    const next = [...settings.colorGroups];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    emitColorGroups(next);
  }

  function renderColorGroups(): void {
    clearQueryAutocompletes();
    colorList.replaceChildren();
    settings.colorGroups.forEach((group, index) => {
      const row = document.createElement("div");
      row.className = "inimark-graph-color-group-row";

      const toggle = createToggle({
        checked: group.enabled,
        title: t("settings.graph.colorGroupEnabled"),
        onChange(checked) {
          const next = settings.colorGroups.map((g, i) =>
            i === index ? { ...g, enabled: checked } : g,
          );
          emitColorGroups(next);
        },
      });

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "inimark-graph-color-group-swatch";
      colorInput.value = /^#[0-9a-fA-F]{6}$/.test(group.color)
        ? group.color
        : paletteColorAt(index);
      colorInput.title = t("settings.graph.colorGroupColor");
      colorInput.addEventListener("change", () => {
        const next = settings.colorGroups.map((g, i) =>
          i === index ? { ...g, color: colorInput.value } : g,
        );
        emitColorGroups(next, false);
      });

      const modeSelect = createSelect({
        value: group.mode,
        options: matchModeOptions(),
        matchTriggerWidth: true,
        title: t("settings.graph.matchMode"),
        onChange(value) {
          const mode = value as GraphMatchMode;
          const next = settings.colorGroups.map((g, i) =>
            i === index ? { ...g, mode } : g,
          );
          emitColorGroups(next);
        },
      });
      modeSelect.el.classList.add("inimark-graph-color-group-mode");
      modeSelects.push(modeSelect);

      const queryInput = document.createElement("input");
      queryInput.type = "text";
      queryInput.className = "inimark-graph-color-group-query";
      queryInput.value = group.value;
      queryInput.placeholder = valuePlaceholder(group.mode);
      queryInput.spellcheck = false;
      queryInput.autocomplete = "off";

      const ac = attachGraphQueryAutocomplete({
        input: queryInput,
        getMode: () => settings.colorGroups[index]?.mode ?? group.mode,
        getCatalog: suggestCatalog,
        onValueCommit(value) {
          const next = settings.colorGroups.map((g, i) =>
            i === index ? { ...g, value } : g,
          );
          emitColorGroups(next, false);
        },
      });
      queryAutocompletes.push(ac);

      const actions = document.createElement("div");
      actions.className = "inimark-graph-color-group-actions";

      const upBtn = createButton({
        label: "↑",
        variant: "ghost",
        onClick() {
          moveGroup(index, -1);
        },
      });
      upBtn.title = t("settings.graph.colorGroupMoveUp");
      upBtn.disabled = index === 0;

      const downBtn = createButton({
        label: "↓",
        variant: "ghost",
        onClick() {
          moveGroup(index, 1);
        },
      });
      downBtn.title = t("settings.graph.colorGroupMoveDown");
      downBtn.disabled = index === settings.colorGroups.length - 1;

      const removeBtn = createButton({
        label: "×",
        variant: "ghost",
        onClick() {
          emitColorGroups(settings.colorGroups.filter((_, i) => i !== index));
        },
      });
      removeBtn.title = t("settings.graph.colorGroupRemove");

      actions.append(upBtn, downBtn, removeBtn);

      const toolbar = document.createElement("div");
      toolbar.className = "inimark-graph-color-group-toolbar";
      toolbar.append(toggle.el, colorInput, actions);
      const matchRow = document.createElement("div");
      matchRow.className = "inimark-graph-color-group-match";
      matchRow.append(modeSelect.el, queryInput);
      row.append(toolbar, matchRow);
      colorList.append(row);
    });
  }

  mountGroup("colors", "settings.group.graphColors", (body) => {
    if (!compact) colorList.dataset.settingId = "graph.colorGroups";
    body.append(colorDesc, colorList, addBtn);
  });

  renderColorGroups();

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
      const prevGroups = settings.colorGroups;
      settings = {
        ...next,
        colorGroups: [...(next.colorGroups ?? [])],
      };
      for (const bound of bounds) {
        bound.setValue(settings[bound.key] as boolean | number);
      }
      for (const group of mountedGroups) {
        group.titleEl.textContent = t(group.titleKey);
      }
      colorDesc.textContent = t("settings.graph.colorGroupsDesc");
      addBtn.textContent = t("settings.graph.addColorGroup");
      const editing =
        colorList.contains(document.activeElement) &&
        colorGroupsStructureEqual(prevGroups, settings.colorGroups);
      if (!editing) renderColorGroups();
      if (playBtn) {
        playBtn.textContent = t("settings.graph.playTimelapse");
        playBtn.title = t("settings.graph.playTimelapseDesc");
      }
    },
    destroy() {
      clearQueryAutocompletes();
      el.replaceChildren();
      el.remove();
    },
  };
}
