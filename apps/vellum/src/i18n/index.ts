import { createI18n, detectSystemLocale, type Dictionary } from "@dionysen/i18n";

export type LocaleId = "en" | "zh-CN";

const en: Dictionary = {
  app: {
    name: "Vellum",
    untitled: "Untitled",
  },
  editor: {
    placeholder: "Start writing…",
  },
  library: {
    pathPlaceholder: "Pure Writer folder (contains App/Room.db)",
    open: "Open",
    newArticle: "New",
    save: "Save",
    needPath: "Enter a Pure Writer library path",
    opening: "Opening…",
    opened: "Library opened",
    openedWithCount: "Opened · {{count}} articles in this folder",
    openedReadonly: "Library opened (read-only — schema mismatch)",
    saved: "Saved",
    folders: "Folders",
    articles: "Articles ({{count}})",
    noArticles: "No articles in this folder",
    schemaMismatch:
      "Schema mismatch ({{found}}). Edit App/.vellum-purewriter.json to allow writes.",
  },
  common: {
    settings: "Settings",
    close: "Close",
  },
  settings: {
    search: "Search settings",
    noMatch: "No matching settings",
    focusSearch: "Focus search",
    nav: {
      appearance: "Appearance",
      editor: "Editor",
      about: "About",
    },
    subtitle: {
      appearance: "Theme and language",
      editor: "Editor preferences",
      about: "About Vellum",
    },
    appearance: {
      locale: "Language",
      localeDesc: "UI language",
      theme: "Theme",
      themeDesc: "Light or dark appearance",
      themeLight: "Light",
      themeDark: "Dark",
    },
    editor: {
      fontSize: "Font size",
      fontSizeDesc: "Editor text size",
    },
    about: {
      title: "Vellum",
      body: "A minimal Dionysen writing shell with Pure Writer library support.",
      version: "Version {{version}}",
    },
  },
};

const zhCN: Dictionary = {
  app: {
    name: "Vellum",
    untitled: "未命名",
  },
  editor: {
    placeholder: "开始写作…",
  },
  library: {
    pathPlaceholder: "纯纯写作文件夹（含 App/Room.db）",
    open: "打开",
    newArticle: "新建",
    save: "保存",
    needPath: "请输入纯纯写作库路径",
    opening: "正在打开…",
    opened: "已打开文档库",
    openedWithCount: "已打开 · 当前文件夹 {{count}} 篇文章",
    openedReadonly: "已打开文档库（只读 — Schema 不匹配）",
    saved: "已保存",
    folders: "文件夹",
    articles: "文章（{{count}}）",
    noArticles: "此文件夹没有文章",
    schemaMismatch:
      "Schema 不匹配（{{found}}）。请编辑 App/.vellum-purewriter.json 以允许写入。",
  },
  common: {
    settings: "设置",
    close: "关闭",
  },
  settings: {
    search: "搜索设置",
    noMatch: "没有匹配的设置",
    focusSearch: "聚焦搜索",
    nav: {
      appearance: "外观",
      editor: "编辑器",
      about: "关于",
    },
    subtitle: {
      appearance: "主题与语言",
      editor: "编辑器偏好",
      about: "关于 Vellum",
    },
    appearance: {
      locale: "语言",
      localeDesc: "界面语言",
      theme: "主题",
      themeDesc: "浅色或深色外观",
      themeLight: "浅色",
      themeDark: "深色",
    },
    editor: {
      fontSize: "字号",
      fontSizeDesc: "编辑器文字大小",
    },
    about: {
      title: "Vellum",
      body: "基于 Dionysen 的轻量写作壳，兼容纯纯写作本地库。",
      version: "版本 {{version}}",
    },
  },
};

function isLocaleId(value: string | null | undefined): value is LocaleId {
  return value === "en" || value === "zh-CN";
}

function detectVellumSystemLocale(): LocaleId {
  return detectSystemLocale((lang) => {
    if (lang.toLowerCase().startsWith("zh")) return "zh-CN" as const;
    return "en" as const;
  }, "en");
}

const i18n = createI18n<LocaleId>({
  catalogs: { en, "zh-CN": zhCN },
  fallbackLocale: "en",
  storageKey: "vellum-locale",
  changeEvent: "vellum:localechange",
  isLocaleId,
  detectSystem: detectVellumSystemLocale,
});

export const {
  initI18n,
  resolveLocale,
  getLocale,
  setLocale,
  t,
  onLocaleChange,
} = i18n;

export { detectVellumSystemLocale as detectSystemLocale };
