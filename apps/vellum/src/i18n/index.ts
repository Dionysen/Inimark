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
    openLibrary: "Open library",
    pickTitle: "Open Pure Writer library",
    openHint: "Use the library bar below to open a Pure Writer folder.",
    libraries: "Libraries",
    noLibrary: "No library",
    noneSaved: "No saved libraries yet",
    add: "Add library",
    close: "Close library",
    closed: "Library closed",
    missingRecord: "That library is no longer in the list",
    openSettings: "Open settings",
    newArticle: "New",
    newChapter: "New",
    save: "Save",
    needPath: "Choose a Pure Writer library folder",
    opening: "Opening…",
    opened: "Library opened",
    openedEmpty: "Library opened · no books yet",
    openedWithCount: "Opened · {{count}} chapters in this book",
    openedReadonly: "Library opened (read-only — schema mismatch)",
    saved: "Saved",
    noBook: "No book",
    folders: "Folders",
    volumesAndChapters: "Volumes & chapters ({{count}})",
    volumeChapterSummary: "{{volumes}} volumes · {{chapters}} chapters",
    uncategorized: "Uncategorized",
    treeAria: "Volumes and chapters",
    articles: "Articles ({{count}})",
    noArticles: "No articles in this folder",
    noChapters: "No chapters in this book",
    noChaptersInVolume: "No chapters in this volume",
    schemaMismatch:
      "Schema mismatch ({{found}}). Edit App/.vellum-purewriter.json to allow writes.",
  },
  common: {
    settings: "Settings",
    close: "Close",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
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
        "Sign in with GitHub or Gitee. Then choose a private repo name to store .pwb backups.",
      needClientId:
        "OAuth client_id is empty — set it in apps/vellum/src/git-sync/config.ts (see packages/git-sync/README.md).",
      repoNeedInit:
        "Choose a private repository name (created under your account on first init), then push the first backup.",
      repoInit: "Create repo & push",
      repoBound: "Repository: {{repo}}",
      lastSync: "Last sync: {{time}}",
      neverSynced: "never",
      syncNow: "Sync now",
      restoreBackup: "Restore backup",
      syncing: "Syncing…",
      syncHint:
        "Sync now exports the open library as a .pwb and uploads it. Restore lists cloud backups. Open a Pure Writer library first.",
      pushOk: "Pushed {{path}} · remote backups: {{remote}}",
      restoreTitle: "Cloud backups",
      restoreLoading: "Loading backups…",
      restoreEmpty: "No remote backups yet.",
      restoreClose: "Close",
      restoreMeta: "Device {{device}} · {{size}} · {{articles}} articles · {{words}} words",
      restoreMerge: "Merge",
      restoreOverwrite: "Overwrite",
      restoreOverwriteConfirm:
        "Overwrite will replace the local Room.db with this backup. Continue?",
      restoreDone: "Restore finished.",
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
  syncStatus: {
    idle: "Not synced",
    syncing: "Syncing…",
    ok: "Synced",
    error: "Sync error: {{error}}",
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
    openLibrary: "打开文库",
    pickTitle: "打开纯纯写作文库",
    openHint: "点击下方文库栏，打开一个纯纯写作文件夹。",
    libraries: "文库",
    noLibrary: "未打开文库",
    noneSaved: "还没有保存的文库",
    add: "添加文库",
    close: "关闭文库",
    closed: "已关闭文库",
    missingRecord: "该文库已不在列表中",
    openSettings: "打开设置",
    newArticle: "新建",
    newChapter: "新建",
    save: "保存",
    needPath: "请选择纯纯写作文库文件夹",
    opening: "正在打开…",
    opened: "已打开文库",
    openedEmpty: "已打开文库 · 尚无书籍",
    openedWithCount: "已打开 · 当前书 {{count}} 章",
    openedReadonly: "已打开文库（只读 — Schema 不匹配）",
    saved: "已保存",
    noBook: "未选书",
    folders: "文件夹",
    volumesAndChapters: "卷与章（{{count}}）",
    volumeChapterSummary: "{{volumes}}卷 {{chapters}}章",
    uncategorized: "未分卷",
    treeAria: "卷与章",
    articles: "文章（{{count}}）",
    noArticles: "此文件夹没有文章",
    noChapters: "此书没有章节",
    noChaptersInVolume: "此卷没有章节",
    schemaMismatch:
      "Schema 不匹配（{{found}}）。请编辑 App/.vellum-purewriter.json 以允许写入。",
  },
  common: {
    settings: "设置",
    close: "关闭",
    collapseSidebar: "折叠侧边栏",
    expandSidebar: "展开侧边栏",
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
        "使用 GitHub 或 Gitee 登录后，选择私有仓库名称来存放 .pwb 备份。",
      needClientId:
        "OAuth client_id 为空 — 请在 apps/vellum/src/git-sync/config.ts 中填写（见 packages/git-sync/README.md）。",
      repoNeedInit:
        "请填写私有仓库名称（首次初始化时会在你的账号下创建），然后推送第一份备份。",
      repoInit: "创建仓库并推送",
      repoBound: "仓库：{{repo}}",
      lastSync: "上次同步：{{time}}",
      neverSynced: "从未",
      syncNow: "立即同步",
      restoreBackup: "恢复备份",
      syncing: "正在同步…",
      syncHint:
        "「立即同步」会把当前打开的文档库导出为 .pwb 并上传。「恢复备份」可从云端列表选择覆盖或合并。请先打开纯纯写作库。",
      pushOk: "已推送 {{path}} · 远端备份 {{remote}} 份",
      restoreTitle: "云端备份",
      restoreLoading: "正在加载备份列表…",
      restoreEmpty: "还没有云端备份。",
      restoreClose: "关闭",
      restoreMeta: "设备 {{device}} · {{size}} · {{articles}} 篇文章 · {{words}} 字",
      restoreMerge: "合并",
      restoreOverwrite: "覆盖",
      restoreOverwriteConfirm: "覆盖会用该备份替换本地 Room.db，确定继续？",
      restoreDone: "恢复完成。",
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
  syncStatus: {
    idle: "未同步",
    syncing: "正在同步…",
    ok: "已同步",
    error: "同步出错：{{error}}",
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
