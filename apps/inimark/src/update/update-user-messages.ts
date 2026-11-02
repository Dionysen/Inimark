import { t } from "../i18n/index.ts";
import {
  classifyUpdateError,
  isDevUpdateInstallBlocked,
  isUpdateDownloadCancelled,
  isUpdateDownloadStalled,
  isUpdateDownloadTimedOut,
} from "../updater.ts";

export function messageForUpdateCheckError(error: unknown): string {
  if (isUpdateDownloadCancelled(error)) return "";
  return classifyUpdateError(error) === "network"
    ? t("settings.about.failedNetwork")
    : t("settings.about.failedOther");
}

export function messageForUpdateDownloadError(error: unknown): string {
  if (isUpdateDownloadCancelled(error)) return "";
  if (isDevUpdateInstallBlocked(error)) return t("settings.about.installBlockedOnMacDev");
  if (isUpdateDownloadStalled(error)) return t("settings.about.downloadStalledNetwork");
  if (isUpdateDownloadTimedOut(error)) return t("settings.about.downloadTimedOutNetwork");
  return classifyUpdateError(error) === "network"
    ? t("settings.about.downloadFailedNetwork")
    : t("settings.about.downloadFailedOther");
}

export function messageForUpdateNoLongerAvailable(): string {
  return t("settings.about.updateNoLongerAvailable");
}
