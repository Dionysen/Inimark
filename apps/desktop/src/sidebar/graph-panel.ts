import { onLocaleChange, t } from "../i18n/index.ts";
import { linkIndex } from "../wikilink/index.ts";
import { fileNameFromPath } from "../platform/env.ts";
import {
  createPanelToolbar,
  graphLocalModeIcon,
  graphOpenEditorIcon,
  graphVaultModeIcon,
} from "../ui/widgets/index.ts";

export type GraphMode = "local" | "vault";

function oppositeMode(mode: GraphMode): GraphMode {
  return mode === "local" ? "vault" : "local";
}

export interface GraphPanelController {
  el: HTMLElement;
  setActiveFile(path: string | null): void;
  setMode(mode: GraphMode): void;
  setEditorHost(host: HTMLElement | null): void;
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
  center?: boolean;
};

type GraphEdge = { source: string; target: string };

function noteLabel(pathOrName: string): string {
  const base = pathOrName.split(/[/\\]/).pop() || pathOrName;
  return base.replace(/\.(md|markdown|mdown|canvas)$/i, "");
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

  return { nodes: [...nodeMap.values()], edges };
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
  return { nodes: [...nodeMap.values()], edges };
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
  let openHandler: (path: string) => void = () => {};
  let editorHost: HTMLElement | null = null;
  let editorOverlay: HTMLElement | null = null;
  let editorGraph: GraphPanelController | null = null;
  let raf = 0;
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let dragId: string | null = null;
  let downX = 0;
  let downY = 0;
  let pointerMoved = false;
  let panning = false;
  let panLastX = 0;
  let panLastY = 0;

  // Camera: screen = world * scale + (panX, panY)
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let alpha = 1; // cooling for force sim

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
        draw();
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
  ): void {
    container.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-graph-list-empty";
      empty.textContent = t("graph.emptyLinks");
      container.append(empty);
      return;
    }
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-graph-list-item";
      btn.textContent = item.label;
      btn.title = item.path;
      btn.addEventListener("click", () => openHandler(item.path));
      container.append(btn);
    }
  }

  function updateLists(): void {
    if (variant === "editor") return;
    if (!activePath) {
      renderLinkList(outList, []);
      renderLinkList(backList, []);
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
    renderLinkList(outList, outItems);
    renderLinkList(backList, backItems);
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx * scale + panX, y: wy * scale + panY };
  }

  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - panX) / scale, y: (sy - panY) / scale };
  }

  function seedLayout(): void {
    const n = Math.max(nodes.length, 1);
    const radius = Math.max(80, 28 * Math.sqrt(n));
    nodes.forEach((node, i) => {
      if (node.center) {
        node.x = 0;
        node.y = 0;
      } else {
        // Golden-angle spiral — spreads isolates instead of stacking on a ring
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
      scale = 1;
      panX = width / 2;
      panY = height / 2;
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
    const bw = Math.max(maxX - minX, 40);
    const bh = Math.max(maxY - minY, 40);
    const sx = (width - pad * 2) / bw;
    const sy = (height - pad * 2) / bh;
    scale = Math.max(0.15, Math.min(2.5, Math.min(sx, sy)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    panX = width / 2 - cx * scale;
    panY = height / 2 - cy * scale;
  }

  function stepForces(): void {
    if (alpha < 0.02 || nodes.length === 0) {
      alpha *= 0.99;
      return;
    }

    const n = nodes.length;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    // Scale forces with graph size so large vaults don't explode.
    const charge = 420 / Math.sqrt(n);
    const linkDist = 56 + 8 * Math.sqrt(Math.max(edges.length, 1));
    const gravity = 0.015 + 0.02 / Math.sqrt(n);

    // Charge (repulsion) — soft, capped
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);
        const force = Math.min(8, (charge * alpha) / distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Springs
    for (const edge of edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = ((dist - linkDist) / dist) * 0.06 * alpha;
      const fx = dx * force;
      const fy = dy * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Gravity toward origin (world center) — no hard walls
    for (const node of nodes) {
      if (dragId === node.id) continue;
      if (node.center) {
        node.vx += -node.x * 0.08 * alpha;
        node.vy += -node.y * 0.08 * alpha;
      } else {
        node.vx += -node.x * gravity * alpha;
        node.vy += -node.y * gravity * alpha;
      }
      node.vx *= 0.78;
      node.vy *= 0.78;
      node.x += node.vx;
      node.y += node.vy;
    }

    alpha *= 0.985;
  }

  function draw(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(host);
    const fg = styles.getPropertyValue("--inimark-fg").trim() || "#e5e7eb";
    const muted = styles.getPropertyValue("--inimark-muted-fg").trim() || "#9ca3af";
    const accent = styles.getPropertyValue("--inimark-accent").trim() || "#3b82f6";
    const border = styles.getPropertyValue("--inimark-border").trim() || "#374151";

    const byId = new Map(nodes.map((node) => [node.id, node]));
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, 1 / scale);
    for (const edge of edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      const sa = worldToScreen(a.x, a.y);
      const sb = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const fontSize = Math.max(9, Math.min(12, 11 * Math.sqrt(scale)));
    for (const node of nodes) {
      const s = worldToScreen(node.x, node.y);
      if (s.x < -40 || s.y < -40 || s.x > width + 40 || s.y > height + 40) {
        continue;
      }
      const r = (node.center ? 7 : 5) * Math.min(1.4, Math.max(0.7, scale));
      ctx.beginPath();
      ctx.fillStyle = node.center ? accent : muted;
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (scale >= 0.45) {
        ctx.fillStyle = fg;
        ctx.font = `${fontSize}px var(--font-ui, system-ui)`;
        ctx.textAlign = "center";
        ctx.fillText(node.label.slice(0, 20), s.x, s.y + r + fontSize + 2);
      }
    }
  }

  function tick(): void {
    const rect = canvasWrap.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && nodes.length > 0) {
      stepForces();
      draw();
    }
    raf = requestAnimationFrame(tick);
  }

  function rebuild(): void {
    const data = mode === "local" ? buildLocalGraph(activePath) : buildVaultGraph();
    nodes = data.nodes;
    edges = data.edges;
    seedLayout();
    // Warm up a few ticks so fitCamera sees a reasonable bbox
    for (let i = 0; i < 40; i++) stepForces();
    const rect = canvasWrap.getBoundingClientRect();
    fitCamera(Math.max(rect.width, 200), Math.max(rect.height, 160));
    updateLists();
    refreshChrome();
    draw();
  }

  function hitNode(clientX: number, clientY: number): GraphNode | null {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const hitR = 12 / Math.max(scale, 0.3);
    const world = screenToWorld(sx, sy);
    let best: GraphNode | null = null;
    let bestDist = hitR;
    for (const node of nodes) {
      const d = Math.hypot(node.x - world.x, node.y - world.y);
      if (d <= bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const before = screenToWorld(sx, sy);
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      scale = Math.max(0.12, Math.min(4, scale * factor));
      // Keep cursor world point stable
      panX = sx - before.x * scale;
      panY = sy - before.y * scale;
      draw();
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
      panning = false;
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    // Empty space / middle button → pan
    if (event.button === 0 || event.button === 1) {
      panning = true;
      dragId = null;
      panLastX = event.clientX;
      panLastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) {
      pointerMoved = true;
    }

    if (panning) {
      panX += event.clientX - panLastX;
      panY += event.clientY - panLastY;
      panLastX = event.clientX;
      panLastY = event.clientY;
      draw();
      return;
    }

    if (!dragId) return;
    const node = nodes.find((n) => n.id === dragId);
    if (!node) return;
    const rect = canvas.getBoundingClientRect();
    const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    node.x = world.x;
    node.y = world.y;
    node.vx = 0;
    node.vy = 0;
    alpha = Math.max(alpha, 0.12);
  });

  canvas.addEventListener("pointerup", () => {
    canvas.style.cursor = "";
    if (panning) {
      panning = false;
      return;
    }
    if (!dragId) return;
    const id = dragId;
    dragId = null;
    if (!pointerMoved) {
      const node = nodes.find((n) => n.id === id);
      if (node) openHandler(node.path);
    }
  });

  const unsubIndex = linkIndex.subscribe(() => rebuild());
  const unsubLocale = onLocaleChange(() => {
    refreshChrome();
    updateLists();
  });
  const ro = new ResizeObserver(() => {
    draw();
  });
  ro.observe(canvasWrap);

  refreshChrome();
  rebuild();
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
    refresh() {
      rebuild();
      editorGraph?.refresh();
    },
    onOpenFile(handler) {
      openHandler = handler;
      editorGraph?.onOpenFile(handler);
    },
    destroy() {
      cancelAnimationFrame(raf);
      closeEditorGraph();
      unsubIndex();
      unsubLocale();
      ro.disconnect();
      toolbar?.destroy();
      host.replaceChildren();
    },
  };
}
