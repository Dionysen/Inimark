import { onLocaleChange, t } from "../i18n/index.ts";
import { linkIndex } from "../wikilink/index.ts";
import { fileNameFromPath } from "../platform/env.ts";
import {
  createIconButton,
  createPanelToolbar,
  graphLocalModeIcon,
  graphOpenEditorIcon,
  graphTimelapseIcon,
  graphFitViewIcon,
  graphOutlinkIcon,
  graphBacklinkIcon,
  graphVaultModeIcon,
  settingsIcon,
} from "../ui/widgets/index.ts";
import {
  DEFAULT_GRAPH_SETTINGS,
  graphSettingFactor,
  loadSettings,
  patchGraphSettings,
  subscribeGraphSettings,
  type GraphSettings,
} from "../settings/store.ts";
import { mountGraphControls } from "../settings/graph-controls.ts";

export type GraphMode = "local" | "vault";

function oppositeMode(mode: GraphMode): GraphMode {
  return mode === "local" ? "vault" : "local";
}

export interface GraphPanelController {
  el: HTMLElement;
  setActiveFile(path: string | null): void;
  setMode(mode: GraphMode): void;
  setEditorHost(host: HTMLElement | null): void;
  applyGraphSettings(settings?: GraphSettings): void;
  /** Obsidian-style timelapse: reveal nodes/links over time. */
  playProgression(): void;
  refresh(): void;
  onOpenFile(handler: (path: string) => void): void;
  destroy(): void;
}

export interface GraphPanelOptions {
  /** Sidebar panel (default) or editor overlay. */
  variant?: "sidebar" | "editor";
  initialMode?: GraphMode;
  activeFile?: string | null;
}

type GraphNode = {
  id: string;
  label: string;
  path: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
  center?: boolean;
};

type GraphEdge = { source: string; target: string };

/** Obsidian progression slots: file appear + each outlink in file order. */
type ProgressionSlot =
  | { kind: "node"; id: string }
  | { kind: "edge"; edge: GraphEdge };

function buildProgressionSlots(
  nodes: GraphNode[],
  edges: GraphEdge[],
): ProgressionSlot[] {
  const ids = [...nodes.map((n) => n.id)].sort((a, b) => a.localeCompare(b));
  const bySource = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const list = bySource.get(edge.source);
    if (list) list.push(edge);
    else bySource.set(edge.source, [edge]);
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => a.target.localeCompare(b.target));
  }
  const slots: ProgressionSlot[] = [];
  for (const id of ids) {
    slots.push({ kind: "node", id });
    for (const edge of bySource.get(id) ?? []) {
      slots.push({ kind: "edge", edge });
    }
  }
  return slots;
}

function noteLabel(pathOrName: string): string {
  const base = pathOrName.split(/[/\\]/).pop() || pathOrName;
  return base.replace(/\.(md|markdown|mdown|canvas)$/i, "");
}

/** Immediate parent folder name, or empty if the file is at vault root. */
function folderNameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2] ?? "";
}

function attachDegrees(nodes: GraphNode[], edges: GraphEdge[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) node.degree = 0;
  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (a) a.degree += 1;
    if (b) b.degree += 1;
  }
}

const GRAPH_SCALE_MIN = 0.12;
/** Max zoom — labels reach full settings opacity at this scale. */
const GRAPH_SCALE_MAX = 15;

/**
 * Obsidian graph camera lerp: `current * k + target * (1 - k)`.
 * Higher k = more inertia / slower catch-up.
 */
function camLerp(current: number, target: number, k = 0.9): number {
  return current * k + target * (1 - k);
}

/** Zoom ease toward targetScale (lower = snappier stop). */
const ZOOM_LERP_K = 0.72;
/** Pan fling velocity decay each frame (lower = stops sooner). */
const PAN_DECAY_K = 0.78;

/**
 * Label alpha from the text-fade slider (0–100, center 50 = “0”).
 * - ≤50: always fully opaque at any zoom
 * - >50: more transparent when zoomed out; zooming in returns to opaque
 */
function graphLabelAlpha(textOpacity: number, scale: number): number {
  const fade = Math.max(0, Math.min(1, (textOpacity - 50) / 50));
  if (fade < 0.001) return 1;

  const span = GRAPH_SCALE_MAX - GRAPH_SCALE_MIN;
  const normalized = Math.max(
    0,
    Math.min(1, (scale - GRAPH_SCALE_MIN) / span),
  );
  // Stronger fade → stays transparent longer until you zoom further in.
  const zoomFade = Math.pow(normalized, 0.55 + fade * 1.6);
  // fade=0 → 1; fade=1 → zoomFade (0 at min zoom, 1 at max zoom)
  return (1 - fade) + fade * zoomFade;
}

function buildLocalGraph(activePath: string | null): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  if (!activePath) return { nodes: [], edges: [] };
  const centerId = activePath.replace(/\\/g, "/");
  const centerName = linkIndex.toNoteName(centerId);
  const nodeMap = new Map<string, GraphNode>();

  const ensure = (path: string, center = false) => {
    const id = path.replace(/\\/g, "/");
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        path: id,
        label: noteLabel(id),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        degree: 0,
        center,
      });
    } else if (center) {
      nodeMap.get(id)!.center = true;
    }
  };

  ensure(centerId, true);
  const edges: GraphEdge[] = [];

  for (const target of linkIndex.getOutlinks(centerId)) {
    const path = linkIndex.findFileByNoteName(target);
    if (!path) continue;
    ensure(path);
    edges.push({ source: centerId, target: path.replace(/\\/g, "/") });
  }

  for (const source of linkIndex.getBacklinks(centerName)) {
    ensure(source);
    edges.push({ source: source.replace(/\\/g, "/"), target: centerId });
  }

  const nodes = [...nodeMap.values()];
  attachDegrees(nodes, edges);
  return { nodes, edges };
}

function buildVaultGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const notes = linkIndex.getAllNotes();
  const nodeMap = new Map<string, GraphNode>();
  for (const note of notes) {
    const id = note.path.replace(/\\/g, "/");
    nodeMap.set(id, {
      id,
      path: id,
      label: noteLabel(note.name),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      degree: 0,
    });
  }
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    const source = note.path.replace(/\\/g, "/");
    for (const targetName of linkIndex.getOutlinks(source)) {
      const target = linkIndex.findFileByNoteName(targetName);
      if (!target) continue;
      const tid = target.replace(/\\/g, "/");
      if (!nodeMap.has(tid)) continue;
      const key = `${source}→${tid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source, target: tid });
    }
  }
  const nodes = [...nodeMap.values()];
  attachDegrees(nodes, edges);
  return { nodes, edges };
}

export function mountGraphPanel(
  host: HTMLElement,
  options: GraphPanelOptions = {},
): GraphPanelController {
  const variant = options.variant ?? "sidebar";
  host.classList.add("inimark-sidebar-panel", "inimark-graph-panel");
  if (variant === "editor") host.classList.add("inimark-graph-panel--editor");
  host.replaceChildren();

  let activePath: string | null = options.activeFile
    ? options.activeFile.replace(/\\/g, "/")
    : null;
  let mode: GraphMode = options.initialMode ?? "local";
  let openHandler: (path: string) => void = () => { };
  let editorHost: HTMLElement | null = null;
  let editorOverlay: HTMLElement | null = null;
  let editorGraph: GraphPanelController | null = null;
  let raf = 0;
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let dragId: string | null = null;
  let hoverId: string | null = null;
  let adjacency = new Map<string, Set<string>>();
  let downX = 0;
  let downY = 0;
  let pointerMoved = false;
  let panning = false;
  let panLastX = 0;
  let panLastY = 0;

  // Camera: screen = world * scale + (panX, panY)
  // Obsidian model: wheel updates targetScale; each frame lerps scale → target
  // with pan velocity coasting after drag.
  let scale = 1;
  let targetScale = 1;
  let panX = 0;
  let panY = 0;
  let panvX = 0;
  let panvY = 0;
  let zoomAnchorX = 0;
  let zoomAnchorY = 0;
  /** When false, zoom lerps toward viewport center (Obsidian zoom-out). */
  let zoomUseCursor = false;
  let panVelDx = 0;
  let panVelDy = 0;
  let panVelDt = 16;
  let panGestureT = 0;
  let alpha = 1; // cooling for force sim
  let graphSettings: GraphSettings = { ...loadSettings().graph };
  let syncFloatChrome: (() => void) | null = null;
  /** Coalesce camera/UI updates into one paint per animation frame. */
  let dirty = true;
  /** Obsidian timelapse: 0 = off; >0 = reveal first N progression slots. */
  let progression = 0;
  let progressionGen = 0;
  let progressionSlots: ProgressionSlot[] = [];
  let progressionFullNodes: GraphNode[] = [];
  let playTimelapseBtn: HTMLButtonElement | null = null;
  let fitViewBtn: HTMLButtonElement | null = null;

  function scheduleDraw(): void {
    dirty = true;
  }

  function setScaleImmediate(next: number): void {
    scale = next;
    targetScale = next;
  }

  function stopProgression(): void {
    progression = 0;
    progressionGen += 1;
    progressionSlots = [];
    progressionFullNodes = [];
  }

  function applyGraphSettingsLocal(next: GraphSettings): void {
    const wasAnimating = graphSettings.animate;
    graphSettings = { ...next };
    if (graphSettings.animate) {
      alpha = Math.max(alpha, wasAnimating ? 0.25 : 1);
    } else {
      // Cool toward rest; keep a bit of energy so layout can finish settling.
      alpha = Math.max(alpha, 0.15);
    }
    scheduleDraw();
  }

  const toolbar =
    variant === "sidebar"
      ? createPanelToolbar([
        {
          label: t("graph.toggleMode"),
          title: mode === "local" ? t("graph.modeLocal") : t("graph.modeVault"),
          icon: () =>
            mode === "local" ? graphLocalModeIcon() : graphVaultModeIcon(),
          onClick() {
            setModeInternal(mode === "local" ? "vault" : "local");
          },
        },
        {
          label: t("graph.openInEditor"),
          title: t("graph.openInEditor"),
          icon: graphOpenEditorIcon,
          onClick() {
            openEditorGraph();
          },
        },
      ])
      : null;
  const modeBtn = toolbar?.buttons[0] ?? null;

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "inimark-graph-canvas-wrap";
  const canvas = document.createElement("canvas");
  canvas.className = "inimark-graph-canvas";
  canvasWrap.append(canvas);

  const lists = document.createElement("div");
  lists.className = "inimark-graph-lists";

  const outSection = document.createElement("section");
  outSection.className = "inimark-graph-list-section";
  const outTitle = document.createElement("h3");
  outTitle.className = "inimark-graph-list-title";
  const outList = document.createElement("div");
  outList.className = "inimark-graph-list";
  outSection.append(outTitle, outList);

  const backSection = document.createElement("section");
  backSection.className = "inimark-graph-list-section";
  const backTitle = document.createElement("h3");
  backTitle.className = "inimark-graph-list-title";
  const backList = document.createElement("div");
  backList.className = "inimark-graph-list";
  backSection.append(backTitle, backList);

  lists.append(outSection, backSection);

  const body = document.createElement("div");
  body.className = "inimark-graph-body";

  const splitHandle = document.createElement("div");
  splitHandle.className = "inimark-graph-split-handle";
  splitHandle.setAttribute("role", "separator");
  splitHandle.setAttribute("aria-orientation", "horizontal");
  splitHandle.title = "Drag to resize";

  if (variant === "editor") {
    canvasWrap.style.flex = "1 1 auto";
    body.append(canvasWrap);
    host.append(body);

    const float = document.createElement("div");
    float.className = "inimark-graph-float";
    let floatControls: ReturnType<typeof mountGraphControls> | null = null;

    const floatToolbar = document.createElement("div");
    floatToolbar.className = "inimark-graph-float-toolbar";

    fitViewBtn = createIconButton({
      label: t("settings.graph.fitView"),
      title: t("settings.graph.fitViewDesc"),
      html: graphFitViewIcon(),
      onClick() {
        fitGraphToView();
      },
    });
    fitViewBtn.classList.add("inimark-graph-float-tool");

    playTimelapseBtn = createIconButton({
      label: t("settings.graph.playTimelapse"),
      title: t("settings.graph.playTimelapseDesc"),
      html: graphTimelapseIcon(),
      onClick() {
        playProgression();
      },
    });
    playTimelapseBtn.classList.add("inimark-graph-float-tool");

    const floatToggle = createIconButton({
      label: t("settings.graph.floatToggle"),
      title: t("settings.graph.floatToggle"),
      html: settingsIcon(),
      onClick() {
        float.classList.toggle("is-open");
        floatToggle.classList.toggle("is-active", float.classList.contains("is-open"));
      },
    });
    floatToggle.classList.add("inimark-graph-float-tool", "inimark-graph-float-toggle");

    // Left → right: fit, wand, settings
    floatToolbar.append(fitViewBtn, playTimelapseBtn, floatToggle);

    const floatPanel = document.createElement("div");
    floatPanel.className = "inimark-graph-float-panel";
    const floatHeader = document.createElement("div");
    floatHeader.className = "inimark-graph-float-header";
    const floatTitle = document.createElement("div");
    floatTitle.className = "inimark-graph-float-title";
    floatTitle.textContent = t("settings.graph.floatTitle");
    const resetDefaultsBtn = createIconButton({
      label: t("settings.graph.resetDefaults"),
      title: t("settings.graph.resetDefaults"),
      html: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 12a9 9 0 1 0 3-6.7"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 4v5h5"/></svg>`,
      onClick() {
        const next = patchGraphSettings({ ...DEFAULT_GRAPH_SETTINGS });
        applyGraphSettingsLocal(next);
        floatControls?.refresh(next);
      },
    });
    resetDefaultsBtn.classList.add("inimark-graph-float-reset");
    floatHeader.append(floatTitle, resetDefaultsBtn);
    const floatBody = document.createElement("div");
    floatBody.className = "inimark-graph-float-body";
    floatControls = mountGraphControls({
      compact: true,
      settings: graphSettings,
      onChange(partial) {
        const next = patchGraphSettings(partial);
        applyGraphSettingsLocal(next);
        floatControls?.refresh(next);
      },
      onPlayTimelapse() {
        playProgression();
      },
    });
    floatBody.append(floatControls.el);
    floatPanel.append(floatHeader, floatBody);
    float.append(floatToolbar, floatPanel);
    host.append(float);

    syncFloatChrome = () => {
      floatToggle.title = t("settings.graph.floatToggle");
      floatToggle.setAttribute("aria-label", t("settings.graph.floatToggle"));
      floatTitle.textContent = t("settings.graph.floatTitle");
      if (fitViewBtn) {
        fitViewBtn.title = t("settings.graph.fitViewDesc");
        fitViewBtn.setAttribute("aria-label", t("settings.graph.fitView"));
      }
      if (playTimelapseBtn) {
        playTimelapseBtn.title = t("settings.graph.playTimelapseDesc");
        playTimelapseBtn.setAttribute(
          "aria-label",
          t("settings.graph.playTimelapse"),
        );
      }
      resetDefaultsBtn.title = t("settings.graph.resetDefaults");
      resetDefaultsBtn.setAttribute("aria-label", t("settings.graph.resetDefaults"));
      floatControls?.refresh(graphSettings);
    };
  } else {
    body.append(canvasWrap, splitHandle, lists);
    host.append(toolbar!.el, body);
  }

  if (variant !== "editor") {
    const GRAPH_SPLIT_KEY = "inimark-graph-split";
    const SPLIT_MIN = 0.2;
    const SPLIT_MAX = 0.8;

    function loadSplitRatio(): number {
      try {
        const raw = localStorage.getItem(GRAPH_SPLIT_KEY);
        const n = raw == null ? NaN : Number(raw);
        if (Number.isFinite(n) && n >= SPLIT_MIN && n <= SPLIT_MAX) return n;
      } catch {
        /* ignore */
      }
      return 0.5;
    }

    let splitRatio = loadSplitRatio();

    function applySplit(): void {
      canvasWrap.style.flex = `${splitRatio} 1 0`;
      lists.style.flex = `${1 - splitRatio} 1 0`;
    }

    applySplit();

    {
      let resizing = false;
      let startY = 0;
      let startRatio = 0.5;

      splitHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resizing = true;
        startY = event.clientY;
        startRatio = splitRatio;
        splitHandle.classList.add("is-active");
        body.classList.add("is-splitting");
        splitHandle.setPointerCapture(event.pointerId);
      });

      splitHandle.addEventListener("pointermove", (event) => {
        if (!resizing) return;
        const rect = body.getBoundingClientRect();
        if (rect.height <= 0) return;
        const delta = (event.clientY - startY) / rect.height;
        splitRatio = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, startRatio + delta));
        applySplit();
        scheduleDraw();
      });

      const endSplit = () => {
        if (!resizing) return;
        resizing = false;
        splitHandle.classList.remove("is-active");
        body.classList.remove("is-splitting");
        try {
          localStorage.setItem(GRAPH_SPLIT_KEY, String(splitRatio));
        } catch {
          /* ignore */
        }
      };

      splitHandle.addEventListener("pointerup", endSplit);
      splitHandle.addEventListener("pointercancel", endSplit);
    }
  }

  function syncModeButton(): void {
    if (!modeBtn) return;
    const label = mode === "local" ? t("graph.modeLocal") : t("graph.modeVault");
    modeBtn.innerHTML =
      mode === "local" ? graphLocalModeIcon() : graphVaultModeIcon();
    modeBtn.title = `${t("graph.toggleMode")} (${label})`;
    modeBtn.setAttribute("aria-label", modeBtn.title);
    modeBtn.setAttribute("aria-pressed", String(mode === "vault"));
  }

  function syncOpenButton(): void {
    const openBtn = toolbar?.buttons[1] ?? null;
    if (!openBtn) return;
    const open = !!editorOverlay;
    openBtn.classList.toggle("is-active", open);
    openBtn.setAttribute("aria-pressed", String(open));
  }

  function setModeInternal(next: GraphMode, opts?: { quiet?: boolean }): void {
    if (mode === next) return;
    mode = next;
    syncModeButton();
    rebuild();
    if (opts?.quiet) return;
    editorGraph?.setMode(oppositeMode(mode));
  }

  function closeEditorGraph(): void {
    editorGraph?.destroy();
    editorGraph = null;
    editorOverlay?.remove();
    editorOverlay = null;
    syncOpenButton();
  }

  function openEditorGraph(): void {
    if (!editorHost) return;
    if (editorOverlay) {
      closeEditorGraph();
      return;
    }
    editorOverlay = document.createElement("div");
    editorOverlay.className = "inimark-graph-editor-overlay";
    editorHost.append(editorOverlay);
    editorGraph = mountGraphPanel(editorOverlay, {
      variant: "editor",
      initialMode: oppositeMode(mode),
      activeFile: activePath,
    });
    editorGraph.onOpenFile((path) => openHandler(path));
    syncOpenButton();
  }

  function refreshChrome(): void {
    syncModeButton();
    syncFloatChrome?.();
    if (variant !== "sidebar" || !toolbar) return;
    outTitle.textContent = t("graph.outlinks");
    backTitle.textContent = t("graph.backlinks");
    if (toolbar.buttons[1]) {
      toolbar.buttons[1].title = t("graph.openInEditor");
      toolbar.buttons[1].setAttribute("aria-label", t("graph.openInEditor"));
    }
  }

  function renderLinkList(
    container: HTMLElement,
    items: Array<{ path: string; label: string }>,
    kind: "out" | "back",
  ): void {
    container.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-graph-list-empty";
      empty.textContent = t("graph.emptyLinks");
      container.append(empty);
      return;
    }
    const iconHtml = kind === "out" ? graphOutlinkIcon() : graphBacklinkIcon();
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-graph-list-item";
      btn.title = item.path;

      const icon = document.createElement("span");
      icon.className = "inimark-graph-list-item-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = iconHtml;

      const name = document.createElement("span");
      name.className = "inimark-graph-list-item-name";
      name.textContent = item.label;

      const folder = document.createElement("span");
      folder.className = "inimark-graph-list-item-folder";
      folder.textContent = folderNameFromPath(item.path);

      btn.append(icon, name, folder);
      btn.addEventListener("click", () => openHandler(item.path));
      container.append(btn);
    }
  }

  function updateLists(): void {
    if (variant === "editor") return;
    if (!activePath) {
      renderLinkList(outList, [], "out");
      renderLinkList(backList, [], "back");
      return;
    }
    const outItems = linkIndex
      .getOutlinks(activePath)
      .map((name) => {
        const path = linkIndex.findFileByNoteName(name);
        return path
          ? { path, label: noteLabel(name) }
          : { path: "", label: `${noteLabel(name)} ✕` };
      })
      .filter((x) => x.path);
    const backItems = linkIndex.getBacklinks(linkIndex.toNoteName(activePath)).map(
      (path) => ({
        path,
        label: fileNameFromPath(path).replace(/\.(md|markdown|mdown)$/i, ""),
      }),
    );
    renderLinkList(outList, outItems, "out");
    renderLinkList(backList, backItems, "back");
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx * scale + panX, y: wy * scale + panY };
  }

  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - panX) / scale, y: (sy - panY) / scale };
  }

  function seedLayout(): void {
    const n = Math.max(nodes.length, 1);
    // Wider spiral so initial spacing matches longer Obsidian-like link distances.
    const radius = Math.max(120, 42 * Math.sqrt(n));
    nodes.forEach((node, i) => {
      if (node.center) {
        node.x = 0;
        node.y = 0;
      } else {
        const angle = i * 2.399963;
        const r = radius * Math.sqrt((i + 1) / n);
        node.x = Math.cos(angle) * r;
        node.y = Math.sin(angle) * r;
      }
      node.vx = 0;
      node.vy = 0;
    });
    alpha = 1;
  }

  function fitCamera(width: number, height: number, pad = 36): void {
    if (nodes.length === 0 || width <= 0 || height <= 0) {
      setScaleImmediate(1);
      panX = width / 2;
      panY = height / 2;
      panvX = panvY = 0;
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
    // Leave room for node discs + labels so nothing clips the edges.
    const margin = 18;
    const bw = Math.max(maxX - minX, 1) + margin * 2;
    const bh = Math.max(maxY - minY, 1) + margin * 2;
    const sx = (width - pad * 2) / bw;
    const sy = (height - pad * 2) / bh;
    setScaleImmediate(
      Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, Math.min(sx, sy))),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    panX = width / 2 - cx * scale;
    panY = height / 2 - cy * scale;
    panvX = panvY = 0;
  }

  /** Fit every visible node into the canvas (fills the view as tightly as possible). */
  function fitGraphToView(): void {
    const rect = canvasWrap.getBoundingClientRect();
    fitCamera(Math.max(rect.width, 1), Math.max(rect.height, 1), 28);
    scheduleDraw();
  }

  /**
   * Obsidian `updateZoom`: ease scale toward targetScale while keeping the
   * zoom anchor's world point fixed under the cursor/center.
   */
  function updateZoom(): boolean {
    targetScale = Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, targetScale));
    const cur = scale;
    const next = targetScale;
    const gap = (cur > next ? cur / next : next / cur) - 1;
    if (gap < 0.008) {
      if (gap > 0) {
        scale = next;
        return true;
      }
      return false;
    }

    const rect = canvasWrap.getBoundingClientRect();
    const zx = zoomUseCursor ? zoomAnchorX : rect.width / 2;
    const zy = zoomUseCursor ? zoomAnchorY : rect.height / 2;
    const wx = (zx - panX) / cur;
    const wy = (zy - panY) / cur;
    scale = camLerp(cur, next, ZOOM_LERP_K);
    panX = zx - wx * scale;
    panY = zy - wy * scale;
    return true;
  }

  /** Pan coast: apply velocity, then decay toward rest. */
  function applyPanInertia(): boolean {
    if (panning) return false;
    if (Math.abs(panvX) < 1e-4 && Math.abs(panvY) < 1e-4) {
      panvX = 0;
      panvY = 0;
      return false;
    }
    panX += (1000 / 60) * panvX;
    panY += (1000 / 60) * panvY;
    panvX = camLerp(panvX, 0, PAN_DECAY_K);
    panvY = camLerp(panvY, 0, PAN_DECAY_K);
    return true;
  }

  /**
   * Obsidian-like forces (same model as d3-force / Obsidian graph):
   * - many-body repulsion (Coulomb, no hard low-distance cap)
   * - link springs with degree bias
   * - collision to keep nodes from stacking
   * - mild center force (same for all nodes)
   */
  function stepForces(settling = false): void {
    if (nodes.length === 0) return;

    const alphaTarget =
      settling ? 0 : graphSettings.animate || progression > 0 ? 0.08 : 0;
    if (!settling && !graphSettings.animate && progression === 0 && alpha < 0.001) {
      return;
    }

    const n = nodes.length;
    const byId = new Map(nodes.map((node) => [node.id, node]));

    // Map 0–100 sliders into Obsidian-ish ranges.
    const centerStrength = (graphSettings.centerForce / 100) * 0.55;
    const charge = -(60 + graphSettings.repulsion * 7); // 75 → ~-585
    const linkStrength = (graphSettings.linkForce / 100) * 0.65; // 20 → 0.13
    const linkDistance = 70 + graphSettings.linkDistance * 3.4; // 70 → ~308
    const nodeSizeFactor = graphSettingFactor(graphSettings.nodeSize);
    const collideBase = 14 * nodeSizeFactor;
    const distanceMax = 520;
    const distanceMax2 = distanceMax * distanceMax;

    // Many-body repulsion (d3 forceManyBody style) — uncapped near field.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq >= distanceMax2) continue;
        if (distSq < 0.01) {
          dx = (Math.random() - 0.5) * 0.5;
          dy = (Math.random() - 0.5) * 0.5;
          distSq = dx * dx + dy * dy;
        }
        // strength * alpha / dist²  (charge is negative → repulsion)
        const w = (charge * alpha) / distSq;
        dx *= w;
        dy *= w;
        a.vx += dx;
        a.vy += dy;
        b.vx -= dx;
        b.vy -= dy;
      }
    }

    // Link springs with degree bias (d3 forceLink)
    if (linkStrength > 0.001) {
      for (const edge of edges) {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const degreeSum = Math.max(1, a.degree + b.degree);
        const bias = a.degree / degreeSum;
        const strength = linkStrength * alpha;
        const k = ((dist - linkDistance) / dist) * strength;
        dx *= k;
        dy *= k;
        a.vx += dx * (1 - bias);
        a.vy += dy * (1 - bias);
        b.vx -= dx * bias;
        b.vy -= dy * bias;
      }
    }

    // Collision — hard minimum separation (like d3 forceCollide)
    const maxDeg = Math.max(1, ...nodes.map((node) => node.degree));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const ra = collideBase * (0.7 + (a.degree / maxDeg) * 0.6);
        const rb = collideBase * (0.7 + (b.degree / maxDeg) * 0.6);
        const minDist = ra + rb;
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          dx = (Math.random() - 0.5) * 0.2;
          dy = (Math.random() - 0.5) * 0.2;
          dist = Math.hypot(dx, dy) || 1e-6;
        }
        const push = ((minDist - dist) / dist) * 0.5 * alpha;
        dx *= push;
        dy *= push;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }

    // Center force — same strength for every node (Obsidian centripetal)
    for (const node of nodes) {
      if (dragId === node.id) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx += -node.x * centerStrength * alpha;
      node.vy += -node.y * centerStrength * alpha;
      // d3 velocityDecay default 0.6
      node.vx *= 0.6;
      node.vy *= 0.6;
      node.x += node.vx;
      node.y += node.vy;
    }

    // d3-style alpha cooling toward target
    alpha += (alphaTarget - alpha) * (settling ? 0.05 : 0.0228);
  }

  function rebuildAdjacency(): void {
    adjacency = new Map();
    for (const node of nodes) adjacency.set(node.id, new Set());
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }
  }

  function hoverFocus(): Set<string> | null {
    if (!hoverId) return null;
    const focus = new Set<string>([hoverId]);
    const neighbors = adjacency.get(hoverId);
    if (neighbors) {
      for (const id of neighbors) focus.add(id);
    }
    return focus;
  }

  function nodeRadius(node: GraphNode, maxDeg: number, scaleClamp: number, nodeScale: number): number {
    const degreeBoost = 5 + (node.degree / maxDeg) * 9;
    return degreeBoost * scaleClamp * nodeScale;
  }

  /**
   * Map drawn node radius → label px with a compressed band.
   * Radius still drives size, but labels stay ~9–15px instead of tracking 1:1.
   */
  function labelFontSize(drawR: number): number {
    const rLo = 4;
    const rHi = 36;
    const fLo = 9;
    const fHi = 25;
    const t = Math.max(0, Math.min(1, (drawR - rLo) / (rHi - rLo)));
    return fLo + t * (fHi - fLo);
  }

  /** How much zoom enlarges drawn node radius (capped so extreme zoom stays readable). */
  function nodeScaleClamp(): number {
    return Math.min(3.2, Math.max(0.65, scale));
  }

  function draw(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const bw = Math.floor(width * dpr);
    const bh = Math.floor(height * dpr);
    // Reassigning canvas.width/height reallocates the buffer every time — only
    // when the CSS size or DPR actually changes (was a major zoom stutter source).
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(host);
    const nodeColor =
      styles.getPropertyValue("--inimark-graph-node").trim() || "#b4b4b4";
    const nodeActive =
      styles.getPropertyValue("--inimark-graph-node-active").trim() || "#d0d0d0";
    const labelColor =
      styles.getPropertyValue("--inimark-graph-label").trim() || "#dcdcdc";
    const linkColor =
      styles.getPropertyValue("--inimark-graph-link").trim() || "#3c3c3c";
    const accent =
      styles.getPropertyValue("--inimark-graph-highlight").trim() ||
      styles.getPropertyValue("--inimark-accent").trim() ||
      "#64748b";
    // Canvas `font` cannot use CSS `var()` — invalid strings are ignored and
    // the context keeps the default 10px, so labels never scaled with radius.
    const uiFont =
      styles.getPropertyValue("--font-ui").trim() ||
      styles.fontFamily ||
      "system-ui, sans-serif";
    const nodeScale = graphSettingFactor(graphSettings.nodeSize);
    const linkScale = graphSettingFactor(graphSettings.linkThickness);
    const textAlpha = graphLabelAlpha(graphSettings.textOpacity, scale);
    const focus = hoverFocus();
    const dimming = focus != null;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const baseLine = Math.max(0.75, 1.25 * linkScale);

    const drawEdge = (
      edge: GraphEdge,
      color: string,
      alpha: number,
      widthMul: number,
    ) => {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) return;
      const sa = worldToScreen(a.x, a.y);
      const sb = worldToScreen(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = baseLine * widthMul;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      if (graphSettings.showArrows) {
        const angle = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        const head = Math.max(5, 7 * Math.min(1.4, Math.max(0.7, scale)) * linkScale * widthMul);
        const mx = (sa.x + sb.x) / 2;
        const my = (sa.y + sb.y) / 2;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(
          mx - head * Math.cos(angle - Math.PI / 7),
          my - head * Math.sin(angle - Math.PI / 7),
        );
        ctx.lineTo(
          mx - head * Math.cos(angle + Math.PI / 7),
          my - head * Math.sin(angle + Math.PI / 7),
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    };

    // Pass 1: dim / normal edges
    for (const edge of edges) {
      const hot =
        focus != null &&
        hoverId != null &&
        ((edge.source === hoverId && focus.has(edge.target)) ||
          (edge.target === hoverId && focus.has(edge.source)));
      if (hot) continue;
      drawEdge(edge, linkColor, dimming ? 0.18 : 0.85, 1);
    }
    // Pass 2: highlighted edges on top
    if (focus && hoverId) {
      for (const edge of edges) {
        const hot =
          (edge.source === hoverId && focus.has(edge.target)) ||
          (edge.target === hoverId && focus.has(edge.source));
        if (!hot) continue;
        drawEdge(edge, accent, 1, 1.85);
      }
    }
    ctx.globalAlpha = 1;

    const maxDeg = Math.max(1, ...nodes.map((node) => node.degree));
    const scaleClamp = nodeScaleClamp();

    const drawNode = (node: GraphNode, highlighted: boolean) => {
      const s = worldToScreen(node.x, node.y);
      if (s.x < -40 || s.y < -40 || s.x > width + 40 || s.y > height + 40) {
        return;
      }
      const r = nodeRadius(node, maxDeg, scaleClamp, nodeScale);
      const isHover = node.id === hoverId;
      const drawR = r * (isHover ? 1.15 : 1);
      const fontSize = labelFontSize(drawR);
      ctx.beginPath();
      if (highlighted) {
        ctx.fillStyle = isHover ? accent : nodeActive;
        ctx.globalAlpha = 1;
      } else if (dimming) {
        ctx.fillStyle = node.center ? nodeActive : nodeColor;
        ctx.globalAlpha = 0.22;
      } else {
        ctx.fillStyle = node.center ? nodeActive : nodeColor;
        ctx.globalAlpha = 1;
      }
      ctx.arc(s.x, s.y, drawR, 0, Math.PI * 2);
      ctx.fill();

      const labelA = highlighted
        ? Math.max(textAlpha, 0.92)
        : dimming
          ? textAlpha * 0.25
          : textAlpha;
      if (labelA > 0.02) {
        ctx.globalAlpha = labelA;
        ctx.fillStyle = highlighted ? (isHover ? accent : labelColor) : labelColor;
        ctx.font = `${isHover ? "600 " : ""}${fontSize}px ${uiFont}`;
        ctx.textAlign = "center";
        ctx.fillText(node.label.slice(0, 24), s.x, s.y + drawR + fontSize + 2);
      }
      ctx.globalAlpha = 1;
    };

    for (const node of nodes) {
      if (focus?.has(node.id)) continue;
      drawNode(node, false);
    }
    if (focus) {
      for (const node of nodes) {
        if (!focus.has(node.id) || node.id === hoverId) continue;
        drawNode(node, true);
      }
      const hovered = hoverId ? byId.get(hoverId) : null;
      if (hovered) drawNode(hovered, true);
    }
  }

  function tick(): void {
    const rect = canvasWrap.getBoundingClientRect();
    let simulating = false;
    if (rect.width > 0 && rect.height > 0 && nodes.length > 0) {
      const alphaBefore = alpha;
      stepForces();
      simulating =
        alpha >= 0.001 || alphaBefore >= 0.001 || progression > 0;
    }
    const zooming = updateZoom();
    const coasting = applyPanInertia();
    if (dirty || simulating || zooming || coasting || progression > 0) {
      draw();
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  }

  function rebuild(): void {
    stopProgression();
    const data = mode === "local" ? buildLocalGraph(activePath) : buildVaultGraph();
    nodes = data.nodes;
    edges = data.edges;
    hoverId = null;
    canvas.style.cursor = "";
    rebuildAdjacency();
    seedLayout();
    // Warm up long enough for repulsion/collision to space nodes evenly.
    for (let i = 0; i < 160; i++) stepForces(true);
    const rect = canvasWrap.getBoundingClientRect();
    fitCamera(Math.max(rect.width, 200), Math.max(rect.height, 160));
    if (graphSettings.animate) alpha = Math.max(alpha, 0.2);
    updateLists();
    refreshChrome();
    scheduleDraw();
  }

  function applyProgressionSlice(count: number): void {
    const slice = progressionSlots.slice(0, Math.max(0, count));
    const visibleIds = new Set<string>();
    const nextEdges: GraphEdge[] = [];
    for (const slot of slice) {
      if (slot.kind === "node") {
        visibleIds.add(slot.id);
      } else {
        nextEdges.push(slot.edge);
        visibleIds.add(slot.edge.source);
        visibleIds.add(slot.edge.target);
      }
    }
    const prev = new Map(nodes.map((node) => [node.id, node]));
    const nextNodes: GraphNode[] = [];
    for (const template of progressionFullNodes) {
      if (!visibleIds.has(template.id)) continue;
      const existing = prev.get(template.id);
      if (existing) {
        nextNodes.push(existing);
        continue;
      }
      nextNodes.push({
        ...template,
        x: (Math.random() - 0.5) * 36,
        y: (Math.random() - 0.5) * 36,
        vx: 0,
        vy: 0,
      });
    }
    nodes = nextNodes;
    edges = nextEdges;
    attachDegrees(nodes, edges);
    rebuildAdjacency();
    alpha = Math.max(alpha, 0.45);
    scheduleDraw();
  }

  /**
   * Obsidian `renderProgression`: reveal graph slots over time while forces run.
   * Speed ≈ clamp(0.5 * sqrt(slotCount), 5, 100) slots/sec.
   */
  function playProgression(): void {
    stopProgression();
    // Timelapse is for the global vault graph (Obsidian hides it on local).
    const data = buildVaultGraph();
    if (data.nodes.length === 0) {
      rebuild();
      return;
    }
    if (mode !== "vault") {
      mode = "vault";
      syncModeButton();
      editorGraph?.setMode(oppositeMode(mode));
    }
    progressionFullNodes = data.nodes.map((node) => ({
      ...node,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      degree: 0,
    }));
    progressionSlots = buildProgressionSlots(data.nodes, data.edges);
    const total = progressionSlots.length;
    const speed = Math.max(5, Math.min(100, 0.5 * Math.sqrt(Math.max(total, 1))));
    const gen = ++progressionGen;
    progression = 1;
    hoverId = null;
    canvas.style.cursor = "";
    nodes = [];
    edges = [];
    rebuildAdjacency();
    updateLists();
    refreshChrome();

    const rect = canvasWrap.getBoundingClientRect();
    setScaleImmediate(1);
    panX = Math.max(rect.width, 200) / 2;
    panY = Math.max(rect.height, 160) / 2;
    panvX = panvY = 0;

    applyProgressionSlice(1);
    const startedAt = Date.now();

    const tickProgression = () => {
      if (gen !== progressionGen || progression <= 0) return;
      const next = 1 + Math.floor((speed * (Date.now() - startedAt)) / 1000);
      if (next !== progression) {
        if (next > total) {
          const prev = new Map(nodes.map((node) => [node.id, node]));
          nodes = progressionFullNodes.map((template) => {
            const existing = prev.get(template.id);
            return (
              existing ?? {
                ...template,
                x: (Math.random() - 0.5) * 36,
                y: (Math.random() - 0.5) * 36,
                vx: 0,
                vy: 0,
              }
            );
          });
          edges = data.edges;
          attachDegrees(nodes, edges);
          rebuildAdjacency();
          stopProgression();
          alpha = Math.max(alpha, graphSettings.animate ? 0.2 : 0.12);
          const r = canvasWrap.getBoundingClientRect();
          fitCamera(Math.max(r.width, 200), Math.max(r.height, 160));
          updateLists();
          scheduleDraw();
          return;
        }
        progression = next;
        applyProgressionSlice(progression);
      }
      requestAnimationFrame(tickProgression);
    };
    requestAnimationFrame(tickProgression);
  }

  function hitNode(clientX: number, clientY: number): GraphNode | null {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const maxDeg = Math.max(1, ...nodes.map((node) => node.degree));
    const scaleClamp = nodeScaleClamp();
    const nodeScale = graphSettingFactor(graphSettings.nodeSize);
    let best: GraphNode | null = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      const rScreen = nodeRadius(node, maxDeg, scaleClamp, nodeScale);
      const hitR = Math.max(rScreen / Math.max(scale, 0.001), 8 / Math.max(scale, 0.3));
      const d = Math.hypot(node.x - world.x, node.y - world.y);
      if (d <= hitR && d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  function updateHover(clientX: number, clientY: number): void {
    if (panning || dragId) return;
    const hit = hitNode(clientX, clientY);
    const next = hit?.id ?? null;
    if (next !== hoverId) {
      hoverId = next;
      scheduleDraw();
    }
    canvas.style.cursor = next ? "pointer" : "";
  }

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      // Obsidian onWheel: normalize delta, write targetScale only (no instant scale).
      let dy = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 40;
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= 800;
      targetScale *= Math.pow(1.5, -dy / 120);
      targetScale = Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, targetScale));
      // Zoom-in anchors to cursor; zoom-out eases toward viewport center.
      if (targetScale < scale) {
        zoomUseCursor = false;
      } else {
        zoomUseCursor = true;
        zoomAnchorX = sx;
        zoomAnchorY = sy;
      }
      scheduleDraw();
    },
    { passive: false },
  );

  canvas.addEventListener("pointerdown", (event) => {
    const hit = hitNode(event.clientX, event.clientY);
    downX = event.clientX;
    downY = event.clientY;
    pointerMoved = false;

    if (hit && event.button === 0) {
      dragId = hit.id;
      hoverId = hit.id;
      panning = false;
      canvas.style.cursor = "pointer";
      canvas.setPointerCapture(event.pointerId);
      scheduleDraw();
      return;
    }

    // Empty space / middle button → pan
    if (event.button === 0 || event.button === 1) {
      panning = true;
      dragId = null;
      hoverId = null;
      panLastX = event.clientX;
      panLastY = event.clientY;
      panvX = panvY = 0;
      panVelDx = panVelDy = 0;
      panVelDt = 16;
      panGestureT = performance.now();
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      scheduleDraw();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) {
      pointerMoved = true;
    }

    if (panning) {
      const dx = event.clientX - panLastX;
      const dy = event.clientY - panLastY;
      const now = performance.now();
      const dt = Math.max(1, now - panGestureT);
      panX += dx;
      panY += dy;
      panVelDx = camLerp(panVelDx, dx, 0.8);
      panVelDy = camLerp(panVelDy, dy, 0.8);
      panVelDt = camLerp(panVelDt, dt, 0.8);
      panGestureT = now;
      panLastX = event.clientX;
      panLastY = event.clientY;
      scheduleDraw();
      return;
    }

    if (dragId) {
      const node = nodes.find((n) => n.id === dragId);
      if (!node) return;
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
      node.x = world.x;
      node.y = world.y;
      node.vx = 0;
      node.vy = 0;
      alpha = Math.max(alpha, 0.12);
      canvas.style.cursor = "pointer";
      return;
    }

    updateHover(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (panning) {
      panning = false;
      const releasedAgo = performance.now() - panGestureT;
      // Obsidian: only keep fling if the last sample was recent (<100ms).
      if (releasedAgo > 100 || panVelDt < 1) {
        panvX = panvY = 0;
      } else {
        panvX = panVelDx / panVelDt;
        panvY = panVelDy / panVelDt;
      }
      updateHover(event.clientX, event.clientY);
      return;
    }
    if (!dragId) {
      updateHover(event.clientX, event.clientY);
      return;
    }
    const id = dragId;
    dragId = null;
    if (!pointerMoved) {
      const node = nodes.find((n) => n.id === id);
      if (node) openHandler(node.path);
    }
    updateHover(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointerleave", () => {
    if (panning || dragId) return;
    if (hoverId) {
      hoverId = null;
      canvas.style.cursor = "";
      scheduleDraw();
    }
  });

  canvas.addEventListener("pointercancel", () => {
    panning = false;
    dragId = null;
    hoverId = null;
    panvX = panvY = 0;
    canvas.style.cursor = "";
    scheduleDraw();
  });

  const unsubIndex = linkIndex.subscribe(() => rebuild());
  const unsubLocale = onLocaleChange(() => {
    refreshChrome();
    updateLists();
  });
  const unsubGraphSettings = subscribeGraphSettings((next) => {
    applyGraphSettingsLocal(next);
    syncFloatChrome?.();
  });
  const ro = new ResizeObserver(() => {
    scheduleDraw();
  });
  ro.observe(canvasWrap);

  refreshChrome();
  rebuild();
  if (!graphSettings.animate) alpha = 0.2;
  raf = requestAnimationFrame(tick);

  return {
    el: host,
    setActiveFile(path) {
      activePath = path ? path.replace(/\\/g, "/") : null;
      rebuild();
      editorGraph?.setActiveFile(activePath);
    },
    setMode(next) {
      if (mode === next) return;
      mode = next;
      syncModeButton();
      rebuild();
      editorGraph?.setMode(oppositeMode(mode));
    },
    setEditorHost(hostEl) {
      if (editorHost === hostEl) return;
      closeEditorGraph();
      editorHost = hostEl;
    },
    applyGraphSettings(next) {
      applyGraphSettingsLocal(next ?? loadSettings().graph);
      syncFloatChrome?.();
      editorGraph?.applyGraphSettings(next);
    },
    playProgression() {
      playProgression();
    },
    refresh() {
      rebuild();
      editorGraph?.refresh();
    },
    onOpenFile(handler) {
      openHandler = handler;
      editorGraph?.onOpenFile(handler);
    },
    destroy() {
      stopProgression();
      cancelAnimationFrame(raf);
      closeEditorGraph();
      unsubIndex();
      unsubLocale();
      unsubGraphSettings();
      ro.disconnect();
      toolbar?.destroy();
      host.replaceChildren();
    },
  };
}
