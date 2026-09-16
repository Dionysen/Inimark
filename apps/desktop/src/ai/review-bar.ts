/**
 * Review bar above the AI composer: pending AI file edits with Keep / Discard
 * and expandable unified diffs.
 */

import { t } from "../i18n/index.ts";
import type { AiChangeSet, AiFileChange } from "./change-set.ts";
import { diffLines } from "./line-diff.ts";

export interface ReviewBarHandlers {
  onKeepAll: () => void | Promise<void>;
  onDiscardAll: () => void | Promise<void>;
  onKeepFile: (path: string) => void | Promise<void>;
  onDiscardFile: (path: string) => void | Promise<void>;
  onOpenFile: (path: string) => void | Promise<void>;
}

export interface ReviewBarController {
  el: HTMLElement;
  /** Rebuild from the change set; hides when empty. */
  sync(changeSet: AiChangeSet): void;
  destroy(): void;
}

function fileLabel(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function formatCounts(added: number, removed: number): string {
  return `+${added} −${removed}`;
}

export function mountReviewBar(
  host: HTMLElement,
  handlers: ReviewBarHandlers,
): ReviewBarController {
  host.className = "inimark-ai-review";
  host.hidden = true;
  host.replaceChildren();

  let expandedPath: string | null = null;

  const header = document.createElement("div");
  header.className = "inimark-ai-review__header";

  const summary = document.createElement("p");
  summary.className = "inimark-ai-review__summary";

  const actions = document.createElement("div");
  actions.className = "inimark-ai-review__actions";

  const keepAllBtn = document.createElement("button");
  keepAllBtn.type = "button";
  keepAllBtn.className =
    "inimark-control inimark-btn inimark-btn--primary inimark-ai-review__btn";
  keepAllBtn.addEventListener("click", () => void handlers.onKeepAll());

  const discardAllBtn = document.createElement("button");
  discardAllBtn.type = "button";
  discardAllBtn.className = "inimark-control inimark-btn inimark-ai-review__btn";
  discardAllBtn.addEventListener("click", () => void handlers.onDiscardAll());

  actions.append(discardAllBtn, keepAllBtn);
  header.append(summary, actions);

  const list = document.createElement("div");
  list.className = "inimark-ai-review__list";

  const diffHost = document.createElement("div");
  diffHost.className = "inimark-ai-review__diff";
  diffHost.hidden = true;

  host.append(header, list, diffHost);

  function syncLabels(): void {
    keepAllBtn.textContent = t("ai.review.keepAll");
    discardAllBtn.textContent = t("ai.review.discardAll");
  }

  function renderDiff(change: AiFileChange): void {
    diffHost.replaceChildren();
    const { lines } = diffLines(change.before, change.after);
    const pre = document.createElement("pre");
    pre.className = "inimark-ai-review__diff-pre";
    pre.setAttribute("role", "region");
    pre.setAttribute("aria-label", t("ai.review.diffAria", { path: change.path }));

    // Windowed view: changed lines with ±2 equal context.
    const show = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.kind !== "equal") {
        for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) {
          show.add(k);
        }
      }
    }

    let last = -2;
    for (let i = 0; i < lines.length; i++) {
      if (!show.has(i)) continue;
      if (i > last + 1) {
        const gap = document.createElement("div");
        gap.className = "inimark-ai-review__diff-gap";
        gap.textContent = "⋯";
        pre.append(gap);
      }
      const row = document.createElement("div");
      const kind = lines[i]!.kind;
      row.className = `inimark-ai-review__diff-line inimark-ai-review__diff-line--${kind}`;
      const prefix = kind === "add" ? "+" : kind === "remove" ? "−" : " ";
      row.textContent = `${prefix}${lines[i]!.text}`;
      pre.append(row);
      last = i;
    }

    if (pre.childNodes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inimark-ai-review__diff-empty";
      empty.textContent = t("ai.review.diffEmpty");
      pre.append(empty);
    }

    diffHost.append(pre);
    diffHost.hidden = false;
  }

  function renderList(changes: AiFileChange[]): void {
    list.replaceChildren();
    for (const change of changes) {
      const row = document.createElement("div");
      row.className = "inimark-ai-review__file";
      if (expandedPath === change.path) row.classList.add("is-expanded");

      const main = document.createElement("button");
      main.type = "button";
      main.className = "inimark-ai-review__file-main";
      main.title = change.path;

      const name = document.createElement("span");
      name.className = "inimark-ai-review__file-name";
      name.textContent = fileLabel(change.path);

      const counts = document.createElement("span");
      counts.className = "inimark-ai-review__file-counts";
      counts.textContent = formatCounts(change.added, change.removed);

      main.append(name, counts);
      main.addEventListener("click", () => {
        if (expandedPath === change.path) {
          expandedPath = null;
          diffHost.hidden = true;
          diffHost.replaceChildren();
          row.classList.remove("is-expanded");
          return;
        }
        expandedPath = change.path;
        for (const el of list.querySelectorAll(".inimark-ai-review__file")) {
          el.classList.remove("is-expanded");
        }
        row.classList.add("is-expanded");
        renderDiff(change);
        void handlers.onOpenFile(change.path);
      });

      const fileActions = document.createElement("div");
      fileActions.className = "inimark-ai-review__file-actions";

      const keepBtn = document.createElement("button");
      keepBtn.type = "button";
      keepBtn.className = "inimark-control inimark-btn inimark-ai-review__btn inimark-ai-review__btn--sm";
      keepBtn.textContent = t("ai.review.keep");
      keepBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        void handlers.onKeepFile(change.path);
      });

      const discardBtn = document.createElement("button");
      discardBtn.type = "button";
      discardBtn.className = "inimark-control inimark-btn inimark-ai-review__btn inimark-ai-review__btn--sm";
      discardBtn.textContent = t("ai.review.discard");
      discardBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        void handlers.onDiscardFile(change.path);
      });

      fileActions.append(discardBtn, keepBtn);
      row.append(main, fileActions);
      list.append(row);
    }
  }

  syncLabels();

  return {
    el: host,
    sync(changeSet) {
      syncLabels();
      if (changeSet.isEmpty()) {
        host.hidden = true;
        expandedPath = null;
        list.replaceChildren();
        diffHost.hidden = true;
        diffHost.replaceChildren();
        return;
      }
      host.hidden = false;
      const changes = changeSet.list();
      const totals = changeSet.totals();
      summary.textContent = t("ai.review.summary", {
        files: totals.files,
        added: totals.added,
        removed: totals.removed,
      });
      if (expandedPath && !changeSet.get(expandedPath)) {
        expandedPath = null;
        diffHost.hidden = true;
        diffHost.replaceChildren();
      }
      renderList(changes);
      if (expandedPath) {
        const change = changeSet.get(expandedPath);
        if (change) renderDiff(change);
      }
    },
    destroy() {
      host.replaceChildren();
      host.hidden = true;
    },
  };
}
