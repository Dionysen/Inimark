import {
  getWikiLinkBridge,
  isExternalHref,
  openExternalHref,
} from "@inimark/editor";

/** Handle clicks on wiki links and external URLs inside an AI chat bubble. */
export function handleChatLinkClick(event: MouseEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;

  const wiki = target.closest<HTMLElement>("a.inimark-ai-wiki");
  if (wiki) {
    event.preventDefault();
    event.stopPropagation();
    const note = wiki.getAttribute("data-note");
    if (!note) return true;
    const heading = wiki.getAttribute("data-heading") || undefined;
    getWikiLinkBridge()?.openNote(note, heading);
    return true;
  }

  const anchor = target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  // Mermaid / math internals may contain <a> — only bubble markdown links.
  if (!anchor.closest(".inimark-ai-bubble")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href === "#" || href.startsWith("#")) {
    // In-page hash only — ignore in chat.
    if (href?.startsWith("#") && href.length > 1) {
      event.preventDefault();
      return true;
    }
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  if (isExternalHref(href)) {
    openExternalHref(href);
    return true;
  }
  // Relative / local markdown paths: still open via system/external helper
  // when they look like URLs; otherwise ignore.
  openExternalHref(href);
  return true;
}
