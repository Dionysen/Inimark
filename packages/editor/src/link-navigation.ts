import type { EditorView } from "prosemirror-view";

import { parseInline } from "./inline-parse.ts";
import { getLinkNavigationBridge } from "./link-navigation-bridge.ts";
import {
  inlineSpanDocRange,
  isInlineConstructRendered,
} from "./inline-span-range.ts";
import { getWikiLinkBridge } from "./wiki-link-bridge.ts";

export function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

const RELATIVE_OR_FILE_HREF =
  /^\.{0,2}\/|\.(md|markdown|mdx|txt|pdf|png|jpe?g|gif|webp|svg|html?|css|js|ts|tsx|json|zip)(?:[#?].*)?$/i;

/** Obsidian-compatible external URL detection (obsidian-dev-utils `isUrl`). */
const SCHEME_REG_EXP = /^[A-Za-z][A-Za-z0-9+\-.]*:\S+$/;

export function isExternalHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (trimmed.includes("://")) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return SCHEME_REG_EXP.test(trimmed);
}

/** Ensure scheme-less web URLs open in the browser instead of as local paths. */
export function normalizeExternalHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  if (RELATIVE_OR_FILE_HREF.test(trimmed)) return trimmed;
  if (/^[^\s/]+\.[^\s/]+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function openExternalHref(href: string): void {
  const url = normalizeExternalHref(href);
  const bridge = getLinkNavigationBridge();
  if (bridge) {
    bridge.openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function wikiElementFromTarget(target: Element | null): HTMLElement | null {
  return (
    (target?.closest(
      ".wiki-link-widget, .wiki-embed-note, .wiki-embed-image",
    ) as HTMLElement | null) ?? null
  );
}

function openWikiNote(note: string, heading?: string): boolean {
  const bridge = getWikiLinkBridge();
  if (!bridge) return false;
  bridge.openNote(note, heading);
  return true;
}

function openWikiFromElement(wiki: HTMLElement): boolean {
  const note = wiki.getAttribute("data-note");
  if (!note) return false;
  if (
    wiki.classList.contains("wiki-embed-image") &&
    wiki.getAttribute("data-unresolved") === "1"
  ) {
    return false;
  }
  const heading = wiki.getAttribute("data-heading") || undefined;
  return openWikiNote(note, heading);
}

/** Widget DOM bypasses ProseMirror click routing — bind plain click directly. */
export function bindWikiClick(
  el: HTMLElement,
  note: string | undefined,
  heading?: string,
): void {
  if (!note) return;
  el.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent) || isModifiedClick(event)) return;
    event.preventDefault();
    event.stopPropagation();
    openWikiNote(note, heading);
  });
}

/** @deprecated Use {@link bindWikiClick}. */
export const bindWikiModClick = bindWikiClick;

function spanAtTextOffset(
  spans: ReturnType<typeof parseInline>,
  offset: number,
): (ReturnType<typeof parseInline>[number] & { attrs?: Record<string, unknown> }) | null {
  for (const span of spans) {
    if (offset >= span.openFrom && offset <= span.closeTo) return span;
  }
  return null;
}

/** Markdown `[text](url)` only navigates from the bracketed label, not `](url)`. */
function isNavigableLinkOffset(
  span: ReturnType<typeof parseInline>[number],
  offset: number,
): boolean {
  if (span.type === "link" || span.type === "autolink") {
    return offset >= span.from && offset < span.to;
  }
  return offset >= span.openFrom && offset <= span.closeTo;
}

function navigableSpanAtTextOffset(
  spans: ReturnType<typeof parseInline>,
  offset: number,
): (ReturnType<typeof parseInline>[number] & { attrs?: Record<string, unknown> }) | null {
  for (const span of spans) {
    if (isNavigableLinkOffset(span, offset)) return span;
  }
  return null;
}

function renderedLinkSpanAtDocPos(
  view: EditorView,
  pos: number,
): (ReturnType<typeof parseInline>[number] & { attrs?: Record<string, unknown> }) | null {
  const $pos = view.state.doc.resolve(pos);
  const block = $pos.parent;
  if (!block.isTextblock || block.type.spec.code) return null;

  const blockStart = $pos.start();
  const textOffset = pos - blockStart;
  const spans = parseInline(block.textContent, block, { state: view.state });
  const span = navigableSpanAtTextOffset(spans, textOffset);
  if (!span || (span.type !== "link" && span.type !== "autolink")) return null;

  const { spanFrom, spanTo } = inlineSpanDocRange(block, blockStart, span);
  if (!isInlineConstructRendered(view.state, spanFrom, spanTo)) return null;

  return span;
}

function navigateAtDocPos(
  view: EditorView,
  pos: number,
  options?: { onWikiOpen?: (note: string, heading?: string) => void },
): boolean {
  const $pos = view.state.doc.resolve(pos);
  const block = $pos.parent;
  if (!block.isTextblock || block.type.spec.code) return false;

  const textOffset = pos - $pos.start();
  const spans = parseInline(block.textContent, block, { state: view.state });
  const span = navigableSpanAtTextOffset(spans, textOffset);
  if (!span) return false;

  if (span.type === "wiki_link") {
    const note = span.attrs?.note;
    if (typeof note !== "string" || !note) return false;
    const heading = typeof span.attrs?.heading === "string" ? span.attrs.heading : undefined;
    if (!openWikiNote(note, heading || undefined)) return false;
    options?.onWikiOpen?.(note, heading || undefined);
    return true;
  }

  const rendered = renderedLinkSpanAtDocPos(view, pos);
  if (!rendered) return false;

  const href = rendered.attrs?.href;
  if (typeof href !== "string" || !href) return false;
  openExternalHref(href);
  return true;
}

