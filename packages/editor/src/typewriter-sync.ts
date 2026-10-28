/** Bubbles from embedded CodeMirror (fenced code, etc.) to the editor wrap. */
export const TYPEWRITER_SYNC_EVENT = "typora-web:typewriter-sync";

export function requestTypewriterScroll(from: EventTarget | null | undefined): void {
  from?.dispatchEvent(new CustomEvent(TYPEWRITER_SYNC_EVENT, { bubbles: true }));
}
