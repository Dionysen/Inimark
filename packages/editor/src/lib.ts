// Public API for the editor as a library.
//
// Consumers see only `createEditor` and the small `Editor` controller
// it returns. ProseMirror is an implementation detail and is not on
// this surface (the controller's `view` getter is an opt-in escape
// hatch for advanced cases).

export { createEditor } from "./editor-api.ts";
export type {
  Editor,
  EditorOptions,
  EditorViewState,
  FindSession,
} from "./editor-api.ts";
export type { FindOptions, MdMatch } from "./find-in-markdown.ts";
export type { SearchRevealOptions } from "./search-reveal.ts";
export type { EditorCommandName } from "./commands.ts";
export { executeEditorCommand } from "./commands.ts";
export {
  setClipboardBridge,
  getClipboardBridge,
} from "./clipboard-bridge.ts";
export type { ClipboardBridge } from "./clipboard-bridge.ts";
export {
  setWikiLinkBridge,
  getWikiLinkBridge,
} from "./wiki-link-bridge.ts";
export type { WikiLinkBridge, WikiNoteHit } from "./wiki-link-bridge.ts";
export {
  setLinkNavigationBridge,
  getLinkNavigationBridge,
} from "./link-navigation-bridge.ts";
export { setOverlayScrollbarBridge } from "./overlay-scrollbar-bridge.ts";
export type { LinkNavigationBridge } from "./link-navigation-bridge.ts";
export {
  mountReadonlyMarkdownPreview,
  type MarkdownPreviewController,
  type MarkdownPreviewOptions,
} from "./preview-view.ts";
export {
  attachImePositionGuard,
  isImeComposing,
  refreshImeCaretPosition,
} from "./ime-position.ts";
export type { ImePositionGuardOptions } from "./ime-position.ts";
export {
  buildMarkdownTreeFromDirectory,
  pickMarkdownDirectory,
  readMarkdownFileHandle,
} from "./local-files.ts";
export type { MarkdownTreeEntry } from "./local-files.ts";
