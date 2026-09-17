import {
  createCollapsibleGroup,
  type CollapsibleGroup,
  type CollapsibleGroupOptions,
} from "@dionysen/settings-kit";

const DEV_SETTINGS_COLLAPSED_KEY = "inimark:dev-settings-collapsed";

export type CollapsibleSettingsGroupOptions = Omit<
  CollapsibleGroupOptions,
  "storageKey"
>;

export type CollapsibleSettingsGroup = CollapsibleGroup;

/** Collapsible section used inside the Dev settings panel. */
export function createCollapsibleSettingsGroup(
  options: CollapsibleSettingsGroupOptions,
): CollapsibleSettingsGroup {
  return createCollapsibleGroup({
    ...options,
    storageKey: DEV_SETTINGS_COLLAPSED_KEY,
  });
}
