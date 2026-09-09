/** happy-dom leaves `document.compatMode` unset; KaTeX warns on import without CSS1Compat. */
Object.defineProperty(document, "compatMode", {
  configurable: true,
  value: "CSS1Compat",
});
