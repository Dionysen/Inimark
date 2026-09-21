import type { Component } from "vue";

export interface UiTreeNode {
  id: string;
  label: string;
  kind: "file" | "folder";
  icon?: Component;
  children?: UiTreeNode[];
  disabled?: boolean;
}

export interface UiTreeProps {
  nodes: UiTreeNode[];
  expandedIds?: string[];
  selectedId?: string;
  label?: string;
}
