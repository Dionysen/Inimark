import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { openExternalUrl } from "../platform/open-url.ts";
import { DEFAULT_CODE_THEME_PAIR } from "../themes/appearance.ts";
import { BUILTIN_THEMES, DEFAULT_DARK_BUILTIN } from "../themes/builtin.ts";
import { CODE_THEMES } from "../themes/code-themes.ts";
import {
  loadCodeThemeManifest,
  loadManifest,
} from "../themes/custom-theme-manager.ts";
import {
  createButton,
  createSelect,
  type SelectController,
  type SelectOption,
} from "../ui/widgets/index.ts";
import { createCollapsibleSettingsGroup } from "./collapsible-group.ts";
import { loadPublishConfig, savePublishConfig, type PublishConfig } from "../publish/config.ts";
import { docsDistDir } from "../publish/docs-path.ts";
import {
  publishLibrary,
  startSitePreview,
  stopSitePreview,
  type PublishProgress,
} from "../publish/service.ts";

export interface DevDocsPublishPanelController {
  el: HTMLElement;
  destroy(): void;
}

function createRow(
  title: string,
  description: string,
  control: HTMLElement,
  settingId?: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "inimark-settings-row";
  if (settingId) row.dataset.settingId = settingId;

  const meta = document.createElement("div");
  meta.className = "inimark-settings-row-meta";
  const heading = document.createElement("div");
  heading.className = "inimark-settings-row-title";
  heading.textContent = title;
  meta.append(heading);
  if (description) {
    const desc = document.createElement("p");
    desc.className = "inimark-settings-row-desc";
    desc.textContent = description;
    meta.append(desc);
  }
  const ctrl = document.createElement("div");
  ctrl.className = "inimark-settings-row-control";
  ctrl.append(control);
  row.append(meta, ctrl);
  return row;
}

function pickOptionValue(
  options: SelectOption[],
  current: string,
  preferred: string,
): string {
  if (options.some((o) => o.value === current)) return current;
  if (options.some((o) => o.value === preferred)) return preferred;
  return options[0]?.value ?? preferred;
}

/**
 * Dev-only docs build: same `publishLibrary` pipeline as Settings → Publish.
 * When `docs/landing/index.html` exists, the build overlays a marketing homepage
 * on the site root (and `en/`). Deploy with CLI: `pnpm docs:deploy`.
 */
