import type { Component } from "vue";

export interface UiIconTabItem {
  id: string;
  label: string;
  icon: Component;
  disabled?: boolean;
}

export interface UiIconTabsProps {
  items: UiIconTabItem[];
  modelValue?: string;
  label?: string;
}
