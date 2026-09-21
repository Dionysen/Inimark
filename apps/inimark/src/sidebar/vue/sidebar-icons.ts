import { defineComponent, h, type Component, type VNode } from "vue";
import type { SidebarTabId } from "../tab-layout.ts";

type Shape = [tag: "path" | "circle" | "rect" | "line", attributes: Record<string, string | number>];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.75,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

function icon(name: string, shapes: Shape[], viewBox = "0 0 24 24"): Component {
  return defineComponent({
    name,
    setup() {
      return (): VNode => h(
        "svg",
        { class: "inimark-icon", viewBox, fill: "none", "aria-hidden": "true" },
        shapes.map(([tag, attributes]) => h(tag, { ...stroke, ...attributes })),
      );
    },
  });
}

const FilesIcon = icon("FilesIcon", [
  ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }],
]);
const SearchIcon = icon("SearchIcon", [
  ["circle", { cx: 11, cy: 11, r: 8 }],
  ["path", { d: "M21 21l-4.35-4.35" }],
]);
const BookmarksIcon = icon("BookmarksIcon", [
  ["path", { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }],
]);
const TagsIcon = icon("TagsIcon", [
  ["path", { d: "M12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" }],
  ["circle", { cx: 7.5, cy: 7.5, r: 1.25 }],
]);
const OutlineIcon = icon("OutlineIcon", [
  ["path", { d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" }],
]);
const GraphIcon = icon("GraphIcon", [
  ["circle", { cx: 6, cy: 6, r: 2.25 }],
  ["circle", { cx: 18, cy: 7, r: 2.25 }],
  ["circle", { cx: 8, cy: 18, r: 2.25 }],
  ["circle", { cx: 17, cy: 17, r: 2.25 }],
  ["path", { d: "M8 7.5 16 8M7.5 8.2 9.2 15.8M16.2 9.1 15.5 14.8" }],
]);
const AiIcon = icon("AiIcon", [
  ["path", { d: "M12 2.9 13.55 9.75 19.1 12 13.55 14.25 12 21.1 10.45 14.25 4.9 12 10.45 9.75z", transform: "rotate(-20 12 12)" }],
]);

export const SIDEBAR_TAB_ICONS: Record<SidebarTabId, Component> = {
  files: FilesIcon,
  search: SearchIcon,
  bookmarks: BookmarksIcon,
  tags: TagsIcon,
  outline: OutlineIcon,
  graph: GraphIcon,
  ai: AiIcon,
};

export const SidebarToggleOpenIcon = icon("SidebarToggleOpenIcon", [
  ["rect", { x: 1.5, y: 1.5, width: 15, height: 15, rx: 2, "stroke-width": 1.4 }],
  ["rect", { x: 2.5, y: 2.5, width: 5, height: 13, rx: 1, fill: "currentColor", opacity: 0.25, stroke: "none" }],
  ["line", { x1: 7.5, y1: 2.5, x2: 7.5, y2: 15.5, "stroke-width": 1.2 }],
], "0 0 18 18");

export const SidebarToggleClosedIcon = icon("SidebarToggleClosedIcon", [
  ["rect", { x: 1.5, y: 1.5, width: 15, height: 15, rx: 2, "stroke-width": 1.4 }],
  ["line", { x1: 7.5, y1: 2.5, x2: 7.5, y2: 15.5, "stroke-width": 1.2 }],
], "0 0 18 18");

export const RightSidebarToggleOpenIcon = icon("RightSidebarToggleOpenIcon", [
  ["rect", { x: 1.5, y: 1.5, width: 15, height: 15, rx: 2, "stroke-width": 1.4 }],
  ["rect", { x: 10.5, y: 2.5, width: 5, height: 13, rx: 1, fill: "currentColor", opacity: 0.25, stroke: "none" }],
  ["line", { x1: 10.5, y1: 2.5, x2: 10.5, y2: 15.5, "stroke-width": 1.2 }],
], "0 0 18 18");

export const RightSidebarToggleClosedIcon = icon("RightSidebarToggleClosedIcon", [
  ["rect", { x: 1.5, y: 1.5, width: 15, height: 15, rx: 2, "stroke-width": 1.4 }],
  ["line", { x1: 10.5, y1: 2.5, x2: 10.5, y2: 15.5, "stroke-width": 1.2 }],
], "0 0 18 18");
