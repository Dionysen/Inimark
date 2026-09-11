export type MermaidLike = {
  initialize(config: {
    startOnLoad: false;
    securityLevel: "strict";
    suppressErrorRendering: true;
    theme: "base";
    themeVariables?: MermaidThemeVariables;
  }): void;
  render(id: string, code: string): Promise<{ svg: string }>;
};

export type MermaidThemeVariables = Record<
  string,
  string | boolean | Record<string, string | boolean>
>;

export type MermaidRenderState =
  | { state: "success"; svg: string }
  | { state: "error"; message: string };

export type MermaidLoader = () => Promise<MermaidLike>;

let renderSeq = 0;
const RENDER_TIMEOUT_MS = 5000;
const MERMAID_ERROR_SVG_RE = /Syntax error in text|mermaid version/i;

export type MermaidRenderAppearance = "light" | "dark";

type Rgba = { r: number; g: number; b: number; a: number };

type ThemeSeedFallbacks = {
  surface: string;
  secondary: string;
  tertiary: string;
  contentBg: string;
  code: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentHover: string;
  danger: string;
  blockquoteBg: string;
  blockquoteBorder: string;
};

const LIGHT_FALLBACKS: ThemeSeedFallbacks = {
  surface: "#ffffff",
  secondary: "#f6f8fa",
  tertiary: "#eaeef2",
  contentBg: "#ffffff",
  code: "#f6f8fa",
  fg: "#1f2328",
  muted: "#656d76",
  border: "#d0d7de",
  accent: "#0969da",
  accentHover: "#0550ae",
  danger: "#cf222e",
  blockquoteBg: "#f6f8fa",
  blockquoteBorder: "#d0d7de",
};

const DARK_FALLBACKS: ThemeSeedFallbacks = {
  surface: "#1b1d24",
  secondary: "#111217",
  tertiary: "#25272b",
  contentBg: "#1b1d24",
  code: "#1f2129",
  fg: "#ece7dd",
  muted: "#aeb6c2",
  border: "#4a4d52",
  accent: "#8ab4e7",
  accentHover: "#b994f4",
  danger: "#ff8f86",
  blockquoteBg: "#2d2a22",
  blockquoteBorder: "#8a7440",
};

/** CSS custom properties read for Mermaid theme seeds (and cache fingerprint). */
const MERMAID_THEME_CSS_VARS = [
  "--bg-surface",
  "--bg-secondary",
  "--bg-tertiary",
  "--bg-primary",
  "--bg-code",
  "--text-primary",
  "--text-secondary",
  "--border",
  "--accent",
  "--accent-hover",
  "--danger",
  "--blockquote-bg",
  "--blockquote-border",
] as const;

export function getMermaidRenderAppearance(): MermaidRenderAppearance {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.appearance === "dark" ? "dark" : "light";
}

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function toHex({ r, g, b }: Pick<Rgba, "r" | "g" | "b">): string {
  return `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g)
    .toString(16)
    .padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`;
}

