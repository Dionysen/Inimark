import {
  promptUnsavedChanges as promptUnsavedChangesBase,
  promptConfirm as promptConfirmBase,
  promptDiskConflict as promptDiskConflictBase,
  type UnsavedChoice,
  type DiskConflictChoice,
  type UnsavedPromptOptions,
  type ConfirmPromptOptions,
  type DiskConflictPromptOptions,
} from "@dionysen/ui";
import { t } from "../i18n/index.ts";

export type {
  UnsavedChoice,
  DiskConflictChoice,
  UnsavedPromptOptions,
  ConfirmPromptOptions,
  DiskConflictPromptOptions,
};

/** Inimark unsaved prompt — localized default copy. */
export function promptUnsavedChanges(
  options: UnsavedPromptOptions = {},
): Promise<UnsavedChoice> {
  return promptUnsavedChangesBase({
    title: options.title ?? t("dialogs.unsavedTitle"),
    message: options.message ?? t("dialogs.unsavedMessage"),
    saveLabel: options.saveLabel ?? t("dialogs.unsavedSave"),
    discardLabel: options.discardLabel ?? t("dialogs.unsavedDiscard"),
    cancelLabel: options.cancelLabel ?? t("dialogs.unsavedCancel"),
  });
}

export function promptConfirm(options: ConfirmPromptOptions = {}): Promise<boolean> {
  return promptConfirmBase(options);
}

/** Inimark disk-conflict prompt — localized default copy. */
export function promptDiskConflict(
  options: DiskConflictPromptOptions = {},
): Promise<DiskConflictChoice> {
  return promptDiskConflictBase({
    title: options.title ?? t("dialogs.diskConflictTitle"),
    message: options.message ?? t("dialogs.diskConflictMessage"),
    overwriteLabel: options.overwriteLabel ?? t("dialogs.diskConflictOverwrite"),
    saveAsLabel: options.saveAsLabel ?? t("dialogs.diskConflictSaveAs"),
    cancelLabel: options.cancelLabel ?? t("dialogs.diskConflictCancel"),
  });
}
