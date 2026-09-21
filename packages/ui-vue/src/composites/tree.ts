import type { Component } from "vue";

export interface UiTreeNode {
  id: string;
  label: string;
  kind: "file" | "folder";
  icon?: Component;
  children?: UiTreeNode[];
  disabled?: boolean;
  /** Muted information shown at the right edge of the row. */
  meta?: string;
  /** Draw a subtle border around a non-leaf row. */
  outlined?: boolean;
}

export interface UiTreeProps {
  nodes: UiTreeNode[];
  expandedIds?: string[];
  selectedId?: string;
  label?: string;
  indentLines?: boolean;
}
