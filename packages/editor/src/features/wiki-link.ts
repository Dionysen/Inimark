import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import { markConsumed, rangesOverlap, type InlineSpan } from "../inline-parse.ts";
import { getInlineCodeRanges } from "./code.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";
import { notifyOverlayScrollbarRefresh } from "../overlay-scrollbar-bridge.ts";
import { getWikiLinkBridge } from "../wiki-link-bridge.ts";
import {
  WikiAutocompletePopup,
  resolveWikiAutocompleteMatches,
} from "./wiki-link-autocomplete-popup.ts";
import { isModifiedClick } from "../link-navigation.ts";
import type { MarkdownPreviewController } from "../preview-view.ts";

// Obsidian-style [[wiki]] / ![[embed]] — source stays in the doc; a widget
// shows the display label (or image) when the cursor is outside the span.
//
// NOTE: do not statically import preview-view.ts for values — it pulls
// features/index → wiki-link and creates a TDZ crash on ALL_FEATURES.

const WIKI_RE = /(!?)\[\[([^\]]+)\]\]/g;
const HOVER_DELAY_MS = 420;
const HIDE_DELAY_MS = 220;

const OPEN_ICON =
  `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10 14 21 3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

function parseInner(content: string): {
  noteName: string;
  heading?: string;
  alias?: string;
} {
  const pipeIndex = content.indexOf("|");
  const displayPart = pipeIndex >= 0 ? content.slice(pipeIndex + 1) : undefined;
  const notePart = pipeIndex >= 0 ? content.slice(0, pipeIndex) : content;
  const hashIndex = notePart.indexOf("#");
  const noteName = (hashIndex >= 0 ? notePart.slice(0, hashIndex) : notePart).trim();
  const heading = hashIndex >= 0 ? notePart.slice(hashIndex + 1).trim() : undefined;
  return {
    noteName,
    heading: heading || undefined,
    alias: displayPart?.trim() || undefined,
  };
}

function isImageTarget(noteName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|heic|heif|tiff?|apng|jfif|jxl)$/i.test(
    noteName,
  );
}

function displayLabel(noteName: string, alias?: string, heading?: string): string {
  if (alias) return alias;
  const base = noteName.split("/").pop() || noteName;
  return heading ? `${base} › ${heading}` : base;
}

const scan: InlineFeatureSpec["scan"] = (text, consumed) => {
  const out: InlineSpan[] = [];
  const bridge = getWikiLinkBridge();
  WIKI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RE.exec(text))) {
    const fullStart = m.index;
    const fullEnd = fullStart + m[0]!.length;
    let blocked = false;
    for (let i = fullStart; i < fullEnd; i++) {
      if (consumed[i]) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    markConsumed(consumed, fullStart, fullEnd);
    const isEmbed = m[1] === "!";
    const parsed = parseInner(m[2]!);
    const resolved = bridge?.resolveNote(parsed.noteName) ?? null;
    const unresolved = !isImageTarget(parsed.noteName) && !resolved;
    const label = displayLabel(parsed.noteName, parsed.alias, parsed.heading);

    const span: InlineSpan = {
      type: "wiki_link",
      from: fullStart,
      to: fullEnd,
      openFrom: fullStart,
      openTo: fullStart,
      closeFrom: fullEnd,
      closeTo: fullEnd,
      attrs: {
        note: parsed.noteName,
        heading: parsed.heading ?? null,
        alias: parsed.alias ?? null,
        embed: isEmbed ? "1" : "0",
      },
      delimRanges: [{ from: fullStart, to: fullEnd }],
      widgetDecorations: [],
    };

    if (isEmbed && isImageTarget(parsed.noteName)) {
      const imgPath = bridge?.resolveImage(parsed.noteName) ?? null;
      const src = imgPath && bridge?.imageUrl ? bridge.imageUrl(imgPath) : null;
      span.widgetDecorations!.push({
        pos: fullStart,
        when: "outside",
        kind: "wiki-embed-image",
        attrs: {
          src: src ?? "",
          alt: label,
          note: parsed.noteName,
          unresolved: src ? "0" : "1",
        },
        side: -1,
      });
    } else if (isEmbed) {
      span.widgetDecorations!.push({
        pos: fullStart,
        when: "outside",
        kind: "wiki-embed-note",
        attrs: {
          label,
          note: parsed.noteName,
          unresolved: unresolved ? "1" : "0",
        },
        side: -1,
      });
    } else {
      span.widgetDecorations!.push({
        pos: fullStart,
        when: "outside",
        kind: "wiki-link",
        attrs: {
          label,
          note: parsed.noteName,
          heading: parsed.heading ?? "",
          unresolved: unresolved ? "1" : "0",
          len: String(fullEnd - fullStart),
        },
        side: -1,
      });
    }

    out.push(span);
  }
  return out;
};

// ─── Autocomplete ─────────────────────────────────────────────────────────

type AutoState = {
  open: boolean;
  partial: string;
  matches: Array<{ name: string; path: string }>;
  recentCount: number;
  selected: number;
  dismissedFor: string;
  from: number;
  to: number;
};

const CLOSED: AutoState = {
  open: false,
  partial: "",
  matches: [],
  recentCount: 0,
  selected: 0,
  dismissedFor: "",
  from: 0,
  to: 0,
};

const autoKey = new PluginKey<AutoState>("wikiLinkAutocomplete");

function detectPartial(
  state: EditorState,
): { from: number; to: number; partial: string } | null {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;

  const parentStart = $from.start();
  const offset = $from.parentOffset;
  const text = $from.parent.textContent;
  const before = text.slice(0, offset);
  const after = text.slice(offset);

  const openIdx = before.lastIndexOf("[[");
  if (openIdx < 0) return null;
  if (openIdx > 0 && before[openIdx - 1] === "!") return null;

  const codeRanges = getInlineCodeRanges(text);
  const closeIdx = after.indexOf("]]");
  if (closeIdx < 0) return null;
  const wikiEnd = offset + closeIdx + 2;
  if (rangesOverlap(codeRanges, openIdx, wikiEnd)) return null;

  const innerBefore = before.slice(openIdx + 2);
  if (innerBefore.includes("]]")) return null;

  if (after.slice(0, closeIdx).includes("[[")) return null;

  // Only complete the note-name segment (before alias / heading).
  if (innerBefore.includes("|")) return null;
  const hashIdx = innerBefore.indexOf("#");
  const partial =
    hashIdx >= 0 ? innerBefore.slice(0, hashIdx).trim() : innerBefore;

  const from = parentStart + openIdx;
  return { from, to: $from.pos, partial };
}

export function detectWikiLinkPartial(
  state: EditorState,
): ReturnType<typeof detectPartial> {
  return detectPartial(state);
}

const DISMISS_EMPTY = "\u0000";

function dismissKey(partial: string): string {
  return partial || DISMISS_EMPTY;
}

function listKey(auto: AutoState): string {
  return `${auto.partial}\0${auto.recentCount}\0${auto.matches.map((m) => m.name).join("\0")}`;
}

function repositionWikiAutocomplete(
  view: EditorView,
  auto: AutoState,
  el: HTMLElement,
): void {
  try {
    const anchor = auto.from + 2;
    const coords = view.coordsAtPos(anchor, -1);
    el.style.top = `${coords.bottom + 4}px`;
    el.style.left = `${coords.left}px`;
  } catch {
    /* layout not ready */
  }
}

function wikiAutocompletePlugin(): Plugin<AutoState> {
  return new Plugin<AutoState>({
    key: autoKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(autoKey) as Partial<AutoState> | undefined;
        if (meta && "close" in meta) return CLOSED;
        if (meta && "selected" in meta && prev.open) {
          return { ...prev, selected: meta.selected ?? prev.selected };
        }
        if (meta && "dismiss" in meta && prev.open) {
          return { ...CLOSED, dismissedFor: dismissKey(prev.partial) };
        }

        const hit = detectPartial(state);
        if (!hit) return CLOSED;
        if (prev.dismissedFor && dismissKey(hit.partial) === prev.dismissedFor) {
          return { ...CLOSED, dismissedFor: prev.dismissedFor };
        }
        const bridge = getWikiLinkBridge();
        if (!bridge) return CLOSED;
        const { matches, recentCount } = resolveWikiAutocompleteMatches(
          bridge,
          hit.partial,
        );
        // Keep open even with zero matches so Enter can create.
        const selected =
          prev.open && prev.partial === hit.partial
            ? Math.min(prev.selected, Math.max(0, matches.length - 1))
            : 0;
        return {
          open: true,
          partial: hit.partial,
          matches,
          recentCount,
          selected,
          dismissedFor: "",
          from: hit.from,
          to: hit.to,
        };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const auto = autoKey.getState(view.state);
        if (!auto?.open) return false;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next =
            auto.matches.length === 0
              ? 0
              : (auto.selected + 1) % auto.matches.length;
          view.dispatch(view.state.tr.setMeta(autoKey, { selected: next }));
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          const next =
            auto.matches.length === 0
              ? 0
              : (auto.selected - 1 + auto.matches.length) % auto.matches.length;
          view.dispatch(view.state.tr.setMeta(autoKey, { selected: next }));
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(autoKey, { dismiss: true }));
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          commitAutocomplete(view, auto);
          return true;
        }
        return false;
      },
    },
    view(view) {
      let popup: WikiAutocompletePopup | null = null;
      let lastListKey = "";

      const syncPopup = () => {
        const auto = autoKey.getState(view.state);
        if (!auto?.open) {
          popup?.destroy();
          popup = null;
          lastListKey = "";
          return;
        }

        if (!popup) {
          popup = new WikiAutocompletePopup((idx) => {
            const state = autoKey.getState(view.state);
            if (!state?.open) return;
            commitAutocomplete(view, { ...state, selected: idx });
          });
          document.body.append(popup.el);
        }

        const key = listKey(auto);
        if (key !== lastListKey) {
          popup.setItems(auto.matches, auto.recentCount, auto.partial);
          lastListKey = key;
        }
        popup.setSelected(auto.selected);
        repositionWikiAutocomplete(view, auto, popup.el);
        notifyOverlayScrollbarRefresh();
      };

      syncPopup();
      return {
        update() {
          syncPopup();
        },
        destroy() {
          popup?.destroy();
          popup = null;
        },
      };
    },
  });
}

function commitAutocomplete(view: EditorView, auto: AutoState): void {
  const bridge = getWikiLinkBridge();
  const hit = auto.matches[auto.selected];
  const noteName = hit?.name || auto.partial.trim();
  if (!noteName) {
    view.dispatch(view.state.tr.setMeta(autoKey, { close: true }));
    return;
  }
  if (!hit && bridge?.createNote) {
    bridge.createNote(noteName);
  }

  const $from = view.state.doc.resolve(auto.to);
  const textAfter = $from.parent.textBetween(
    $from.parentOffset,
    $from.parent.content.size,
    "\n",
    "\0",
  );
  const partialFrom = auto.from + 2;
  const hasClosing = textAfter.startsWith("]]");

  let tr = view.state.tr.insertText(noteName, partialFrom, auto.to);
  const afterPartial = partialFrom + noteName.length;
  if (!hasClosing) {
    tr = tr.insertText("]]", afterPartial, afterPartial);
  }
  tr = tr
    .setSelection(TextSelection.create(tr.doc, afterPartial + 2))
    .setMeta(autoKey, { close: true });
  view.dispatch(tr);
  view.focus();
}

// ─── Click + hover ────────────────────────────────────────────────────────

function wikiTargetFromEvent(event: Event): HTMLElement | null {
  const node = event.target as Node | null;
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  return (
    (el?.closest(
      ".wiki-link-widget, .wiki-embed-note, .wiki-embed-image",
    ) as HTMLElement | null) ?? null
  );
}

function wikiHoverTargetFromEvent(event: Event): HTMLElement | null {
  const node = event.target as Node | null;
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  return (
    (el?.closest(".wiki-link-widget, .wiki-embed-note") as HTMLElement | null) ??
    null
  );
}

function wikiInteractionPlugin(): Plugin {
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let previewEl: HTMLElement | null = null;
  let previewView: MarkdownPreviewController | null = null;
  let activeNote: string | null = null;

  function clearHoverTimer(): void {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function clearHideTimer(): void {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hidePreview(): void {
    clearHoverTimer();
    clearHideTimer();
    previewView?.destroy();
    previewView = null;
    previewEl?.remove();
    previewEl = null;
    activeNote = null;
  }

  function scheduleHide(): void {
    clearHoverTimer();
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hidePreview();
    }, HIDE_DELAY_MS);
  }

  function positionPreview(anchor: HTMLElement): void {
    if (!previewEl) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const width = previewEl.offsetWidth || 360;
    const height = previewEl.offsetHeight || 280;
    let left = Math.min(rect.left, window.innerWidth - width - gap);
    left = Math.max(gap, left);
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - gap && rect.top > height + gap) {
      top = rect.top - height - gap;
    }
    top = Math.max(gap, Math.min(top, window.innerHeight - height - gap));
    previewEl.style.left = `${left}px`;
    previewEl.style.top = `${top}px`;
  }

  function showPreview(note: string, anchor: HTMLElement): void {
    const bridge = getWikiLinkBridge();
    if (!bridge?.previewNote) return;
    clearHideTimer();
    clearHoverTimer();
    hoverTimer = setTimeout(() => {
      void (async () => {
        try {
          const text = await bridge.previewNote!(note);
          if (!text) return;
          // Stale hover — user moved on or preview was dismissed.
          if (activeNote !== note) return;

          previewView?.destroy();
          previewView = null;
          previewEl?.remove();
          previewEl = document.createElement("div");
          previewEl.className = "wiki-link-preview";
          previewEl.setAttribute("role", "dialog");

          const toolbar = document.createElement("div");
          toolbar.className = "wiki-link-preview-toolbar";

          const pathEl = document.createElement("span");
          pathEl.className = "wiki-link-preview-path";
          const resolved = bridge.resolveNote(note);
          pathEl.textContent = resolved || note;
          pathEl.title = resolved || note;

          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "wiki-link-preview-open";
          openBtn.title = note;
          openBtn.setAttribute("aria-label", note);
          openBtn.innerHTML = OPEN_ICON;
          openBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            bridge.openNote(note);
            hidePreview();
          });

          toolbar.append(pathEl, openBtn);

          const body = document.createElement("div");
          body.className = "wiki-link-preview-body";
          previewEl.append(toolbar, body);
          document.body.append(previewEl);
          activeNote = note;

          // Dynamic import breaks the features/index ↔ preview-view cycle.
          const { mountReadonlyMarkdownPreview } = await import("../preview-view.ts");
          if (activeNote !== note || !previewEl) {
            // Hover dismissed while the chunk was loading.
            return;
          }
          previewView = mountReadonlyMarkdownPreview(body, text, {
            onOpenNote() {
              hidePreview();
            },
          });

          previewEl.addEventListener("mouseenter", () => {
            clearHideTimer();
          });
          previewEl.addEventListener("mouseleave", () => {
            scheduleHide();
          });

          positionPreview(anchor);
          requestAnimationFrame(() => positionPreview(anchor));
        } catch (err) {
          console.error("wiki-link preview failed", err);
          hidePreview();
        }
      })();
    }, HOVER_DELAY_MS);
  }

  return new Plugin({
    props: {
      // Prefer DOM click over handleClick: widget clicks often target a text
      // node, and handleClick can miss when mousedown is stopEvent'd.
      handleDOMEvents: {
        click(_view, event) {
          const wiki = wikiTargetFromEvent(event);
          if (!wiki) return false;
          if (isModifiedClick(event)) hidePreview();
          return false;
        },
        mouseover(_view, event) {
          const wiki = wikiHoverTargetFromEvent(event);
          if (!wiki) return false;
          const note = wiki.getAttribute("data-note");
          if (!note || wiki.getAttribute("data-unresolved") === "1") return false;
          const bridge = getWikiLinkBridge();
          if (!bridge?.previewNote) return false;

          clearHideTimer();
          // Already showing / pending for this note — don't restart the timer
          // on nested mouseover (would prevent the card from ever appearing).
          if (previewEl && activeNote === note) return false;
          if (activeNote === note && hoverTimer != null) return false;

          if (previewEl && activeNote !== note) {
            previewView?.destroy();
            previewView = null;
            previewEl.remove();
            previewEl = null;
          }

          activeNote = note;
          showPreview(note, wiki);
          return false;
        },
        mouseout(_view, event) {
          const related = event.relatedTarget as Node | null;
          const wiki = wikiHoverTargetFromEvent(event);
          if (wiki && related && wiki.contains(related)) return false;
          if (previewEl && related && previewEl.contains(related)) return false;
          scheduleHide();
          return false;
        },
        blur() {
          hidePreview();
          return false;
        },
      },
    },
    view() {
      return {
        destroy() {
          hidePreview();
        },
      };
    },
  });
}

/** Live-editor-only wiki chrome (autocomplete + hover card). */
export function wikiLinkEditorPlugins(): Plugin[] {
  return [wikiAutocompletePlugin(), wikiInteractionPlugin()];
}

export const wikiLink: FeatureSpec = {
  name: "wiki-link",

  markDelims: {},

  inline: {
    // After link/image so standard md links win on overlapping chrome;
    // wiki uses distinct `[[` syntax so conflicts are rare.
    priority: 55,
    scan,
    markNames: [],
    extRanges: (parent) => {
      const ranges: Array<[number, number]> = [];
      const text = parent.textContent;
      const codeRanges = getInlineCodeRanges(text);
      WIKI_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKI_RE.exec(text))) {
        const start = m.index;
        const end = start + m[0]!.length;
        if (rangesOverlap(codeRanges, start, end)) continue;
        ranges.push([start, end]);
      }
      return ranges;
    },
  },

  // Autocomplete / hover live in `wikiLinkEditorPlugins` so the read-only
  // preview surface can reuse feature nodeViews without nesting hover cards.
};