export function mountDevDocsPublishPanel(): DevDocsPublishPanelController {
  const root = document.createElement("div");
  root.className = "inimark-settings-dev-docs";

  const pathStatus = document.createElement("p");
  pathStatus.className = "inimark-settings-publish-status";

  const status = document.createElement("p");
  status.className = "inimark-settings-publish-status";

  const lightThemeHost = document.createElement("div");
  const darkThemeHost = document.createElement("div");
  const lightCodeHost = document.createElement("div");
  const darkCodeHost = document.createElement("div");

  let lightThemeSelect: SelectController | null = null;
  let darkThemeSelect: SelectController | null = null;
  let lightCodeSelect: SelectController | null = null;
  let darkCodeSelect: SelectController | null = null;

  let docsVault: string | null = null;
  let lastConfig: PublishConfig | null = null;
  let lastOutDir: string | null = null;
  let busy = false;

  let lightThemeValue = "light";
  let darkThemeValue: string = DEFAULT_DARK_BUILTIN;
  let lightCodeValue = DEFAULT_CODE_THEME_PAIR.light;
  let darkCodeValue = DEFAULT_CODE_THEME_PAIR.dark;

  let themeOptions: SelectOption[] = BUILTIN_THEMES.map((id) => ({
    value: id,
    label: id,
  }));
  let lightCodeOptions: SelectOption[] = CODE_THEMES.filter((t) => !t.isDark).map((t) => ({
    value: t.id,
    label: t.name,
  }));
  let darkCodeOptions: SelectOption[] = CODE_THEMES.filter((t) => t.isDark).map((t) => ({
    value: t.id,
    label: t.name,
  }));

  function rebuildAppThemeSelects(): void {
    lightThemeValue = pickOptionValue(themeOptions, lightThemeValue, "light");
    darkThemeValue = pickOptionValue(themeOptions, darkThemeValue, DEFAULT_DARK_BUILTIN);
    lightThemeSelect?.destroy();
    darkThemeSelect?.destroy();
    lightThemeHost.replaceChildren();
    darkThemeHost.replaceChildren();
    lightThemeSelect = createSelect({
      options: themeOptions,
      value: lightThemeValue,
      onChange: (v) => {
        lightThemeValue = v;
      },
    });
    darkThemeSelect = createSelect({
      options: themeOptions,
      value: darkThemeValue,
      onChange: (v) => {
        darkThemeValue = v;
      },
    });
    lightThemeHost.append(lightThemeSelect.el);
    darkThemeHost.append(darkThemeSelect.el);
  }

  function rebuildCodeThemeSelects(): void {
    lightCodeValue = pickOptionValue(
      lightCodeOptions,
      lightCodeValue,
      DEFAULT_CODE_THEME_PAIR.light,
    );
    darkCodeValue = pickOptionValue(
      darkCodeOptions,
      darkCodeValue,
      DEFAULT_CODE_THEME_PAIR.dark,
    );
    lightCodeSelect?.destroy();
    darkCodeSelect?.destroy();
    lightCodeHost.replaceChildren();
    darkCodeHost.replaceChildren();
    lightCodeSelect = createSelect({
      options: lightCodeOptions,
      value: lightCodeValue,
      onChange: (v) => {
        lightCodeValue = v;
      },
    });
    darkCodeSelect = createSelect({
      options: darkCodeOptions,
      value: darkCodeValue,
      onChange: (v) => {
        darkCodeValue = v;
      },
    });
    lightCodeHost.append(lightCodeSelect.el);
    darkCodeHost.append(darkCodeSelect.el);
  }

  function readFormConfig(): PublishConfig {
    const base = lastConfig ?? {
      siteName: "Inimark Docs",
      defaultTheme: darkThemeValue,
      lightTheme: lightThemeValue,
      darkTheme: darkThemeValue,
      lightCodeTheme: lightCodeValue,
      darkCodeTheme: darkCodeValue,
      baseHref: "/Inimark/",
      out: "dist",
    };
    return {
      ...base,
      lightTheme: lightThemeValue,
      darkTheme: darkThemeValue,
      lightCodeTheme: lightCodeValue,
      darkCodeTheme: darkCodeValue,
      defaultTheme: darkThemeValue,
    };
  }

  function setBusy(next: boolean): void {
    busy = next;
    buildBtn.disabled = busy || !docsVault;
    previewBtn.disabled = busy || !lastOutDir;
    stopPreviewBtn.disabled = busy;
  }

  const buildBtn = createButton({
    label: "",
    variant: "primary",
    onClick: () => {
      void runBuild();
    },
  });
  const previewBtn = createButton({
    label: "",
    onClick: () => {
      void runPreview();
    },
  });
  const stopPreviewBtn = createButton({
    label: "",
    onClick: () => {
      void stopSitePreview().then(() => {
        status.textContent = t("settings.dev.docs.previewStopped");
      });
    },
  });

  const actions = document.createElement("div");
  actions.className = "inimark-settings-publish-actions";
  actions.append(buildBtn, previewBtn, stopPreviewBtn);

  async function refreshThemeOptions(): Promise<void> {
    const manifests = await loadManifest().catch(() => []);
    themeOptions = [
      ...BUILTIN_THEMES.map((id) => ({ value: id, label: id })),
      ...manifests.map((m) => ({
        value: `custom-${m.id}`,
        label: m.name?.trim() || `custom-${m.id}`,
      })),
    ];
    rebuildAppThemeSelects();
  }

  async function refreshCodeThemeOptions(): Promise<void> {
    const customs = await loadCodeThemeManifest().catch(() => []);
    lightCodeOptions = [
      ...CODE_THEMES.filter((c) => !c.isDark).map((c) => ({ value: c.id, label: c.name })),
      ...customs
        .filter((m) => !m.isDark)
        .map((m) => ({ value: m.id, label: m.name?.trim() || m.id })),
    ];
    darkCodeOptions = [
      ...CODE_THEMES.filter((c) => c.isDark).map((c) => ({ value: c.id, label: c.name })),
      ...customs
        .filter((m) => m.isDark)
        .map((m) => ({ value: m.id, label: m.name?.trim() || m.id })),
    ];
    rebuildCodeThemeSelects();
  }

  async function resolveVault(): Promise<void> {
    if (!isTauri()) {
      docsVault = null;
      pathStatus.textContent = t("settings.dev.docs.tauriOnly");
      setBusy(false);
      return;
    }
    try {
      docsVault = await invoke<string>("resolve_inimark_docs_vault");
      pathStatus.textContent = t("settings.dev.docs.vaultPath", { path: docsVault });
      lastConfig = await loadPublishConfig(docsVault);
      lightThemeValue = lastConfig.lightTheme || "light";
      darkThemeValue = lastConfig.darkTheme || DEFAULT_DARK_BUILTIN;
      lightCodeValue = lastConfig.lightCodeTheme || DEFAULT_CODE_THEME_PAIR.light;
      darkCodeValue = lastConfig.darkCodeTheme || DEFAULT_CODE_THEME_PAIR.dark;
      rebuildAppThemeSelects();
      rebuildCodeThemeSelects();
      lastOutDir = docsDistDir(docsVault, lastConfig.out || "dist");
    } catch (e) {
      docsVault = null;
      lastConfig = null;
      pathStatus.textContent = t("settings.dev.docs.vaultMissing", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
    setBusy(false);
  }

  async function runBuild(): Promise<void> {
    if (busy || !docsVault) return;
    if (!isTauri()) {
      status.textContent = t("settings.dev.docs.tauriOnly");
      return;
    }
    const config = readFormConfig();
    setBusy(true);
    status.textContent = t("settings.dev.docs.building");
    try {
      await savePublishConfig(docsVault, config);
      lastConfig = config;
      const result = await publishLibrary(docsVault, config, (p: PublishProgress) => {
        status.textContent = `${p.phase}: ${p.message}`;
      });
      lastOutDir = result.outDir;
      status.textContent = t("settings.dev.docs.buildDone", {
        count: result.pageCount,
        dir: result.outDir,
      });
    } catch (e) {
      status.textContent = t("settings.dev.docs.failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(): Promise<void> {
    if (!lastOutDir) {
      status.textContent = t("settings.dev.docs.previewNeedBuild");
      return;
    }
    try {
      const url = await startSitePreview(lastOutDir);
      status.textContent = t("settings.dev.docs.previewReady", { url });
      openExternalUrl(url);
    } catch (e) {
      status.textContent = t("settings.dev.docs.failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function applyI18n(): void {
    buildBtn.textContent = t("settings.dev.docs.build");
    previewBtn.textContent = t("settings.dev.docs.preview");
    stopPreviewBtn.textContent = t("settings.dev.docs.stopPreview");
  }

  const intro = document.createElement("p");
  intro.className = "inimark-settings-row-desc";
  intro.style.margin = "0 0 12px";
  intro.textContent = t("settings.dev.docs.intro");

  const group = createCollapsibleSettingsGroup({
    id: "dev.docs.publish",
    title: t("settings.dev.docs.group"),
    defaultExpanded: true,
  });

  const lightThemeRow = createRow(
    t("settings.publish.lightTheme"),
    t("settings.publish.lightThemeDesc"),
    lightThemeHost,
    "dev.docs.lightTheme",
  );
  const darkThemeRow = createRow(
    t("settings.publish.darkTheme"),
    t("settings.publish.darkThemeDesc"),
    darkThemeHost,
    "dev.docs.darkTheme",
  );
  const lightCodeRow = createRow(
    t("settings.publish.lightCodeTheme"),
    t("settings.publish.lightCodeThemeDesc"),
    lightCodeHost,
    "dev.docs.lightCodeTheme",
  );
  const darkCodeRow = createRow(
    t("settings.publish.darkCodeTheme"),
    t("settings.publish.darkCodeThemeDesc"),
    darkCodeHost,
    "dev.docs.darkCodeTheme",
  );

  // Reserved for a future marketing / site-home special publish flow.
  const futureNote = document.createElement("p");
  futureNote.className = "inimark-settings-row-desc";
  futureNote.style.margin = "8px 0 0";
  futureNote.textContent = t("settings.dev.docs.futureHome");

  group.body.append(
    intro,
    pathStatus,
    lightThemeRow,
    darkThemeRow,
    lightCodeRow,
    darkCodeRow,
    actions,
    status,
    futureNote,
  );
  root.append(group.el);

  applyI18n();
  void Promise.all([refreshThemeOptions(), refreshCodeThemeOptions()]).then(() => resolveVault());

  return {
    el: root,
    destroy() {
      lightThemeSelect?.destroy();
      darkThemeSelect?.destroy();
      lightCodeSelect?.destroy();
      darkCodeSelect?.destroy();
    },
  };
}