export type WikiPointerHit = {
  note: string;
  heading?: string;
  unresolved: boolean;
};

/** Wiki link under the pointer (rendered widget or `[[source]]` text). */
export function wikiNoteFromPointer(
  view: EditorView,
  event: MouseEvent,
): WikiPointerHit | null {
  const target = event.target instanceof Element ? event.target : null;
  const wiki = wikiElementFromTarget(target);
  if (wiki) {
    const note = wiki.getAttribute("data-note");
    if (!note) return null;
    return {
      note,
      heading: wiki.getAttribute("data-heading") || undefined,
      unresolved: wiki.getAttribute("data-unresolved") === "1",
    };
  }

  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return null;

  const $pos = view.state.doc.resolve(coords.pos);
  const block = $pos.parent;
  if (!block.isTextblock || block.type.spec.code) return null;

  const textOffset = coords.pos - $pos.start();
  const spans = parseInline(block.textContent, block, { state: view.state });
  const span = spanAtTextOffset(spans, textOffset);
  if (span?.type !== "wiki_link") return null;

  const note = span.attrs?.note;
  if (typeof note !== "string" || !note) return null;
  const heading =
    typeof span.attrs?.heading === "string" ? span.attrs.heading : undefined;
  const bridge = getWikiLinkBridge();
  const unresolved = !bridge?.resolveNote(note);
  return { note, heading: heading || undefined, unresolved };
}

function pointerCoords(
  event: MouseEvent,
  target: Element | null,
): { left: number; top: number } {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return { left: event.clientX, top: event.clientY };
  }
  const probe = target?.closest("a") ?? target;
  if (probe) {
    const rect = probe.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
    }
  }
  return { left: event.clientX, top: event.clientY };
}

function hrefAtDocPos(view: EditorView, pos: number): string | null {
  const span = renderedLinkSpanAtDocPos(view, pos);
  if (!span) return null;
  const href = span.attrs?.href;
  return typeof href === "string" && href ? href : null;
}

/** Bracketed link marks render `<a>` around the label only — not `](url)` promotions. */
function hrefFromLinkAnchor(view: EditorView, anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute("href");
  if (!href) return null;
  const label = anchor.textContent ?? "";
  if (!label) return null;

  let matched: string | null = null;
  view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock || node.type.spec.code) return;
    const spans = parseInline(node.textContent, node, { state: view.state });
    for (const span of spans) {
      if (span.type !== "link") continue;
      const spanLabel = node.textContent.slice(span.from, span.to);
      if (spanLabel === label && span.attrs?.href === href) {
        const blockStart = pos + 1;
        const { spanFrom, spanTo } = inlineSpanDocRange(node, blockStart, span);
        if (isInlineConstructRendered(view.state, spanFrom, spanTo)) {
          matched = href;
        }
        return false;
      }
    }
  });
  return matched;
}

function hrefAtPointer(view: EditorView, event: MouseEvent): string | null {
  const target = event.target instanceof Element ? event.target : null;
  const { left, top } = pointerCoords(event, target);
  const coords = view.posAtCoords({ left, top });
  if (coords) {
    const href = hrefAtDocPos(view, coords.pos);
    if (href) return href;
  }

  const anchor = target?.closest("a");
  if (anchor instanceof HTMLAnchorElement) {
    if (anchor.hasAttribute("data-autolink")) {
      if (coords) {
        const href = hrefAtDocPos(view, coords.pos);
        if (href) return href;
      }
      return null;
    }
    return hrefFromLinkAnchor(view, anchor);
  }

  return null;
}

/**
 * True when the pointer is on a rendered link that should navigate instead of
 * placing the caret (evaluated before mousedown moves the selection).
 */
export function isRenderedNavigablePointer(
  view: EditorView,
  event: MouseEvent,
): boolean {
  const target = event.target instanceof Element ? event.target : null;

  const wiki = wikiElementFromTarget(target);
  if (wiki) return !isModifiedClick(event);

  const href = hrefAtPointer(view, event);
  if (!href) return false;

  const external = isExternalHref(href);
  if (external) return !isModifiedClick(event);
  return isModifiedClick(event);
}

/** Wiki links and external URLs open on plain click; internal markdown links use Cmd/Ctrl+click. */
export function tryNavigateFromClick(
  view: EditorView,
  event: MouseEvent,
  options?: { onWikiOpen?: (note: string, heading?: string) => void },
): boolean {
  const target = event.target instanceof Element ? event.target : null;

  const anchor = target?.closest("a");
  if (anchor instanceof HTMLAnchorElement && !anchor.hasAttribute("data-autolink")) {
    // Always suppress the browser's native <a> navigation; only our
    // rendered-mode handler opens the destination.
    event.preventDefault();
  }

  if (!isRenderedNavigablePointer(view, event)) return false;

  const wiki = wikiElementFromTarget(target);
  if (wiki) {
    const note = wiki.getAttribute("data-note");
    const heading = wiki.getAttribute("data-heading") || undefined;
    if (!openWikiFromElement(wiki)) return false;
    event.preventDefault();
    event.stopPropagation?.();
    if (note) options?.onWikiOpen?.(note, heading);
    return true;
  }

  const href = hrefAtPointer(view, event);
  if (!href) return false;

  event.preventDefault();
  event.stopPropagation?.();
  if (isExternalHref(href)) {
    openExternalHref(href);
    return true;
  }

  if (!isModifiedClick(event)) return false;

  openExternalHref(href);
  return true;
}
