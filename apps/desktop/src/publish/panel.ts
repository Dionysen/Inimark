import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n/index.ts";
import { listLibraries, type LibraryRecord } from "../libraries/store.ts";
import { isTauri } from "../platform/env.ts";
import { openExternalUrl } from "../platform/open-url.ts";
import { BUILTIN_THEMES } from "../themes/builtin.ts";
import { loadManifest } from "../themes/custom-theme-manager.ts";
import {
  createButton,
  createSelect,
  createTextField,
  type SelectController,
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

export function mountPublishPanel(host: HTMLElement): PublishPanelController {
  host.classList.add("inimark-settings-publish");

  /** Last loaded file config; form only edits a subset of fields. */
  let lastLoadedConfig: PublishConfig | null = null;
  let themeOptions: Array<{ value: string; label: string }> = BUILTIN_THEMES.map((id) => ({
    value: id,
    label: id,
  }));

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
  const homeField = createTextField({ value: "" });

  const lightThemeHost = document.createElement("div");
  const darkThemeHost = document.createElement("div");
  let lightThemeSelect: SelectController | null = null;
  let darkThemeSelect: SelectController | null = null;
  let lightThemeValue = "light";
  let darkThemeValue = "dark";

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

  function rebuildThemeSelects(): void {
    const options = themeOptions.length
      ? themeOptions
      : BUILTIN_THEMES.map((id) => ({ value: id, label: id }));
    if (!options.some((o) => o.value === lightThemeValue)) {
      lightThemeValue = options.find((o) => o.value === "light")?.value ?? options[0]!.value;
    }
    if (!options.some((o) => o.value === darkThemeValue)) {
      darkThemeValue = options.find((o) => o.value === "dark")?.value ?? options[0]!.value;
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
      homeField.setValue("");
      lightThemeValue = "light";
      darkThemeValue = "dark";
      rebuildThemeSelects();
      return;
    }
    const cfg = await loadPublishConfig(lib.rootPath);
    lastLoadedConfig = cfg;
    siteNameField.setValue(cfg.siteName);
    outField.setValue(cfg.out || "dist");
    baseHrefField.setValue(cfg.baseHref || "/");
    homeField.setValue(cfg.home || "");
    lightThemeValue = cfg.lightTheme || "light";
    darkThemeValue = cfg.darkTheme || "dark";
    if (!cfg.lightTheme && !cfg.darkTheme && cfg.defaultTheme) {
      if (/dark/i.test(cfg.defaultTheme)) darkThemeValue = cfg.defaultTheme;
      else lightThemeValue = cfg.defaultTheme;
    }
    rebuildThemeSelects();
  }

  /**
   * Merge editable form fields onto the last loaded config so optional keys
   * (e.g. `locales`, `siteDescription`) are not wiped on save.
   */
  function readFormConfig(): PublishConfig {
    const lib = selectedLibrary();
    const base = lastLoadedConfig ?? {
      siteName: lib?.rootName || "Notes",
      defaultTheme: "dark",
      lightTheme: "light",
      darkTheme: "dark",
      baseHref: "/",
      out: "dist",
    };
    return {
      ...base,
      siteName: siteNameField.getValue().trim() || lib?.rootName || "Notes",
      baseHref: baseHrefField.getValue().trim() || "/",
      out: outField.getValue().trim() || "dist",
      home: homeField.getValue().trim() || undefined,
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
    makeRow("publish.home", "settings.publish.home", "settings.publish.homeDesc", homeField.el),
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
      librarySelect?.destroy();
      lightThemeSelect?.destroy();
      darkThemeSelect?.destroy();
      siteNameField.destroy();
      outField.destroy();
      baseHrefField.destroy();
      homeField.destroy();
      host.replaceChildren();
    },
  };
}
