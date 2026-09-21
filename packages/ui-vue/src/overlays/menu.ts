import type { Component } from "vue";

export interface UiMenuItem {
  id: string;
  label: string;
  icon?: Component;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
}

export interface UiMenuProps {
  modelValue?: boolean;
  triggerLabel: string;
  items: UiMenuItem[];
  disabled?: boolean;
  align?: "start" | "end";
}
