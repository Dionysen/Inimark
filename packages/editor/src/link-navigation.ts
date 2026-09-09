import type { EditorView } from "prosemirror-view";

import { parseInline } from "./inline-parse.ts";
import { getLinkNavigationBridge } from "./link-navigation-bridge.ts";
import { getWikiLinkBridge } from "./wiki-link-bridge.ts";

export function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

const RELATIVE_OR_FILE_HREF =
  /^\.{0,2}\/|\.(md|markdown|mdx|txt|pdf|png|jpe?g|gif|webp|svg|html?|css|js|ts|tsx|json|zip)(?:[#?].*)?$/i;

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
  const span = spanAtTextOffset(spans, textOffset);
  if (!span) return false;

  if (span.type === "wiki_link") {
    const note = span.attrs?.note;
    if (typeof note !== "string" || !note) return false;
    const heading = typeof span.attrs?.heading === "string" ? span.attrs.heading : undefined;
    if (!openWikiNote(note, heading || undefined)) return false;
    options?.onWikiOpen?.(note, heading || undefined);
    return true;
  }

  if (span.type === "link" || span.type === "autolink") {
    const href = span.attrs?.href;
    if (typeof href !== "string" || !href) return false;
    openExternalHref(href);
    return true;
  }

  return false;
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

/** Wiki links open on plain click; http(s) links still use Cmd/Ctrl+click. */
export function tryNavigateFromClick(
  view: EditorView,
  event: MouseEvent,
  options?: { onWikiOpen?: (note: string, heading?: string) => void },
): boolean {
  const target = event.target instanceof Element ? event.target : null;

  const wiki = wikiElementFromTarget(target);
  if (wiki) {
    if (isModifiedClick(event)) return false;
    const note = wiki.getAttribute("data-note");
    const heading = wiki.getAttribute("data-heading") || undefined;
    if (!openWikiFromElement(wiki)) return false;
    event.preventDefault();
    event.stopPropagation?.();
    if (note) options?.onWikiOpen?.(note, heading);
    return true;
  }

  if (!isModifiedClick(event)) return false;

  const anchor = target?.closest("a");
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (!href) return false;
    event.preventDefault();
    event.stopPropagation?.();
    openExternalHref(href);
    return true;
  }

  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return false;
  if (!navigateAtDocPos(view, coords.pos, options)) return false;
  event.preventDefault();
  event.stopPropagation?.();
  return true;
}
