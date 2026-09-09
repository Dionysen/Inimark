import type { FeatureSpecs } from "../_types.ts";

export const moreBreakSpecs: FeatureSpecs = {
  name: "more-break",
  renderCases: {
    div: (children, el) => {
      if (el.classList.contains("more-break")) return "<more-break/>";
      return children;
    },
  },
  cases: [
    {
      id: "parse-from-seed",
      label: "<!--more--> in source parses to a more-break node",
      seed: "before\n\n<!--more-->\n\nafter",
      events: [],
      checkpoints: [
        { at: 0, expect: "before\n<more-break/>\nafter|" },
      ],
    },
    {
      id: "type-more-enter",
      label: "<!--more--><Enter> converts to a more-break node",
      seed: "",
      events: [
        "<",
        "!",
        "-",
        "-",
        "m",
        "o",
        "r",
        "e",
        "-",
        "-",
        ">",
        "<Enter>",
      ],
      checkpoints: [
        { at: 11, expect: "<g><!--more--></g>|" },
        { at: 12, expect: "<more-break/>\n|" },
      ],
    },
  ],
};
