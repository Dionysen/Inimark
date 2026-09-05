import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";
import { getWikiLinkBridge } from "../wiki-link-bridge.ts";

// Obsidian-style [[wiki]] / ![[embed]] — source stays in the doc; a widget
// shows the display label (or image) when the cursor is outside the span.

const WIKI_RE = /(!?)\[\[([^\]]+)\]\]/g;
const PARTIAL_RE = /(?:^|[^\]])\[\[([^\]]*)$/;
const MAX_VISIBLE = 8;
const HOVER_DELAY_MS = 420;

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
  selected: number;
  dismissedFor: string;
  from: number;
  to: number;
};

const CLOSED: AutoState = {
  open: false,
  partial: "",
  matches: [],
  selected: 0,
  dismissedFor: "",
  from: 0,
  to: 0,
};

const autoKey = new PluginKey<AutoState>("wikiLinkAutocomplete");

function detectPartial(state: EditorState): { from: number; to: number; partial: string } | null {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;
  const parentStart = $from.start();
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
  const m = PARTIAL_RE.exec(textBefore);
  if (!m) return null;
  const partial = m[1] ?? "";
  const from = parentStart + (textBefore.length - partial.length - 2);
  return { from, to: $from.pos, partial };
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
          return { ...CLOSED, dismissedFor: prev.partial };
        }

        const hit = detectPartial(state);
        if (!hit) return CLOSED;
        if (hit.partial === prev.dismissedFor) {
          return { ...CLOSED, dismissedFor: prev.dismissedFor };
        }
        const bridge = getWikiLinkBridge();
        const matches = bridge?.searchNotes(hit.partial).slice(0, MAX_VISIBLE) ?? [];
        // Keep open even with zero matches so Enter can create.
        const selected =
          prev.open && prev.partial === hit.partial
            ? Math.min(prev.selected, Math.max(0, matches.length - 1))
            : 0;
        return {
          open: true,
          partial: hit.partial,
          matches,
          selected,
          dismissedFor: "",
          from: hit.from,
          to: hit.to,
        };
      },
    },
    props: {
      decorations(state) {
        const auto = autoKey.getState(state);
        if (!auto?.open) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.widget(auto.to, () => {
            const box = document.createElement("div");
            box.className = "wiki-link-autocomplete";
            box.setAttribute("contenteditable", "false");
            if (auto.matches.length === 0) {
              const empty = document.createElement("div");
              empty.className = "wiki-link-autocomplete-empty";
              empty.textContent = auto.partial
                ? `Create “${auto.partial}”`
                : "Type to search notes";
              box.append(empty);
            } else {
              auto.matches.forEach((hit, i) => {
                const row = document.createElement("div");
                row.className =
                  "wiki-link-autocomplete-item" +
                  (i === auto.selected ? " is-selected" : "");
                row.textContent = hit.name;
                row.dataset.index = String(i);
                box.append(row);
              });
            }
            return box;
          }, { side: 1 }),
        ]);
      },
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
      handleDOMEvents: {
        mousedown(view, event) {
          const target = event.target as HTMLElement | null;
          const item = target?.closest(".wiki-link-autocomplete-item") as HTMLElement | null;
          if (!item) return false;
          const auto = autoKey.getState(view.state);
          if (!auto?.open) return false;
          const idx = Number(item.dataset.index);
          event.preventDefault();
          commitAutocomplete(view, { ...auto, selected: idx });
          return true;
        },
      },
    },
    view() {
      return {
        update(v) {
          const auto = autoKey.getState(v.state);
          const el = v.dom.querySelector(".wiki-link-autocomplete") as HTMLElement | null;
          if (!auto?.open || !el) return;
          try {
            const coords = v.coordsAtPos(auto.to);
            const editorRect = v.dom.getBoundingClientRect();
            el.style.top = `${coords.bottom - editorRect.top + v.dom.scrollTop + 4}px`;
            el.style.left = `${coords.left - editorRect.left + v.dom.scrollLeft}px`;
          } catch {
            /* ignore */
          }
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
  const insert = `[[${noteName}]]`;
  const tr = view.state.tr
    .insertText(insert, auto.from, auto.to)
    .setMeta(autoKey, { close: true });
  view.dispatch(tr);
  view.focus();
}

// ─── Click + hover ────────────────────────────────────────────────────────

function wikiInteractionPlugin(): Plugin {
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let previewEl: HTMLElement | null = null;

  function hidePreview(): void {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    previewEl?.remove();
    previewEl = null;
  }

  return new Plugin({
    props: {
      handleClick(_view, _pos, event) {
        const t = event.target as HTMLElement | null;
        const wiki = t?.closest(
          ".wiki-link-widget, .wiki-embed-note, .wiki-embed-image",
        ) as HTMLElement | null;
        if (!wiki) return false;
        const note = wiki.getAttribute("data-note");
        if (!note) return false;
        const heading = wiki.getAttribute("data-heading") || undefined;
        event.preventDefault();
        getWikiLinkBridge()?.openNote(note, heading || undefined);
        return true;
      },
      handleDOMEvents: {
        mouseover(_view, event) {
          const t = event.target as HTMLElement | null;
          const wiki = t?.closest(".wiki-link-widget, .wiki-embed-note") as
            | HTMLElement
            | null;
          if (!wiki) return false;
          const note = wiki.getAttribute("data-note");
          if (!note || wiki.getAttribute("data-unresolved") === "1") return false;
          const bridge = getWikiLinkBridge();
          if (!bridge?.previewNote) return false;

          hidePreview();
          hoverTimer = setTimeout(() => {
            void (async () => {
              const text = await bridge.previewNote!(note);
              if (!text) return;
              previewEl?.remove();
              previewEl = document.createElement("div");
              previewEl.className = "wiki-link-preview";
              previewEl.textContent = text.slice(0, 400);
              document.body.append(previewEl);
              const rect = wiki.getBoundingClientRect();
              previewEl.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
              previewEl.style.top = `${rect.bottom + 6}px`;
            })();
          }, HOVER_DELAY_MS);
          return false;
        },
        mouseout(_view, event) {
          const related = event.relatedTarget as Node | null;
          const t = event.target as HTMLElement | null;
          const wiki = t?.closest(".wiki-link-widget, .wiki-embed-note");
          if (wiki && related && wiki.contains(related)) return false;
          if (previewEl && related && previewEl.contains(related)) return false;
          hidePreview();
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
      WIKI_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKI_RE.exec(text))) {
        ranges.push([m.index, m.index + m[0]!.length]);
      }
      return ranges;
    },
  },

  plugins: () => [wikiAutocompletePlugin(), wikiInteractionPlugin()],
};
