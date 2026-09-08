/** Desktop injects OS-aware URL opening into the editor package. */

export interface LinkNavigationBridge {
  openUrl(href: string): void;
}

let bridge: LinkNavigationBridge | null = null;

export function setLinkNavigationBridge(next: LinkNavigationBridge | null): void {
  bridge = next;
}

export function getLinkNavigationBridge(): LinkNavigationBridge | null {
  return bridge;
}
