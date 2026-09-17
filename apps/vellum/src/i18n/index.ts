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
      account: "Account",
      appearance: "Appearance",
      editor: "Editor",
      about: "About",
    },
    subtitle: {
      account: "GitHub / Gitee PWB sync",
      appearance: "Theme and language",
      editor: "Editor preferences",
      about: "About Vellum",
    },
    account: {
      loginTitle: "Cloud sync",
      loginGithub: "Sign in with GitHub",
      loginGitee: "Sign in with Gitee",
      logout: "Sign out",
      signedOut: "Not signed in.",
      signedInAs: "Signed in as {{name}}",
      unknownUser: "Git user",
      loginHint:
        "Sign in once. Vellum creates a private repo and syncs Pure Writer .pwb backups automatically.",
      needClientId:
        "OAuth client_id is empty — set it in apps/vellum/src/git-sync/config.ts (see packages/git-sync/README.md).",
      repoBound: "Repository: {{repo}}",
      lastSync: "Last sync: {{time}}",
      neverSynced: "never",
      syncNow: "Sync now",
      syncHint:
        "Sync downloads remote .pwb backups, merges into the open library, then uploads a new snapshot when local data changed. Open a Pure Writer library first.",
      syncOk:
        "Sync done — pulled {{pulled}} backup(s), pushed {{pushed}}, remote now has {{remote}}.",
      loadFailed: "Could not load account state: {{error}}",
      tauriOnly: "Cloud sync requires the desktop app.",
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
      body: "A minimal Dionysen writing shell with Pure Writer library support. Optional GitHub/Gitee login syncs .pwb backups to a private repo.",
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
      account: "账号",
      appearance: "外观",
      editor: "编辑器",
      about: "关于",
    },
    subtitle: {
      account: "GitHub / Gitee 同步 .pwb",
      appearance: "主题与语言",
      editor: "编辑器偏好",
      about: "关于 Vellum",
    },
    account: {
      loginTitle: "云同步",
      loginGithub: "使用 GitHub 登录",
      loginGitee: "使用 Gitee 登录",
      logout: "退出登录",
      signedOut: "尚未登录。",
      signedInAs: "已登录：{{name}}",
      unknownUser: "Git 用户",
      loginHint:
        "登录一次即可。Vellum 会创建私有仓库，并自动同步纯纯写作的 .pwb 备份。",
      needClientId:
        "OAuth client_id 为空 — 请在 apps/vellum/src/git-sync/config.ts 中填写（见 packages/git-sync/README.md）。",
      repoBound: "仓库：{{repo}}",
      lastSync: "上次同步：{{time}}",
      neverSynced: "从未",
      syncNow: "立即同步",
      syncHint:
        "同步会下载远端 .pwb、合并进当前打开的文档库，并在本地有变更时追加上传新快照。请先打开纯纯写作库。",
      syncOk:
        "同步完成 — 拉取 {{pulled}} 份备份，推送 {{pushed}}，远端现有 {{remote}} 份。",
      loadFailed: "无法加载账号状态：{{error}}",
      tauriOnly: "云同步仅在桌面应用中可用。",
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
      body: "基于 Dionysen 的轻量写作壳，兼容纯纯写作本地库。可选 GitHub/Gitee 登录，将 .pwb 备份同步到私有仓库。",
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