/** Parse CSS color strings Mermaid cannot digest (rgba / color-mix results / etc.). */
export function parseCssColor(value: string): Rgba | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "transparent") return null;

  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    let hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length >= 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (rgb) {
    let a = 1;
    if (rgb[4] != null) {
      a = rgb[4].endsWith("%")
        ? Number.parseFloat(rgb[4]) / 100
        : Number(rgb[4]);
    }
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: Math.min(1, Math.max(0, a)),
    };
  }

  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (r + g + b + a > 0 || /^black$/i.test(trimmed) || trimmed === "#000" || trimmed === "#000000") {
          return { r, g, b, a: a / 255 };
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** Mermaid's palette expects opaque hex; blend translucent theme tokens onto a backdrop. */
export function toMermaidColor(value: string, fallback: string, backdrop = "#ffffff"): string {
  const parsed = parseCssColor(value) ?? parseCssColor(fallback);
  const fb = parseCssColor(fallback) ?? { r: 128, g: 128, b: 128, a: 1 };
  const color = parsed ?? fb;
  if (color.a >= 0.999) return toHex(color);

  const base = parseCssColor(backdrop) ?? { r: 255, g: 255, b: 255, a: 1 };
  const a = color.a;
  return toHex({
    r: color.r * a + base.r * (1 - a),
    g: color.g * a + base.g * (1 - a),
    b: color.b * a + base.b * (1 - a),
  });
}

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function readThemeSeeds(appearance: MermaidRenderAppearance): ThemeSeedFallbacks {
  const fb = appearance === "dark" ? DARK_FALLBACKS : LIGHT_FALLBACKS;
  const contentBgRaw = readCssVar("--bg-primary", readCssVar("--inimark-content-bg", fb.contentBg));
  const contentBg = toMermaidColor(contentBgRaw, fb.contentBg, fb.contentBg);

  const solid = (raw: string, fallback: string) => toMermaidColor(raw, fallback, contentBg);

  return {
    surface: solid(readCssVar("--bg-surface", readCssVar("--inimark-surface", fb.surface)), fb.surface),
    secondary: solid(readCssVar("--bg-secondary", readCssVar("--inimark-bg", fb.secondary)), fb.secondary),
    tertiary: solid(
      readCssVar("--bg-tertiary", readCssVar("--inimark-surface-raised", fb.tertiary)),
      fb.tertiary,
    ),
    contentBg,
    code: solid(readCssVar("--bg-code", fb.code), fb.code),
    fg: solid(readCssVar("--text-primary", readCssVar("--inimark-fg", fb.fg)), fb.fg),
    muted: solid(readCssVar("--text-secondary", readCssVar("--inimark-muted-fg", fb.muted)), fb.muted),
    border: solid(readCssVar("--border", readCssVar("--inimark-border", fb.border)), fb.border),
    accent: solid(readCssVar("--accent", readCssVar("--inimark-accent", fb.accent)), fb.accent),
    accentHover: solid(readCssVar("--accent-hover", fb.accentHover), fb.accentHover),
    danger: solid(readCssVar("--danger", fb.danger), fb.danger),
    blockquoteBg: solid(readCssVar("--blockquote-bg", fb.blockquoteBg), fb.blockquoteBg),
    blockquoteBorder: solid(readCssVar("--blockquote-border", fb.blockquoteBorder), fb.blockquoteBorder),
  };
}

/** Build Mermaid `themeVariables` from the active Inimark theme CSS tokens. */
export function buildMermaidThemeVariables(
  appearance: MermaidRenderAppearance = getMermaidRenderAppearance(),
): MermaidThemeVariables {
  const s = readThemeSeeds(appearance);
  const dark = appearance === "dark";
  // Pie slice labels sit on pastel fills — keep them dark for contrast.
  const pieSectionText = dark ? s.contentBg : s.fg;

  return {
    darkMode: dark,
    background: "transparent",
    primaryColor: s.surface,
    secondaryColor: s.secondary,
    tertiaryColor: s.tertiary,
    mainBkg: s.surface,
    secondBkg: s.secondary,
    primaryTextColor: s.fg,
    secondaryTextColor: s.fg,
    tertiaryTextColor: s.fg,
    textColor: s.fg,
    nodeTextColor: s.fg,
    primaryBorderColor: s.border,
    secondaryBorderColor: s.border,
    tertiaryBorderColor: s.border,
    lineColor: s.muted,
    arrowheadColor: s.muted,
    defaultLinkColor: s.muted,
    titleColor: s.accent,
    edgeLabelBackground: s.code,
    clusterBkg: s.secondary,
    clusterBorder: s.border,
    noteBkgColor: s.blockquoteBg,
    noteTextColor: s.fg,
    noteBorderColor: s.blockquoteBorder,
    actorBkg: s.surface,
    actorTextColor: s.fg,
    actorBorder: s.border,
    actorLineColor: s.border,
    labelBoxBkgColor: s.surface,
    labelBoxBorderColor: s.border,
    signalColor: s.muted,
    signalTextColor: s.fg,
    labelTextColor: s.fg,
    loopTextColor: s.fg,
    activationBorderColor: s.border,
    activationBkgColor: s.tertiary,
    sequenceNumberColor: s.contentBg,
    sectionBkgColor: s.surface,
    altSectionBkgColor: s.tertiary,
    sectionBkgColor2: s.surface,
    excludeBkgColor: s.danger,
    taskBorderColor: s.border,
    taskBkgColor: s.surface,
    taskTextColor: s.fg,
    taskTextOutsideColor: s.fg,
    taskTextLightColor: s.contentBg,
    taskTextDarkColor: s.fg,
    taskTextClickableColor: s.accent,
    activeTaskBorderColor: s.accent,
    activeTaskBkgColor: s.secondary,
    doneTaskBkgColor: s.code,
    doneTaskBorderColor: s.border,
    critBorderColor: s.danger,
    critBkgColor: s.secondary,
    gridColor: s.border,
    todayLineColor: s.danger,
    vertLineColor: s.border,
    personBkg: s.surface,
    personBorder: s.border,
    rowOdd: s.code,
    rowEven: s.secondary,
    transitionColor: s.muted,
    transitionLabelColor: s.fg,
    stateLabelColor: s.fg,
    stateBkg: s.surface,
    labelBackgroundColor: s.code,
    compositeBackground: s.secondary,
    altBackground: s.tertiary,
    compositeTitleBackground: s.tertiary,
    compositeBorder: s.border,
    innerEndBackground: s.fg,
    errorBkgColor: s.secondary,
    errorTextColor: s.danger,
    specialStateColor: s.accent,
    scaleLabelColor: s.fg,
    classText: s.fg,
    requirementBackground: s.surface,
    requirementBorderColor: s.border,
    requirementTextColor: s.fg,
    relationColor: s.muted,
    relationLabelBackground: s.code,
    relationLabelColor: s.fg,
    branchLabelColor: s.fg,
    tagLabelColor: s.fg,
    tagLabelBackground: s.code,
    tagLabelBorder: s.border,
    commitLabelColor: s.fg,
    commitLabelBackground: s.code,
    archEdgeColor: s.muted,
    archEdgeArrowColor: s.muted,
    archGroupBorderColor: s.border,
    quadrant1TextFill: s.fg,
    quadrant2TextFill: s.fg,
    quadrant3TextFill: s.fg,
    quadrant4TextFill: s.fg,
    quadrantPointTextFill: s.fg,
    quadrantXAxisTextFill: s.fg,
    quadrantYAxisTextFill: s.fg,
    quadrantTitleFill: s.accent,
    pieTitleTextColor: s.accent,
    pieSectionTextColor: pieSectionText,
    pieLegendTextColor: s.fg,
    pieStrokeColor: pieSectionText,
    vennTitleTextColor: s.accent,
    vennSetTextColor: s.fg,
    wardleyEvolutionColor: s.accent,
    xyChart: {
      titleColor: s.accent,
      dataLabelColor: s.fg,
      xAxisTitleColor: s.fg,
      xAxisLabelColor: s.fg,
      xAxisTickColor: s.muted,
      xAxisLineColor: s.muted,
      yAxisTitleColor: s.fg,
      yAxisLabelColor: s.fg,
      yAxisTickColor: s.muted,
      yAxisLineColor: s.muted,
      plotColorPalette: `${s.accent},${s.accentHover},${s.muted},${s.danger}`,
    },
    packet: {
      startByteColor: s.fg,
      endByteColor: s.fg,
      labelColor: s.fg,
      titleColor: s.accent,
      blockStrokeColor: s.border,
      blockFillColor: s.surface,
    },
    wardley: {
      axisTextColor: s.fg,
      componentLabelColor: s.fg,
      annotationTextColor: s.fg,
    },
  };
}

/** Fingerprint of theme colors that affect Mermaid output (for diagram cache keys). */
export function getMermaidThemeFingerprint(): string {
  const appearance = getMermaidRenderAppearance();
  if (typeof document === "undefined") return appearance;
  const styles = getComputedStyle(document.documentElement);
  const parts = MERMAID_THEME_CSS_VARS.map((name) => styles.getPropertyValue(name).trim());
  return `${appearance}\u0000${parts.join("\u0001")}`;
}

export function mermaidConfigForAppearance(
  appearance: MermaidRenderAppearance = getMermaidRenderAppearance(),
) {
  return {
    startOnLoad: false as const,
    securityLevel: "strict" as const,
    suppressErrorRendering: true as const,
    theme: "base" as const,
    themeVariables: buildMermaidThemeVariables(appearance),
  };
}

function shouldPadMermaidNewline(prev: string | undefined, next: string | undefined): boolean {
  return prev === ">" && next === "|";
}

export function normalizeMermaidSourceForRender(code: string): string {
  let out = "";
  for (let i = 0; i < code.length; i++) {
    const char = code[i]!;
    if (char !== "\n") {
      out += char;
      continue;
    }
    const prev = out.at(-1);
    const next = code[i + 1];
    const pad = shouldPadMermaidNewline(prev, next);
    if (pad) out += " ";
    out += "\n";
    if (pad) out += " ";
  }
  return out;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    globalThis.setTimeout(() => reject(new Error("Mermaid rendering timed out")), ms);
  });
}

export function createMermaidRenderer(load: MermaidLoader, timeoutMs = RENDER_TIMEOUT_MS) {
  let mermaidPromise: Promise<MermaidLike> | null = null;
  const getMermaid = async (): Promise<MermaidLike> => {
    if (!mermaidPromise) mermaidPromise = load();
    return mermaidPromise;
  };

  return {
    async render(code: string): Promise<MermaidRenderState> {
      try {
        const result = await Promise.race([
          (async () => {
            const mermaid = await getMermaid();
            mermaid.initialize(mermaidConfigForAppearance());
            return mermaid.render(
              `typora-web-mermaid-${++renderSeq}`,
              normalizeMermaidSourceForRender(code),
            );
          })(),
          timeout(timeoutMs),
        ]);
        if (!result.svg || result.svg.length < 32 || MERMAID_ERROR_SVG_RE.test(result.svg)) {
          return { state: "error", message: "Mermaid syntax error" };
        }
        return { state: "success", svg: result.svg };
      } catch (error) {
        return {
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export const mermaidRenderer = createMermaidRenderer(async () => {
  const mod = await import("mermaid");
  return mod.default as MermaidLike;
});
