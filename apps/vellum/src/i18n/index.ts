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
      account: "Aliyun login and your own OSS",
      appearance: "Theme and language",
      editor: "Editor preferences",
      about: "About Vellum",
    },
    account: {
      loginTitle: "Aliyun account",
      login: "Sign in with Aliyun",
      logout: "Sign out",
      signedOut: "Not signed in.",
      signedInAs: "Signed in as {{name}}",
      unknownUser: "Aliyun user",
      loginHint:
        "Opens an in-app Aliyun main-account login window. Login identifies you; OSS still needs your own AccessKey.",
      blankPageHint:
        "Login opens inside Vellum (avoids blank pages in Arc/Chrome). If needed, also allow *.alicdn.com in any external browser you use.",
      adopt: "Use {{app}} session ({{name}})",
      ossTitle: "Object Storage (OSS)",
      ossHint:
        "Use a bucket you own. Credentials are stored in an encrypted local vault shared with other Dionysen apps.",
      endpoint: "Endpoint",
      bucket: "Bucket",
      accessKeyId: "AccessKey ID",
      accessKeySecret: "AccessKey Secret",
      prefix: "Key prefix",
      secretKeep: "Leave blank to keep current secret",
      secretRequired: "Required",
      saveOss: "Save OSS settings",
      testOss: "Test read / write",
      ossSaved: "OSS settings saved.",
      testOk: "Put / get / delete succeeded. Listed {{count}} object(s) under the prefix.",
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
      body: "A minimal Dionysen writing shell with Pure Writer library support. Optional Aliyun login and your own OSS for cloud storage.",
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
      account: "阿里云登录与自有 OSS",
      appearance: "主题与语言",
      editor: "编辑器偏好",
      about: "关于 Vellum",
    },
    account: {
      loginTitle: "阿里云账号",
      login: "使用阿里云登录",
      logout: "退出登录",
      signedOut: "尚未登录。",
      signedInAs: "已登录：{{name}}",
      unknownUser: "阿里云用户",
      loginHint:
        "将在应用内打开阿里云主账号登录窗口。登录只用于识别身份；读写云盘仍需填写你自己的 AccessKey。",
      blankPageHint:
        "登录会在 Vellum 内嵌窗口打开（避免 Arc/Chrome 空白页）。若仍异常，请确认能访问 *.alicdn.com。",
      adopt: "使用 {{app}} 的登录（{{name}}）",
      ossTitle: "对象存储（OSS）",
      ossHint:
        "使用你自己的 Bucket。凭据保存在本地加密库中，可与其他 Dionysen 应用共享探测。",
      endpoint: "Endpoint",
      bucket: "Bucket",
      accessKeyId: "AccessKey ID",
      accessKeySecret: "AccessKey Secret",
      prefix: "对象前缀",
      secretKeep: "留空则保留当前密钥",
      secretRequired: "必填",
      saveOss: "保存 OSS 配置",
      testOss: "测试读写",
      ossSaved: "OSS 配置已保存。",
      testOk: "上传 / 下载 / 删除成功。当前前缀下列出 {{count}} 个对象。",
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
      body: "基于 Dionysen 的轻量写作壳，兼容纯纯写作本地库。可选阿里云登录，并用你自己的 OSS 做云端存储。",
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
