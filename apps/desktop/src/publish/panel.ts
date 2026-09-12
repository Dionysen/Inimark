import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n/index.ts";
import { listLibraries, type LibraryRecord } from "../libraries/store.ts";
import { isMarkdownFile, isTauri } from "../platform/env.ts";
import { openExternalUrl } from "../platform/open-url.ts";
import { openWorkspaceByPath } from "../platform/workspace.ts";
import { collectMarkdownFiles } from "../sidebar/vault-search.ts";
import { BUILTIN_THEMES, DEFAULT_DARK_BUILTIN } from "../themes/builtin.ts";
import { loadManifest } from "../themes/custom-theme-manager.ts";
import {
  createButton,
  createSelect,
  createTextField,
  type SelectController,
  type SelectOption,
} from "../ui/widgets/index.ts";
import { loadPublishConfig, savePublishConfig, type PublishConfig } from "./config.ts";
import {
  publishLibrary,
  startSitePreview,
  stopSitePreview,
  type PublishProgress,
} from "./service.ts";

export interface PublishPanelController {
  refresh(): void;
  destroy(): void;
}

const SKIP_HOME_DIR_NAMES = new Set([
  ".git",
  ".obsidian",
  ".inimark",
  "node_modules",
  "dist",
]);

function homeNoteOptions(
  files: Array<{ name: string; path: string }>,
  outRel: string,
  currentHome: string,
): SelectOption[] {
  const outNorm = outRel.replace(/\\/g, "/").replace(/\/$/, "") || "dist";
  const options: SelectOption[] = [
    { value: "", label: t("settings.publish.homeDefault") },
  ];
  const seen = new Set<string>([""]);

  for (const file of files) {
    if (!isMarkdownFile(file.name)) continue;
    const path = file.path.replace(/\\/g, "/");
    if (path === outNorm || path.startsWith(`${outNorm}/`)) continue;
    if (path.split("/").some((part) => SKIP_HOME_DIR_NAMES.has(part))) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    options.push({ value: path, label: path });
  }

  options.sort((a, b) => {
    if (a.value === "") return -1;
    if (b.value === "") return 1;
    return a.label.localeCompare(b.label);
  });

  if (currentHome && !seen.has(currentHome)) {
    options.splice(1, 0, { value: currentHome, label: currentHome });
  }

  return options;
}

