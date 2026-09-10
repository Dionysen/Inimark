import { t } from "../i18n/index.ts";
import { isTauri } from "../platform/env.ts";
import { createIconButton, closeIcon } from "../ui/widgets/icon-button.ts";
import { createButton } from "../ui/widgets/button.ts";
import { requestUpdatePreflight } from "../update-bridge.ts";
import {
  cancelUpdateDownload,
  checkForUpdate,
  classifyUpdateError,
  downloadUpdate,
  formatProgressPercent,
  installDownloadedUpdate,
  isUpdateDownloadCancelled,
  relaunchApp,
} from "../updater.ts";

type UpdateUiState = "idle" | "checking" | "available" | "latest" | "downloading" | "error";

export interface AboutUpdateControl {
  el: HTMLElement;
}

function checkCircleIcon(): string {
  return `<svg class="inimark-icon inimark-about-update-check-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m8 12.5 2.5 2.5 5.5-6"/></svg>`;
}

function updateErrorMessage(error: unknown): string {
  if (isUpdateDownloadCancelled(error)) return "";
  const kind = classifyUpdateError(error);
  return kind === "network"
    ? t("settings.about.failedNetwork")
    : t("settings.about.failedOther");
}

function downloadErrorMessage(error: unknown): string {
  if (isUpdateDownloadCancelled(error)) return "";
  const kind = classifyUpdateError(error);
  return kind === "network"
    ? t("settings.about.downloadFailedNetwork")
    : t("settings.about.downloadFailedOther");
}

/** About-page software update control with check, install, progress, and cancel states. */
export function mountAboutUpdateControl(): AboutUpdateControl {
  const root = document.createElement("div");
  root.className = "inimark-about-update";

  let state: UpdateUiState = "idle";
  let pendingVersion: string | null = null;
  let busy = false;
  let progressPct = 0;

  const render = (): void => {
    root.replaceChildren();

    if (!isTauri()) {
      root.className = "inimark-about-update inimark-about-update--desktop-only";
      const note = document.createElement("span");
      note.className = "inimark-about-update-note";
      note.textContent = t("settings.about.desktopOnly");
      root.append(note);
      return;
    }

    root.className = `inimark-about-update inimark-about-update--${state}`;

    if (state === "downloading") {
      const track = document.createElement("div");
      track.className = "inimark-about-update-progress";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(progressPct));

      const fill = document.createElement("div");
      fill.className = "inimark-about-update-progress-fill";
      fill.style.width = `${progressPct}%`;

      const label = document.createElement("span");
      label.className = "inimark-about-update-progress-label";
      label.textContent = progressPct > 0 ? `${progressPct}%` : t("settings.about.downloading");

      track.append(fill, label);

      const cancelBtn = createIconButton({
        label: t("settings.about.cancelUpdate"),
        title: t("settings.about.cancelUpdate"),
        html: closeIcon(),
        onClick: () => {
          cancelUpdateDownload();
        },
      });
      cancelBtn.className =
        "inimark-control inimark-icon-btn inimark-about-update-cancel";

      root.append(track, cancelBtn);
      return;
    }

    if (state === "latest") {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "inimark-about-update-pill inimark-about-update-pill--success";
      pill.disabled = busy;
      pill.innerHTML = `${checkCircleIcon()}<span>${t("settings.about.upToDateLabel")}</span>`;
      pill.addEventListener("click", () => {
        void runCheck();
      });
      root.append(pill);
      return;
    }

    if (state === "error") {
      const wrap = document.createElement("div");
      wrap.className = "inimark-about-update-error-wrap";

      const message = document.createElement("p");
      message.className = "inimark-about-update-error";
      message.textContent = root.dataset.errorMessage ?? t("settings.about.failedOther");

      const retryBtn = createButton({
        label: t("settings.about.checkUpdates"),
        variant: "default",
        disabled: busy,
        onClick: () => {
          void runCheck();
        },
      });
      retryBtn.classList.add("inimark-about-update-action");

      wrap.append(message, retryBtn);
      root.append(wrap);
      return;
    }

    const label =
      state === "checking"
        ? t("settings.about.checking")
        : state === "available" && pendingVersion
          ? t("settings.about.updateNow", { version: pendingVersion })
          : t("settings.about.checkUpdates");

    const btn = createButton({
      label,
      variant: state === "available" ? "primary" : "primary",
      disabled: busy || state === "checking",
      onClick: () => {
        if (state === "available") {
          void runInstall();
          return;
        }
        void runCheck();
      },
    });
    btn.classList.add("inimark-about-update-action");
    root.append(btn);
  };

  const setState = (next: UpdateUiState, errorMessage = ""): void => {
    state = next;
    if (errorMessage) root.dataset.errorMessage = errorMessage;
    else delete root.dataset.errorMessage;
    render();
  };

  const setProgress = (downloaded: number, contentLength: number | null): void => {
    const pctText = formatProgressPercent(downloaded, contentLength);
    progressPct = pctText && pctText !== "…" ? Number.parseInt(pctText, 10) : downloaded > 0 ? 1 : 0;
    if (Number.isNaN(progressPct)) progressPct = 0;
    render();
  };

  async function runCheck(): Promise<void> {
    if (!isTauri() || busy) return;
    busy = true;
    pendingVersion = null;
    progressPct = 0;
    setState("checking");
    try {
      const info = await checkForUpdate();
      if (!info) {
        setState("latest");
      } else {
        pendingVersion = info.version;
        setState("available");
      }
    } catch (error) {
      setState("error", updateErrorMessage(error));
    } finally {
      busy = false;
      render();
    }
  }

  async function runInstall(): Promise<void> {
    if (!isTauri() || busy || !pendingVersion) return;

    const ready = await requestUpdatePreflight();
    if (!ready) return;

    busy = true;
    progressPct = 0;
    setState("downloading");
    try {
      const info = await checkForUpdate();
      if (!info) {
        setState("latest");
        return;
      }
      pendingVersion = info.version;

      await downloadUpdate(setProgress);
      await installDownloadedUpdate();
      await relaunchApp();
    } catch (error) {
      if (isUpdateDownloadCancelled(error)) {
        setState("available");
        return;
      }
      setState("error", downloadErrorMessage(error));
    } finally {
      busy = false;
      render();
    }
  }

  render();

  return { el: root };
}
