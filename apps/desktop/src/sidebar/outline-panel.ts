import {
  createPanelToolbar,
  createTreeBranch,
  createTreeChildren,
  createTreeHost,
} from "../ui/widgets/index.ts";
import { buildOutlineTree, parseOutline, type OutlineNode } from "./outline.ts";

const SHOW_LEVELS_KEY = "inimark-outline-show-levels";

export type OutlineSelectHandler = (
  level: number,
  text: string,
  line: number,
) => void;

export interface OutlinePanelController {
  el: HTMLElement;
  setContent(markdown: string): void;
  setActiveLine(line: number | null): void;
  onSelectHeading(handler: OutlineSelectHandler): void;
  destroy(): void;
}

function loadShowLevels(): boolean {
  try {
    const saved = localStorage.getItem(SHOW_LEVELS_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function levelsToggleIcon(show: boolean): string {
  if (show) {
    return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 6h16"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 12h10"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 18h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m15 15 2 2 4-4"/></svg>`;
  }
  return `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 6h16"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 12h10"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4 18h6"/></svg>`;
}

function chevronSvg(): string {
  return `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function mountOutlinePanel(host: HTMLElement): OutlinePanelController {
  host.className = "inimark-outline-panel";
  host.replaceChildren();

  let showLevels = loadShowLevels();
  let markdown = "";
  let activeLine: number | null = null;
  const collapsed = new Set<number>();
  let onSelect: OutlineSelectHandler = () => {};

  const toolbar = createPanelToolbar([
    {
      label: "Toggle heading levels",
      title: showLevels ? "Hide heading levels" : "Show heading levels",
      icon: () => levelsToggleIcon(showLevels),
      onClick() {
        showLevels = !showLevels;
        try {
          localStorage.setItem(SHOW_LEVELS_KEY, showLevels ? "1" : "0");
        } catch {
          /* ignore */
        }
        const btn = toolbar.buttons[0]!;
        btn.title = showLevels ? "Hide heading levels" : "Show heading levels";
        btn.setAttribute(
          "aria-label",
          showLevels ? "Hide heading levels" : "Show heading levels",
        );
        btn.innerHTML = levelsToggleIcon(showLevels);
        rerender();
      },
    },
  ]);

  const treeHost = createTreeHost("Document outline");
  treeHost.classList.add("inimark-outline-tree");
  host.append(toolbar.el, treeHost);

  function renderNode(node: OutlineNode, depth: number): DocumentFragment {
    const frag = document.createDocumentFragment();
    const branch = createTreeBranch();
    branch.classList.add("inimark-outline-branch");

    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.item.line);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "inimark-tree-item inimark-outline-item";
    row.dataset.line = String(node.item.line);
    row.style.setProperty("--tree-depth", String(depth));
    if (activeLine === node.item.line) row.classList.add("is-active");

    if (hasChildren) {
      const chevron = document.createElement("span");
      chevron.className = "inimark-tree-chevron";
      if (!isCollapsed) chevron.classList.add("is-expanded");
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = chevronSvg();
      chevron.addEventListener("click", (event) => {
        event.stopPropagation();
        if (collapsed.has(node.item.line)) collapsed.delete(node.item.line);
        else collapsed.add(node.item.line);
        rerender();
      });
      row.append(chevron);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "inimark-tree-icon-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.append(spacer);
    }

    if (showLevels) {
      const level = document.createElement("span");
      level.className = "inimark-outline-level";
      level.textContent = `H${node.item.level}`;
      row.append(level);
    }

    const label = document.createElement("span");
    label.className = "inimark-tree-label";
    label.textContent = node.item.text;
    row.append(label);

    row.title = node.item.text;
    row.addEventListener("click", () => {
      activeLine = node.item.line;
      rerender();
      onSelect(node.item.level, node.item.text, node.item.line);
    });

    branch.append(row);

    if (hasChildren && !isCollapsed) {
      const children = createTreeChildren(depth);
      children.classList.add("inimark-outline-children");
      for (const child of node.children) {
        children.append(renderNode(child, depth + 1));
      }
      branch.append(children);
    }

    frag.append(branch);
    return frag;
  }

  function rerender(): void {
    treeHost.replaceChildren();
    const items = parseOutline(markdown);
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-sidebar-empty";
      empty.textContent = "No headings yet";
      const hint = document.createElement("p");
      hint.className = "inimark-sidebar-empty-hint";
      hint.textContent = "Add # headings to see the outline";
      treeHost.append(empty, hint);
      return;
    }

    const tree = buildOutlineTree(items);
    const frag = document.createDocumentFragment();
    for (const node of tree) frag.append(renderNode(node, 0));
    treeHost.append(frag);
  }

  rerender();

  return {
    el: host,
    setContent(next) {
      markdown = next;
      rerender();
    },
    setActiveLine(line) {
      activeLine = line;
      rerender();
    },
    onSelectHeading(handler) {
      onSelect = handler;
    },
    destroy() {
      toolbar.destroy();
      host.replaceChildren();
    },
  };
}
