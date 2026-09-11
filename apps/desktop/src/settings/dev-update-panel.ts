import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { loadSettings } from "../settings/store.ts";
import { requestBackgroundUpdateCheck } from "../update-dev-bridge.ts";
import type { AutoUpdateCheckReport, AutoUpdateState } from "../update/auto-update.ts";
import {
  getDevUpdateCheckOverride,
  loadDevUpdateTestSettings,
  mergeUpdateCheckOptions,
  saveDevUpdateTestSettings,
} from "../update/dev-update-test.ts";
import {
  checkForUpdate,
  classifyUpdateError,
  type UpdateErrorKind,
} from "../updater.ts";
import { createButton, createTextField } from "../ui/widgets/index.ts";
import { createCollapsibleSettingsGroup } from "./collapsible-group.ts";

export interface DevUpdatePanelController {
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCheckReport(report: AutoUpdateCheckReport): string {
  switch (report.outcome) {
    case "available":
      return t("settings.dev.checkResultAvailable", { version: report.version ?? "?" });
    case "upToDate":
      return t("settings.dev.checkResultUpToDate");
    case "error":
      return report.errorKind === "network"
        ? t("settings.dev.checkResultErrorNetwork", { message: report.errorMessage ?? "" })
        : t("settings.dev.checkResultErrorOther", { message: report.errorMessage ?? "" });
    case "skipped":
      return t("settings.dev.checkResultSkipped", { reason: report.skippedReason ?? "unknown" });
  }
}

function formatAutoUpdateState(state: AutoUpdateState): string {
  switch (state.phase) {
    case "idle":
      return t("settings.dev.mainStateIdle");
    case "available":
      return t("settings.dev.mainStateAvailable", { version: state.version ?? "?" });
    case "downloading":
      return t("settings.dev.mainStateDownloading", {
        version: state.version ?? "?",
        progress: String(state.progress),
      });
    case "installing":
      return t("settings.dev.mainStateInstalling", { version: state.version ?? "?" });
  }
}

function capsuleVisible(state: AutoUpdateState): boolean {
  return state.phase !== "idle";
}

/** Dev-only settings panel for simulating update availability. */
export function mountDevUpdatePanel(): DevUpdatePanelController {
  const root = document.createElement("div");
  root.className = "inimark-settings-dev-update";

  let devSettings = loadDevUpdateTestSettings();
  let appVersion = "…";
  let checkBusy = false;

  const intro = document.createElement("p");
  intro.className = "inimark-settings-dev-update-intro";
  intro.textContent = t("settings.dev.updateIntro");

  const versionField = createTextField({
    value: devSettings.overrideCurrentVersion,
    placeholder: "0.0.0",
    mono: true,
    onInput(value) {
      devSettings = { overrideCurrentVersion: value };
      saveDevUpdateTestSettings(devSettings);
      renderOverrideStatus();
    },
    onChange(value) {
      devSettings = { overrideCurrentVersion: value };
      saveDevUpdateTestSettings(devSettings);
      renderOverrideStatus();
    },
  });
  versionField.input.dataset.settingId = "dev.updateOverride";

  const overrideStatus = document.createElement("p");
  overrideStatus.className = "inimark-settings-dev-update-status";

  const actualVersion = document.createElement("div");
  actualVersion.className = "inimark-settings-dev-update-actual";

  const checkPanel = document.createElement("div");
  checkPanel.className = "inimark-settings-dev-update-check-panel";

  const checkTitle = document.createElement("div");
  checkTitle.className = "inimark-settings-dev-update-check-title";
  checkTitle.textContent = t("settings.dev.checkStatusTitle");

  const checkStatus = document.createElement("p");
  checkStatus.className = "inimark-settings-dev-update-check-status";
  checkStatus.textContent = t("settings.dev.checkStatusIdle");

  const checkMeta = document.createElement("dl");
  checkMeta.className = "inimark-settings-dev-update-check-meta";

  const metaRows: Array<{ key: string; valueEl: HTMLElement }> = [
    { key: "settings.dev.checkMetaLastRun", valueEl: document.createElement("dd") },
    { key: "settings.dev.checkMetaResult", valueEl: document.createElement("dd") },
    { key: "settings.dev.checkMetaMainState", valueEl: document.createElement("dd") },
    { key: "settings.dev.checkMetaCapsule", valueEl: document.createElement("dd") },
    { key: "settings.dev.checkMetaOverride", valueEl: document.createElement("dd") },
  ];

  for (const row of metaRows) {
    const dt = document.createElement("dt");
    dt.textContent = t(row.key);
    checkMeta.append(dt, row.valueEl);
  }

  const [
    lastRunEl,
    resultEl,
    mainStateEl,
    capsuleEl,
    overrideEl,
  ] = metaRows.map((row) => row.valueEl);

  checkPanel.append(checkTitle, checkStatus, checkMeta);

  function renderOverrideStatus(): void {
    overrideStatus.textContent = t("settings.dev.updateOverrideSaved", {
      version:
        devSettings.overrideCurrentVersion.trim() || t("settings.dev.updateOverrideDisabled"),
    });
    overrideEl.textContent =
      getDevUpdateCheckOverride() ?? t("settings.dev.updateOverrideDisabled");
  }

  function setCheckBusy(busy: boolean): void {
    checkBusy = busy;
    backgroundBtn.disabled = busy || !isTauri();
    localBtn.disabled = busy || !isTauri();
  }

  function renderCheckResult(options: {
    source: "background" | "local";
    report: AutoUpdateCheckReport;
    state?: AutoUpdateState;
    at?: Date;
  }): void {
    const at = options.at ?? new Date();
    lastRunEl.textContent = `${formatTime(at)} (${options.source === "background" ? t("settings.dev.checkSourceBackground") : t("settings.dev.checkSourceLocal")})`;
    resultEl.textContent = formatCheckReport(options.report);

    if (options.state) {
      mainStateEl.textContent = formatAutoUpdateState(options.state);
      capsuleEl.textContent = capsuleVisible(options.state)
        ? t("settings.dev.capsuleVisibleYes")
        : t("settings.dev.capsuleVisibleNo");
    } else {
      mainStateEl.textContent = t("settings.dev.mainStateUnknown");
      capsuleEl.textContent =
        options.report.outcome === "available"
          ? t("settings.dev.capsuleVisibleLocalOnly")
          : t("settings.dev.capsuleVisibleNo");
    }

    overrideEl.textContent =
      getDevUpdateCheckOverride() ?? t("settings.dev.updateOverrideDisabled");

    if (options.report.outcome === "error") {
      checkStatus.textContent = t("settings.dev.checkStatusFailed");
      checkPanel.dataset.state = "error";
      return;
    }

    if (options.report.outcome === "available") {
      checkStatus.textContent = t("settings.dev.checkStatusFound");
      checkPanel.dataset.state = "available";
      return;
    }

    if (options.report.outcome === "upToDate") {
      checkStatus.textContent = t("settings.dev.checkStatusUpToDate");
      checkPanel.dataset.state = "latest";
      return;
    }

    checkStatus.textContent = t("settings.dev.checkStatusSkipped");
    checkPanel.dataset.state = "skipped";
  }

  async function runLocalCheck(): Promise<void> {
    if (!isTauri() || checkBusy) return;
    setCheckBusy(true);
    checkStatus.textContent = t("settings.dev.checkStatusChecking");
    checkPanel.dataset.state = "checking";

    try {
      const info = await checkForUpdate(
        mergeUpdateCheckOptions({
          useSystemProxy: loadSettings().useSystemProxyForUpdates,
        }),
      );
      renderCheckResult({
        source: "local",
        at: new Date(),
        report: info
          ? { outcome: "available", version: info.version }
          : { outcome: "upToDate" },
      });
    } catch (error) {
      const kind: UpdateErrorKind = classifyUpdateError(error);
      renderCheckResult({
        source: "local",
        at: new Date(),
        report: {
          outcome: "error",
          errorKind: kind,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      setCheckBusy(false);
    }
  }

  async function runBackgroundCheck(): Promise<void> {
    if (!isTauri() || checkBusy) return;
    setCheckBusy(true);
    checkStatus.textContent = t("settings.dev.checkStatusCheckingBackground");
    checkPanel.dataset.state = "checking";

    const result = await requestBackgroundUpdateCheck();
    if (!result) {
      checkStatus.textContent = t("settings.dev.checkStatusTimeout");
      checkPanel.dataset.state = "error";
      resultEl.textContent = t("settings.dev.checkResultTimeout");
      setCheckBusy(false);
      return;
    }

    renderCheckResult({
      source: "background",
      at: new Date(),
      report: result.report,
      state: result.state,
    });
    setCheckBusy(false);
  }

  void (async () => {
    try {
      if (isTauri()) {
        const { getVersion } = await import("@tauri-apps/api/app");
        appVersion = await getVersion();
      } else {
        appVersion = "1.0.1";
      }
    } catch {
      appVersion = "1.0.1";
    }
    actualVersion.textContent = t("settings.dev.updateActualVersion", { version: appVersion });
  })();

  const actions = document.createElement("div");
  actions.className = "inimark-settings-dev-update-actions";

  const backgroundBtn = createButton({
    label: t("settings.dev.triggerBackgroundCheck"),
    variant: "default",
    disabled: !isTauri(),
    onClick: () => {
      void runBackgroundCheck();
    },
  });
  backgroundBtn.dataset.settingId = "dev.triggerBackgroundCheck";

  const localBtn = createButton({
    label: t("settings.dev.runLocalCheck"),
    variant: "default",
    disabled: !isTauri(),
    onClick: () => {
      void runLocalCheck();
    },
  });
  localBtn.dataset.settingId = "dev.runLocalCheck";

  const aboutBtn = createButton({
    label: t("settings.dev.openAboutUpdate"),
    variant: "ghost",
    onClick: () => {
      location.hash = "about";
    },
  });
  aboutBtn.dataset.settingId = "dev.openAboutUpdate";

  actions.append(backgroundBtn, localBtn, aboutBtn);

  renderOverrideStatus();
  overrideEl.textContent =
    getDevUpdateCheckOverride() ?? t("settings.dev.updateOverrideDisabled");

  const simulationGroup = createCollapsibleSettingsGroup({
    id: "dev.updates.simulation",
    title: t("settings.dev.group.simulation"),
  });
  simulationGroup.body.append(
    intro,
    createRow(
      t("settings.dev.updateOverrideTitle"),
      t("settings.dev.updateOverrideDesc"),
      versionField.el,
      "dev.updateOverride",
    ),
    overrideStatus,
    actualVersion,
  );

  const checksGroup = createCollapsibleSettingsGroup({
    id: "dev.updates.checks",
    title: t("settings.dev.group.checks"),
  });
  checksGroup.body.append(checkPanel, actions);

  root.append(simulationGroup.el, checksGroup.el);

  return {
    el: root,
    destroy() {
      versionField.destroy();
    },
  };
}
