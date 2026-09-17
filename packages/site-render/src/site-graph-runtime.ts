/**
 * Browser runtime for published site graphs (preview + modal).
 * Ported from apps/inimark graph-panel forces / camera / draw (defaults only).
 * Label fade math: keep in sync with apps/inimark/src/sidebar/graph-label.ts.
 * Hover fade math: keep in sync with apps/inimark/src/sidebar/graph-hover.ts.
 * Embedded into SITE_JS as a string — keep self-contained (no imports).
 */
export const SITE_GRAPH_JS = `
  const GRAPH_SCALE_MIN = 0.12;
  const GRAPH_SCALE_MAX = 15;
  const ZOOM_LERP_K = 0.72;
  const PAN_DECAY_K = 0.78;
  const SETTINGS = {
    nodeSize: 50,
    linkThickness: 50,
    textOpacity: 50,
    animate: true,
    centerForce: 45,
    repulsion: 75,
    linkForce: 20,
    linkDistance: 70,
    showArrows: false,
  };

  function camLerp(current, target, k) {
    return current * k + target * (1 - k);
  }
  function graphSettingFactor(value) {
    return Math.max(0.05, value / 50);
  }
  function graphLabelAlpha(textOpacity, scale) {
    if (textOpacity <= 0) return 1;
    const t = Math.max(0, Math.min(1, textOpacity / 100));
    let hide, full;
    if (t <= 0.5) {
      const u = t * 2;
      hide = -1 + 1.5 * u;
      full = 0.25 + 0.5 * u;
    } else {
      const u = (t - 0.5) * 2;
      hide = 0.5 + 0.75 * u;
      full = 0.75 + 1.75 * u;
    }
    if (scale <= hide) return 0;
    if (scale >= full) return 1;
    const u = (scale - hide) / (full - hide);
    return u * u * (3 - 2 * u);
  }
  const GRAPH_HOVER_LERP_K = 0.78;
  function mix(a, b, t) { return a + (b - a) * t; }
  function lerpHover(current, target) {
    const next = current * GRAPH_HOVER_LERP_K + target * (1 - GRAPH_HOVER_LERP_K);
    return Math.abs(next - target) < 0.008 ? target : next;
  }
  function parseRgb(color) {
    const trimmed = String(color || "").trim();
    if (trimmed.startsWith("#")) {
      let hex = trimmed.slice(1);
      if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((c) => c + c).join("");
      if (hex.length === 6 || hex.length === 8) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
      return null;
    }
    const rgb = trimmed.match(/^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)/i);
    if (!rgb) return null;
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  function mixCssColor(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ca = parseRgb(a), cb = parseRgb(b);
    if (!ca || !cb) return t < 0.5 ? a : b;
    const ch = (i) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
    return "rgb(" + ch(0) + ", " + ch(1) + ", " + ch(2) + ")";
  }
  function nodeFillAlpha(scene, focus) { return mix(1, 0.22, scene * (1 - focus)); }
  function edgeStrokeAlpha(scene, hot) { return mix(mix(0.85, 0.18, scene), 1, hot); }
  function edgeWidthMul(hot) { return mix(1, 1.85, hot); }
  function nodeHoverScale(center) { return mix(1, 1.15, center); }
  function nodeLabelAlpha(textAlpha, center, focus, scene) {
    const dimmed = textAlpha * 0.25;
    const neighbor = textAlpha;
    const hovered = Math.max(textAlpha, 0.92);
    const inScene = mix(dimmed, mix(neighbor, hovered, center), Math.max(focus, center));
    return mix(textAlpha, inScene, scene);
  }
  function edgeHoverKey(source, target) { return source + "\\0" + target; }
  function stepHoverMap(map, id, target) {
    const current = map.get(id) || 0;
    const next = lerpHover(current, target);
    if (next === 0) {
      if (current === 0) return false;
      map.delete(id);
      return true;
    }
    if (next === current) return false;
    map.set(id, next);
    return true;
  }
  function stepHoverMapTargets(map, targets) {
    let moving = false;
    const ids = new Set([...map.keys(), ...targets.keys()]);
    for (const id of ids) {
      if (stepHoverMap(map, id, targets.get(id) || 0)) moving = true;
    }
    return moving;
  }
  function stepGraphHover(state, hoverId, adjacency, edges) {
    const nextScene = lerpHover(state.scene, hoverId ? 1 : 0);
    let moving = nextScene !== state.scene;
    state.scene = nextScene;
    const focusTargets = new Map(), centerTargets = new Map();
    if (hoverId) {
      centerTargets.set(hoverId, 1);
      focusTargets.set(hoverId, 1);
      const neighbors = adjacency.get(hoverId);
      if (neighbors) for (const id of neighbors) focusTargets.set(id, 1);
    }
    if (stepHoverMapTargets(state.focus, focusTargets)) moving = true;
    if (stepHoverMapTargets(state.center, centerTargets)) moving = true;
    const edgeTargets = new Map();
    if (hoverId) {
      for (const edge of edges) {
        if (edge.source === hoverId || edge.target === hoverId) {
          edgeTargets.set(edgeHoverKey(edge.source, edge.target), 1);
        }
      }
    }
    if (stepHoverMapTargets(state.edge, edgeTargets)) moving = true;
    return moving;
  }
  function cssVar(el, name, fallback) {
    const value = getComputedStyle(el).getPropertyValue(name).trim();
    return value || fallback;
  }
  function relativeHref(fromHtmlPath, toHtmlPath) {
    const fromParts = String(fromHtmlPath || "").replace(/\\\\/g, "/").split("/");
    fromParts.pop();
    const toParts = String(toHtmlPath || "").replace(/\\\\/g, "/").split("/");
    let i = 0;
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
    const up = fromParts.length - i;
    const down = toParts.slice(i).join("/");
    return (up > 0 ? "../".repeat(up) : "") + down;
  }
  function parseGraphPayload(raw) {
    try { return JSON.parse(raw || "{}"); }
    catch { return null; }
  }

  /**
   * @param {HTMLElement} host
   * @param {object} payload
   * @param {{ lockCursor?: boolean }} [options]
   *   lockCursor: keep default arrow (preview rail). Modal keeps grab/pointer.
   */
  function mountSiteGraph(host, payload, options) {
    const canvas = host.querySelector(".site-graph-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return () => {};
    const lockCursor = !!(options && options.lockCursor);
    const nodesIn = Array.isArray(payload?.nodes) ? payload.nodes : [];
    if (!nodesIn.length) return () => {};

    const edgeIn = Array.isArray(payload.edges) ? payload.edges : [];
    const nodes = nodesIn.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      href: n.href || "",
      center: !!n.center,
      degree: 0,
      x: 0, y: 0, vx: 0, vy: 0,
    }));
    const byId = () => new Map(nodes.map((n) => [n.id, n]));
    let edges = edgeIn
      .filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    function attachDegrees() {
      for (const n of nodes) n.degree = 0;
      const map = byId();
      for (const e of edges) {
        const a = map.get(e.source);
        const b = map.get(e.target);
        if (a) a.degree += 1;
        if (b) b.degree += 1;
      }
    }
    attachDegrees();

    let alpha = 1;
    let hoverId = null;
    const hoverVisual = { scene: 0, focus: new Map(), center: new Map(), edge: new Map() };
    let dragId = null;
    let panning = false;
    let scale = 1;
    let targetScale = 1;
    let panX = 0, panY = 0;
    let panvX = 0, panvY = 0;
    let panLastX = 0, panLastY = 0;
    let panVelDx = 0, panVelDy = 0, panVelDt = 16, panGestureT = 0;
    let zoomAnchorX = 0, zoomAnchorY = 0, zoomUseCursor = false;
    let downX = 0, downY = 0, pointerMoved = false;
    let adjacency = new Map();
    let dirty = true;
    let width = 240, height = 200;
    let disposed = false;
    let raf = 0;

    function setCursor(value) {
      if (lockCursor) {
        canvas.style.cursor = "default";
        return;
      }
      canvas.style.cursor = value;
    }
    setCursor("default");

    function rebuildAdjacency() {
      adjacency = new Map(nodes.map((n) => [n.id, new Set()]));
      for (const e of edges) {
        adjacency.get(e.source)?.add(e.target);
        adjacency.get(e.target)?.add(e.source);
      }
    }

    function seedLayout() {
      const n = Math.max(nodes.length, 1);
      const radius = Math.max(120, 42 * Math.sqrt(n));
      nodes.forEach((node, i) => {
        if (node.center) { node.x = 0; node.y = 0; }
        else {
          const angle = i * 2.399963;
          const r = radius * Math.sqrt((i + 1) / n);
          node.x = Math.cos(angle) * r;
          node.y = Math.sin(angle) * r;
        }
        node.vx = 0; node.vy = 0;
      });
      alpha = 1;
    }

    function setScaleImmediate(next) {
      scale = targetScale = Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, next));
    }

    function fitCamera(pad) {
      if (!nodes.length || width <= 0 || height <= 0) {
        setScaleImmediate(1);
        panX = width / 2; panY = height / 2;
        panvX = panvY = 0;
        return;
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const node of nodes) {
        minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
      }
      const margin = 18;
      const bw = Math.max(maxX - minX, 1) + margin * 2;
      const bh = Math.max(maxY - minY, 1) + margin * 2;
      const sx = (width - pad * 2) / bw;
      const sy = (height - pad * 2) / bh;
      setScaleImmediate(Math.min(sx, sy));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      panX = width / 2 - cx * scale;
      panY = height / 2 - cy * scale;
      panvX = panvY = 0;
    }

    function worldToScreen(wx, wy) {
      return { x: wx * scale + panX, y: wy * scale + panY };
    }
    function screenToWorld(sx, sy) {
      return { x: (sx - panX) / scale, y: (sy - panY) / scale };
    }

    function stepForces(settling) {
      if (!nodes.length) return;
      const alphaTarget = settling ? 0 : SETTINGS.animate ? 0.08 : 0;
      if (!settling && !SETTINGS.animate && alpha < 0.001) return;

      const n = nodes.length;
      const map = byId();
      const centerStrength = (SETTINGS.centerForce / 100) * 0.55;
      const charge = -(60 + SETTINGS.repulsion * 7);
      const linkStrength = (SETTINGS.linkForce / 100) * 0.65;
      const linkDistance = 70 + SETTINGS.linkDistance * 3.4;
      const nodeSizeFactor = graphSettingFactor(SETTINGS.nodeSize);
      const collideBase = 14 * nodeSizeFactor;
      const distanceMax2 = 520 * 520;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let distSq = dx * dx + dy * dy;
          if (distSq >= distanceMax2) continue;
          if (distSq < 0.01) {
            dx = (Math.random() - 0.5) * 0.5;
            dy = (Math.random() - 0.5) * 0.5;
            distSq = dx * dx + dy * dy;
          }
          const w = (charge * alpha) / distSq;
          dx *= w; dy *= w;
          a.vx += dx; a.vy += dy;
          b.vx -= dx; b.vy -= dy;
        }
      }

      if (linkStrength > 0.001) {
        for (const edge of edges) {
          const a = map.get(edge.source), b = map.get(edge.target);
          if (!a || !b) continue;
          let dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          const degreeSum = Math.max(1, a.degree + b.degree);
          const bias = a.degree / degreeSum;
          const strength = linkStrength * alpha;
          const k = ((dist - linkDistance) / dist) * strength;
          dx *= k; dy *= k;
          a.vx += dx * (1 - bias); a.vy += dy * (1 - bias);
          b.vx -= dx * bias; b.vy -= dy * bias;
        }
      }

      const maxDeg = Math.max(1, ...nodes.map((node) => node.degree));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
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
          dx *= push; dy *= push;
          a.vx -= dx; a.vy -= dy;
          b.vx += dx; b.vy += dy;
        }
      }

      for (const node of nodes) {
        if (dragId === node.id) { node.vx = 0; node.vy = 0; continue; }
        node.vx += -node.x * centerStrength * alpha;
        node.vy += -node.y * centerStrength * alpha;
        node.vx *= 0.6; node.vy *= 0.6;
        node.x += node.vx; node.y += node.vy;
      }
      alpha += (alphaTarget - alpha) * (settling ? 0.05 : 0.0228);
    }

    function nodeScaleClamp() {
      return Math.min(3.2, Math.max(0.65, scale));
    }
    function nodeRadius(node, maxDeg, scaleClamp, nodeScale) {
      const degreeBoost = 5 + (node.degree / maxDeg) * 9;
      return degreeBoost * scaleClamp * nodeScale;
    }
    function labelFontSize(drawR) {
      const t = Math.max(0, Math.min(1, (drawR - 4) / 32));
      return 9 + t * 16;
    }

    function draw() {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const bw = Math.floor(width * dpr), bh = Math.floor(height * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const nodeColor = cssVar(host, "--inimark-graph-node", "#b4b4b4");
      const nodeActive = cssVar(host, "--inimark-graph-node-active", "#d0d0d0");
      const labelColor = cssVar(host, "--inimark-graph-label", "#dcdcdc");
      const linkColor = cssVar(host, "--inimark-graph-link", "#3c3c3c");
      const accent = cssVar(host, "--inimark-graph-highlight", cssVar(host, "--accent", "#64748b"));
      const uiFont = cssVar(document.documentElement, "--font-ui", "system-ui, sans-serif");
      const nodeScale = graphSettingFactor(SETTINGS.nodeSize);
      const linkScale = graphSettingFactor(SETTINGS.linkThickness);
      const textAlpha = graphLabelAlpha(SETTINGS.textOpacity, scale);
      const scene = hoverVisual.scene;
      const map = byId();
      const baseLine = Math.max(0.75, 1.25 * linkScale);

      const drawEdge = (edge, color, a, widthMul) => {
        const na = map.get(edge.source), nb = map.get(edge.target);
        if (!na || !nb) return;
        const sa = worldToScreen(na.x, na.y);
        const sb = worldToScreen(nb.x, nb.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = a;
        ctx.lineWidth = baseLine * widthMul;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
      };

      for (const edge of edges) {
        const hotAmt = hoverVisual.edge.get(edgeHoverKey(edge.source, edge.target)) || 0;
        if (hotAmt > 0.02) continue;
        drawEdge(edge, linkColor, edgeStrokeAlpha(scene, 0), 1);
      }
      for (const edge of edges) {
        const hotAmt = hoverVisual.edge.get(edgeHoverKey(edge.source, edge.target)) || 0;
        if (hotAmt <= 0.02) continue;
        drawEdge(
          edge,
          mixCssColor(linkColor, accent, hotAmt),
          edgeStrokeAlpha(scene, hotAmt),
          edgeWidthMul(hotAmt),
        );
      }
      ctx.globalAlpha = 1;

      const maxDeg = Math.max(1, ...nodes.map((n) => n.degree));
      const scaleClamp = nodeScaleClamp();

      const drawNode = (node) => {
        const s = worldToScreen(node.x, node.y);
        if (s.x < -40 || s.y < -40 || s.x > width + 40 || s.y > height + 40) return;
        const focusAmt = hoverVisual.focus.get(node.id) || 0;
        const centerAmt = hoverVisual.center.get(node.id) || 0;
        const r = nodeRadius(node, maxDeg, scaleClamp, nodeScale);
        const drawR = r * nodeHoverScale(centerAmt);
        const fontSize = labelFontSize(drawR);
        const baseFill = node.center ? nodeActive : nodeColor;
        const litFill = mixCssColor(baseFill, nodeActive, focusAmt);
        ctx.beginPath();
        ctx.fillStyle = mixCssColor(litFill, accent, centerAmt);
        ctx.globalAlpha = nodeFillAlpha(scene, focusAmt);
        ctx.arc(s.x, s.y, drawR, 0, Math.PI * 2);
        ctx.fill();

        const labelA = nodeLabelAlpha(textAlpha, centerAmt, focusAmt, scene);
        if (labelA > 0.02) {
          ctx.globalAlpha = labelA;
          ctx.fillStyle = mixCssColor(labelColor, accent, centerAmt);
          ctx.font = (centerAmt > 0.35 ? "600 " : "") + fontSize + "px " + uiFont;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(node.label.slice(0, 24), s.x, s.y + drawR + fontSize + 2);
        }
        ctx.globalAlpha = 1;
      };

      for (const node of nodes) {
        const focusAmt = hoverVisual.focus.get(node.id) || 0;
        const centerAmt = hoverVisual.center.get(node.id) || 0;
        if (focusAmt > 0.02 || centerAmt > 0.02) continue;
        drawNode(node);
      }
      for (const node of nodes) {
        const focusAmt = hoverVisual.focus.get(node.id) || 0;
        const centerAmt = hoverVisual.center.get(node.id) || 0;
        if (focusAmt <= 0.02 || centerAmt > 0.02) continue;
        drawNode(node);
      }
      for (const node of nodes) {
        if ((hoverVisual.center.get(node.id) || 0) <= 0.02) continue;
        drawNode(node);
      }
    }

    function updateZoom() {
      targetScale = Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, targetScale));
      const cur = scale, next = targetScale;
      const gap = (cur > next ? cur / next : next / cur) - 1;
      if (gap < 0.008) {
        if (gap > 0) { scale = next; return true; }
        return false;
      }
      const zx = zoomUseCursor ? zoomAnchorX : width / 2;
      const zy = zoomUseCursor ? zoomAnchorY : height / 2;
      const wx = (zx - panX) / cur, wy = (zy - panY) / cur;
      scale = camLerp(cur, next, ZOOM_LERP_K);
      panX = zx - wx * scale;
      panY = zy - wy * scale;
      return true;
    }

    function applyPanInertia() {
      if (panning) return false;
      if (Math.abs(panvX) < 1e-4 && Math.abs(panvY) < 1e-4) {
        panvX = panvY = 0; return false;
      }
      panX += (1000 / 60) * panvX;
      panY += (1000 / 60) * panvY;
      panvX = camLerp(panvX, 0, PAN_DECAY_K);
      panvY = camLerp(panvY, 0, PAN_DECAY_K);
      return true;
    }

    function hitNode(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(clientX - rect.left, clientY - rect.top);
      const maxDeg = Math.max(1, ...nodes.map((n) => n.degree));
      const scaleClamp = nodeScaleClamp();
      const nodeScale = graphSettingFactor(SETTINGS.nodeSize);
      let best = null, bestDist = Infinity;
      for (const node of nodes) {
        const rScreen = nodeRadius(node, maxDeg, scaleClamp, nodeScale);
        const hitR = Math.max(rScreen / Math.max(scale, 0.001), 8 / Math.max(scale, 0.3));
        const d = Math.hypot(node.x - world.x, node.y - world.y);
        const score = d - (node.center ? 0.5 : 0);
        if (d <= hitR && score < bestDist) { bestDist = score; best = node; }
      }
      return best;
    }

    function tick() {
      if (disposed) return;
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      let simulating = false;
      if (nodes.length) {
        const before = alpha;
        stepForces(false);
        simulating = alpha >= 0.001 || before >= 0.001;
      }
      const zooming = updateZoom();
      const coasting = applyPanInertia();
      const hovering = stepGraphHover(hoverVisual, hoverId, adjacency, edges);
      if (dirty || simulating || zooming || coasting || dragId || hovering) {
        draw();
        dirty = false;
      }
      raf = requestAnimationFrame(tick);
    }

    const onPointerDown = (event) => {
      const hit = hitNode(event.clientX, event.clientY);
      downX = event.clientX; downY = event.clientY; pointerMoved = false;
      if (hit && event.button === 0) {
        dragId = hit.id;
        hoverId = hit.id;
        panning = false;
        setCursor(lockCursor ? "default" : "pointer");
        canvas.setPointerCapture(event.pointerId);
        dirty = true;
        return;
      }
      if (event.button === 0 || event.button === 1) {
        panning = true;
        dragId = null;
        hoverId = null;
        panLastX = event.clientX; panLastY = event.clientY;
        panvX = panvY = 0;
        panVelDx = panVelDy = 0; panVelDt = 16;
        panGestureT = performance.now();
        canvas.setPointerCapture(event.pointerId);
        setCursor(lockCursor ? "default" : "grabbing");
        dirty = true;
      }
    };

    const onPointerMove = (event) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) pointerMoved = true;
      if (panning) {
        const dx = event.clientX - panLastX;
        const dy = event.clientY - panLastY;
        const now = performance.now();
        const dt = Math.max(1, now - panGestureT);
        panX += dx; panY += dy;
        panVelDx = camLerp(panVelDx, dx, 0.8);
        panVelDy = camLerp(panVelDy, dy, 0.8);
        panVelDt = camLerp(panVelDt, dt, 0.8);
        panGestureT = now;
        panLastX = event.clientX; panLastY = event.clientY;
        dirty = true;
        return;
      }
      if (dragId) {
        const node = nodes.find((n) => n.id === dragId);
        if (!node) return;
        const rect = canvas.getBoundingClientRect();
        const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        node.x = world.x; node.y = world.y;
        node.vx = 0; node.vy = 0;
        alpha = Math.max(alpha, 0.12);
        setCursor(lockCursor ? "default" : "pointer");
        dirty = true;
        return;
      }
      const hit = hitNode(event.clientX, event.clientY);
      const next = hit?.id ?? null;
      if (next !== hoverId) { hoverId = next; dirty = true; }
      setCursor(lockCursor ? "default" : (hit ? "pointer" : "grab"));
    };

    const endPointer = (event) => {
      if (panning) {
        panning = false;
        const releasedAgo = performance.now() - panGestureT;
        if (releasedAgo < 64 && panVelDt > 0) {
          panvX = panVelDx / panVelDt;
          panvY = panVelDy / panVelDt;
        }
        setCursor(lockCursor ? "default" : "grab");
      }
      if (dragId) {
        const id = dragId;
        dragId = null;
        if (!pointerMoved) {
          const node = nodes.find((n) => n.id === id);
          if (node && node.href) location.href = node.href;
        }
        alpha = Math.max(alpha, SETTINGS.animate ? 0.2 : 0.12);
        setCursor(lockCursor ? "default" : "grab");
      }
      try { canvas.releasePointerCapture(event.pointerId); } catch {}
      dirty = true;
    };

    const onWheel = (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomUseCursor = true;
      zoomAnchorX = event.clientX - rect.left;
      zoomAnchorY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      targetScale = Math.max(GRAPH_SCALE_MIN, Math.min(GRAPH_SCALE_MAX, targetScale * factor));
      dirty = true;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    rebuildAdjacency();
    seedLayout();
    for (let i = 0; i < 160; i++) stepForces(true);
    const rect = host.getBoundingClientRect();
    width = Math.max(rect.width, 200);
    height = Math.max(rect.height, 160);
    fitCamera(28);
    if (SETTINGS.animate) alpha = Math.max(alpha, 0.2);
    dirty = true;
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("wheel", onWheel);
    };
  }

  let activeModalDispose = null;
  let globalGraphCache = null;

  function closeGraphModal() {
    if (activeModalDispose) {
      activeModalDispose();
      activeModalDispose = null;
    }
    document.querySelector(".site-graph-modal")?.remove();
    document.documentElement.classList.remove("site-graph-modal-open");
  }

  function openGraphModal(title, payload) {
    closeGraphModal();
    const overlay = document.createElement("div");
    overlay.className = "site-graph-modal";
    overlay.innerHTML =
      '<div class="site-graph-modal-dialog" role="dialog" aria-modal="true">' +
      '<div class="site-graph-modal-head">' +
      '<div class="site-graph-modal-title"></div>' +
      '<button type="button" class="site-graph-modal-close" aria-label="Close">×</button>' +
      "</div>" +
      '<div class="site-graph-modal-body"><div class="site-graph-modal-host">' +
      '<canvas class="site-graph-canvas" aria-label="Relationship graph"></canvas>' +
      "</div></div></div>";
    overlay.querySelector(".site-graph-modal-title").textContent = title;
    document.body.appendChild(overlay);
    document.documentElement.classList.add("site-graph-modal-open");

    const host = overlay.querySelector(".site-graph-modal-host");
    activeModalDispose = mountSiteGraph(host, payload, { lockCursor: false });

    const onKey = (event) => {
      if (event.key === "Escape") closeGraphModal();
    };
    const onBackdrop = (event) => {
      if (event.target === overlay) closeGraphModal();
    };
    overlay.querySelector(".site-graph-modal-close")?.addEventListener("click", closeGraphModal);
    overlay.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", onKey);
    const prevDispose = activeModalDispose;
    activeModalDispose = () => {
      window.removeEventListener("keydown", onKey);
      prevDispose?.();
    };
  }

  function readEmbeddedGlobalGraph() {
    if (typeof window !== "undefined" && window.__INIMARK_GLOBAL_GRAPH__) {
      return window.__INIMARK_GLOBAL_GRAPH__;
    }
    return null;
  }

  async function loadGlobalGraph(url, centerId, pageHtmlPath) {
    if (!globalGraphCache) {
      const embedded = readEmbeddedGlobalGraph();
      if (embedded && Array.isArray(embedded.nodes)) {
        globalGraphCache = embedded;
      } else if (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load global graph (" + res.status + ")");
        globalGraphCache = await res.json();
      } else {
        throw new Error("Global graph data is missing");
      }
    }
    const raw = globalGraphCache;
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map((n) => ({
      id: n.id,
      label: n.label || n.id,
      href: n.htmlPath ? relativeHref(pageHtmlPath, n.htmlPath) : (n.href || ""),
      center: n.id === centerId,
    }));
    const edges = Array.isArray(raw.edges) ? raw.edges : [];
    return { centerId, nodes, edges };
  }

  function findPreviewHost(fromEl) {
    const section = fromEl.closest(".site-graph");
    return section?.querySelector(".site-graph-host[data-graph-preview]") || null;
  }

  document.querySelectorAll(".site-graph-host[data-graph-preview]").forEach((host) => {
    const dataEl = host.querySelector(".site-graph-data");
    const localPayload = parseGraphPayload(dataEl?.textContent);
    if (localPayload) mountSiteGraph(host, localPayload, { lockCursor: true });
  });

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.("[data-graph-mode]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    const host = findPreviewHost(btn);
    const dataEl = host?.querySelector(".site-graph-data");
    const localPayload = parseGraphPayload(dataEl?.textContent);
    const pageHtml = host?.getAttribute("data-page-html") || "";
    const globalUrl = host?.getAttribute("data-global-graph") || "";
    const mode = btn.getAttribute("data-graph-mode");

    try {
      if (mode === "local") {
        openGraphModal("Local graph", localPayload || { nodes: [], edges: [] });
        return;
      }
      if (mode === "global") {
        const centerId = localPayload?.centerId || "";
        const payload = await loadGlobalGraph(globalUrl, centerId, pageHtml);
        if (!payload.nodes.length) throw new Error("Global graph has no nodes");
        openGraphModal("Global graph", payload);
      }
    } catch (err) {
      console.error(err);
      const message = err && err.message ? err.message : String(err);
      window.alert("Failed to open global graph:\\n" + message);
    }
  });
`;
