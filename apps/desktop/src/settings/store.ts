export type EditorWidth = "narrow" | "medium" | "wide" | "full";
export type AppearanceMode = "light" | "dark" | "system";

export interface AppSettings {
  fontSize: number;
  editorWidth: EditorWidth;
  appearance: AppearanceMode;
}

export const SETTINGS_STORAGE_KEY = "inimark:settings";

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 16,
  editorWidth: "medium",
  appearance: "light",
};

const EDITOR_WIDTHS: Record<EditorWidth, string> = {
  narrow: "36rem",
  medium: "48rem",
  wide: "60rem",
  full: "100%",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      fontSize: clampFontSize(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize),
      editorWidth: isEditorWidth(parsed.editorWidth)
        ? parsed.editorWidth
        : DEFAULT_SETTINGS.editorWidth,
      appearance: isAppearance(parsed.appearance)
        ? parsed.appearance
        : DEFAULT_SETTINGS.appearance,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.style.setProperty("--inimark-editor-font-size", `${settings.fontSize}px`);
  root.style.setProperty(
    "--inimark-editor-max-width",
    EDITOR_WIDTHS[settings.editorWidth],
  );
}

export function resolveAppearance(mode: AppearanceMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function editorWidthLabel(width: EditorWidth): string {
  switch (width) {
    case "narrow":
      return "Narrow (36rem)";
    case "medium":
      return "Medium (48rem)";
    case "wide":
      return "Wide (60rem)";
    case "full":
      return "Full width";
  }
}

function clampFontSize(value: number): number {
  return Math.min(22, Math.max(13, Math.round(value)));
}

function isEditorWidth(value: unknown): value is EditorWidth {
  return value === "narrow" || value === "medium" || value === "wide" || value === "full";
}

function isAppearance(value: unknown): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}