export function mountPublishPanel(host: HTMLElement): PublishPanelController {
  host.classList.add("inimark-settings-publish");

  /** Last loaded file config; form only edits a subset of fields. */
  let lastLoadedConfig: PublishConfig | null = null;
  let themeOptions: Array<{ value: string; label: string }> = BUILTIN_THEMES.map((id) => ({
    value: id,
    label: id,
  }));
  let homeNoteLoadToken = 0;

  const libraryRow = document.createElement("div");
  libraryRow.className = "inimark-settings-row";
  libraryRow.dataset.settingId = "publish.library";
  const libraryMeta = document.createElement("div");
  libraryMeta.className = "inimark-settings-row-meta";
  const libraryTitle = document.createElement("div");
  libraryTitle.className = "inimark-settings-row-title";
  const libraryDesc = document.createElement("p");
  libraryDesc.className = "inimark-settings-row-desc";
  libraryMeta.append(libraryTitle, libraryDesc);
  const librarySelectHost = document.createElement("div");
  librarySelectHost.className = "inimark-settings-row-control";
  libraryRow.append(libraryMeta, librarySelectHost);

  const siteNameField = createTextField({ value: "" });
  const outField = createTextField({ value: "dist" });
  const baseHrefField = createTextField({ value: "/" });
  const homeSelectHost = document.createElement("div");
  let homeSelect: SelectController | null = null;
  let homeValue = "";

  const lightThemeHost = document.createElement("div");
  const darkThemeHost = document.createElement("div");
  let lightThemeSelect: SelectController | null = null;
  let darkThemeSelect: SelectController | null = null;
  let lightThemeValue = "light";
  let darkThemeValue: string = DEFAULT_DARK_BUILTIN;

  function makeRow(
    settingId: string,
    titleKey: string,
    descKey: string,
    control: HTMLElement,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "inimark-settings-row";
    row.dataset.settingId = settingId;
    const meta = document.createElement("div");
    meta.className = "inimark-settings-row-meta";
    const title = document.createElement("div");
    title.className = "inimark-settings-row-title";
    title.dataset.i18n = titleKey;
    const desc = document.createElement("p");
    desc.className = "inimark-settings-row-desc";
    desc.dataset.i18n = descKey;
    meta.append(title, desc);
    const wrap = document.createElement("div");
    wrap.className = "inimark-settings-row-control";
    wrap.append(control);
    row.append(meta, wrap);
    return row;
  }

  const status = document.createElement("p");
  status.className = "inimark-settings-publish-status";

  const actions = document.createElement("div");
  actions.className = "inimark-settings-publish-actions";

  let libraries: LibraryRecord[] = [];
  let selectedId: string | null = null;
  let lastOutDir: string | null = null;
  let busy = false;
  let librarySelect: SelectController | null = null;

  const publishBtn = createButton({
    label: "",
    variant: "primary",
    onClick: () => {
      void runPublish();
    },
  });
  const previewBtn = createButton({
    label: "",
    onClick: () => {
      void runPreview();
    },
  });
  const openDirBtn = createButton({
    label: "",
    onClick: () => {
      if (!lastOutDir || !isTauri()) return;
      void invoke("reveal_in_file_manager", { path: lastOutDir });
    },
  });
  const stopPreviewBtn = createButton({
    label: "",
    onClick: () => {
      void stopSitePreview().then(() => {
        status.textContent = t("settings.publish.previewStopped");
      });
    },
  });

  actions.append(publishBtn, previewBtn, openDirBtn, stopPreviewBtn);

  function selectedLibrary(): LibraryRecord | null {
    return libraries.find((l) => l.id === selectedId) ?? null;
  }

  function rebuildHomeSelect(noteOptions: SelectOption[]): void {
    homeSelect?.destroy();
    homeSelectHost.replaceChildren();
    homeSelect = createSelect({
      options: noteOptions,
      value: homeValue,
      searchable: true,
      matchTriggerWidth: true,
      searchPlaceholder: t("settings.publish.homeSearch"),
      emptyMessage: t("settings.publish.homeNoMatch"),
      onChange: (value) => {
        homeValue = value;
      },
    });
    homeSelectHost.append(homeSelect.el);
  }

  async function refreshHomeNoteOptions(): Promise<void> {
    const token = ++homeNoteLoadToken;
    const lib = selectedLibrary();
    const outRel = outField.getValue().trim() || "dist";
    if (!lib) {
      rebuildHomeSelect(homeNoteOptions([], outRel, homeValue));
      return;
    }

    rebuildHomeSelect([
      { value: "", label: t("settings.publish.homeDefault") },
      ...(homeValue ? [{ value: homeValue, label: homeValue }] : []),
    ]);

    try {
      const opened = await openWorkspaceByPath(lib.rootPath);
      if (token !== homeNoteLoadToken) return;
      if (opened.status !== "picked") {
        rebuildHomeSelect(homeNoteOptions([], outRel, homeValue));
        return;
      }
      const files = collectMarkdownFiles(opened.workspace.tree);
      rebuildHomeSelect(homeNoteOptions(files, outRel, homeValue));
    } catch {
      if (token !== homeNoteLoadToken) return;
      rebuildHomeSelect(homeNoteOptions([], outRel, homeValue));
    }
  }

  function rebuildThemeSelects(): void {
    const options = themeOptions.length
      ? themeOptions
      : BUILTIN_THEMES.map((id) => ({ value: id, label: id }));
    if (!options.some((o) => o.value === lightThemeValue)) {
      lightThemeValue = options.find((o) => o.value === "light")?.value ?? options[0]!.value;
    }
    if (!options.some((o) => o.value === darkThemeValue)) {
      darkThemeValue =
        options.find((o) => o.value === DEFAULT_DARK_BUILTIN)?.value ??
        options.find((o) => /dark|ocean|cursor|dracula/i.test(o.value))?.value ??
        options[0]!.value;
    }

    lightThemeSelect?.destroy();
    darkThemeSelect?.destroy();
    lightThemeHost.replaceChildren();
    darkThemeHost.replaceChildren();

    lightThemeSelect = createSelect({
      options,
      value: lightThemeValue,
      onChange: (value) => {
        lightThemeValue = value;
      },
    });
    darkThemeSelect = createSelect({
      options,
      value: darkThemeValue,
      onChange: (value) => {
        darkThemeValue = value;
      },
    });
    lightThemeHost.append(lightThemeSelect.el);
    darkThemeHost.append(darkThemeSelect.el);
  }

  async function refreshThemeOptions(): Promise<void> {
    const manifests = await loadManifest().catch(() => []);
    themeOptions = [
      ...BUILTIN_THEMES.map((id) => ({ value: id, label: id })),
      ...manifests.map((m) => ({
        value: `custom-${m.id}`,
        label: m.name?.trim() || `custom-${m.id}`,
      })),
    ];
    rebuildThemeSelects();
  }

  async function loadConfigIntoForm(): Promise<void> {
    const lib = selectedLibrary();
    if (!lib) {
      lastLoadedConfig = null;
      siteNameField.setValue("");
      outField.setValue("dist");
      baseHrefField.setValue("/");
      homeValue = "";
      lightThemeValue = "light";
      darkThemeValue = DEFAULT_DARK_BUILTIN;
      rebuildThemeSelects();
      await refreshHomeNoteOptions();
      return;
    }
    const cfg = await loadPublishConfig(lib.rootPath);
    lastLoadedConfig = cfg;
    siteNameField.setValue(cfg.siteName);
    outField.setValue(cfg.out || "dist");
    baseHrefField.setValue(cfg.baseHref || "/");
    homeValue = cfg.home || "";
    lightThemeValue = cfg.lightTheme || "light";
    darkThemeValue = cfg.darkTheme || DEFAULT_DARK_BUILTIN;
    if (!cfg.lightTheme && !cfg.darkTheme && cfg.defaultTheme) {
      if (/dark/i.test(cfg.defaultTheme)) darkThemeValue = cfg.defaultTheme;
      else lightThemeValue = cfg.defaultTheme;
    }
    rebuildThemeSelects();
    await refreshHomeNoteOptions();
  }

  /**
   * Merge editable form fields onto the last loaded config so optional keys
   * (e.g. `locales`, `siteDescription`) are not wiped on save.
   */
  function readFormConfig(): PublishConfig {
    const lib = selectedLibrary();
    const base = lastLoadedConfig ?? {
      siteName: lib?.rootName || "Notes",
      defaultTheme: DEFAULT_DARK_BUILTIN,
      lightTheme: "light",
      darkTheme: DEFAULT_DARK_BUILTIN,
      baseHref: "/",
      out: "dist",
    };
    return {
      ...base,
      siteName: siteNameField.getValue().trim() || lib?.rootName || "Notes",
      baseHref: baseHrefField.getValue().trim() || "/",
      out: outField.getValue().trim() || "dist",
      home: homeValue.trim() || undefined,
      lightTheme: lightThemeValue,
      darkTheme: darkThemeValue,
      defaultTheme: darkThemeValue,
    };
  }

  function rebuildLibrarySelect(): void {
    libraries = listLibraries();
    const options = libraries.length
      ? libraries.map((l) => ({ value: l.id, label: `${l.rootName} — ${l.rootPath}` }))
      : [{ value: "", label: t("settings.publish.noLibrary") }];
    if (!selectedId || !libraries.some((l) => l.id === selectedId)) {
      selectedId = libraries[0]?.id ?? null;
    }
    librarySelect?.destroy();
    librarySelectHost.replaceChildren();
    librarySelect = createSelect({
      options,
      value: selectedId ?? "",
      onChange: (value) => {
        selectedId = value || null;
        void loadConfigIntoForm();
      },
    });
    librarySelectHost.append(librarySelect.el);
  }

  function applyI18n(): void {
    libraryTitle.textContent = t("settings.publish.library");
    libraryDesc.textContent = t("settings.publish.libraryDesc");
    host.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    publishBtn.textContent = t("settings.publish.publish");
    previewBtn.textContent = t("settings.publish.preview");
    openDirBtn.textContent = t("settings.publish.openDir");
    stopPreviewBtn.textContent = t("settings.publish.stopPreview");
  }

  function setBusy(next: boolean): void {
    busy = next;
    publishBtn.disabled = busy;
    previewBtn.disabled = busy || !lastOutDir;
    openDirBtn.disabled = !lastOutDir;
  }

  async function runPublish(): Promise<void> {
    if (busy) return;
    const lib = selectedLibrary();
    if (!lib) {
      status.textContent = t("settings.publish.noLibrary");
      return;
    }
    if (!isTauri()) {
      status.textContent = t("settings.publish.tauriOnly");
      return;
    }
    const config = readFormConfig();
    setBusy(true);
    status.textContent = t("settings.publish.publishing");
    try {
      await savePublishConfig(lib.rootPath, config);
      const result = await publishLibrary(lib.rootPath, config, (p: PublishProgress) => {
        status.textContent = `${p.phase}: ${p.message}`;
      });
      lastOutDir = result.outDir;
      status.textContent = t("settings.publish.done", {
        count: result.pageCount,
        dir: result.outDir,
      });
      previewBtn.disabled = false;
      openDirBtn.disabled = false;
    } catch (e) {
      status.textContent = t("settings.publish.failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(): Promise<void> {
    if (!lastOutDir) {
      status.textContent = t("settings.publish.previewNeedPublish");
      return;
    }
    try {
      const url = await startSitePreview(lastOutDir);
      status.textContent = t("settings.publish.previewReady", { url });
      openExternalUrl(url);
    } catch (e) {
      status.textContent = t("settings.publish.failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  host.replaceChildren(
    libraryRow,
    makeRow(
      "publish.siteName",
      "settings.publish.siteName",
      "settings.publish.siteNameDesc",
      siteNameField.el,
    ),
    makeRow(
      "publish.lightTheme",
      "settings.publish.lightTheme",
      "settings.publish.lightThemeDesc",
      lightThemeHost,
    ),
    makeRow(
      "publish.darkTheme",
      "settings.publish.darkTheme",
      "settings.publish.darkThemeDesc",
      darkThemeHost,
    ),
    makeRow("publish.out", "settings.publish.out", "settings.publish.outDesc", outField.el),
    makeRow(
      "publish.baseHref",
      "settings.publish.baseHref",
      "settings.publish.baseHrefDesc",
      baseHrefField.el,
    ),
    makeRow("publish.home", "settings.publish.home", "settings.publish.homeDesc", homeSelectHost),
    actions,
    status,
  );

  function refresh(): void {
    rebuildLibrarySelect();
    applyI18n();
    void refreshThemeOptions().then(() => loadConfigIntoForm());
    previewBtn.disabled = !lastOutDir;
    openDirBtn.disabled = !lastOutDir;
  }

  refresh();

  return {
    refresh,
    destroy() {
      homeNoteLoadToken += 1;
      librarySelect?.destroy();
      lightThemeSelect?.destroy();
      darkThemeSelect?.destroy();
      homeSelect?.destroy();
      siteNameField.destroy();
      outField.destroy();
      baseHrefField.destroy();
      host.replaceChildren();
    },
  };
}
