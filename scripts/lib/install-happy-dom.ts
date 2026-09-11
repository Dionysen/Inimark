import { Window } from "happy-dom";

/**
 * Install a minimal DOM on `globalThis` before importing `@inimark/editor`.
 * Must run before any static import that touches ProseMirror / KaTeX DOM APIs.
 */
export function installHappyDom(url = "https://localhost/"): void {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  if (g.document && typeof (g.document as Document).createElement === "function") {
    Object.defineProperty(g.document, "compatMode", {
      configurable: true,
      value: "CSS1Compat",
    });
    return;
  }

  const window = new Window({ url });
  const doc = window.document;

  g.window = window;
  g.document = doc;
  g.navigator = window.navigator;
  g.location = window.location;
  g.HTMLElement = window.HTMLElement;
  g.HTMLDivElement = window.HTMLDivElement;
  g.HTMLImageElement = window.HTMLImageElement;
  g.Image = window.Image;
  g.DocumentFragment = window.DocumentFragment;
  g.Node = window.Node;
  g.Text = window.Text;
  g.DOMParser = window.DOMParser;
  g.XMLSerializer = window.XMLSerializer;
  g.getComputedStyle = window.getComputedStyle.bind(window);
  g.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  g.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  g.MutationObserver = window.MutationObserver;
  g.CustomEvent = window.CustomEvent;
  g.Event = window.Event;
  g.MouseEvent = window.MouseEvent;
  g.KeyboardEvent = window.KeyboardEvent;
  g.self = window;

  Object.defineProperty(doc, "compatMode", {
    configurable: true,
    value: "CSS1Compat",
  });
}
