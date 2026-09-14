import type { FeatureSpecs } from "../_types.ts";

export const tagSpecs: FeatureSpecs = {
  name: "tag",
  renderCases: {
    span: (children, el) => {
      if (el.classList.contains("tag") || el.getAttribute("data-type") === "tag") {
        const name = el.getAttribute("data-tag") ?? "";
        return `<tag:${name}>${children}</tag>`;
      }
      return children;
    },
  },
  cases: [
    {
      id: "basic-tag",
      label: "hash tag renders as a themed chip",
      seed: "",
      events: ["#", "d", "s", "a", " "],
      checkpoints: [
        { at: 1, expect: "#|" },
        { at: 4, expect: "<tag:dsa>#dsa</tag>|" },
        { at: 5, expect: "<tag:dsa>#dsa</tag> |" },
      ],
    },
    {
      id: "nested-tag",
      label: "nested tag with slash",
      seed: "",
      events: ["#", "a", "/", "b", " "],
      checkpoints: [
        { at: 4, expect: "<tag:a/b>#a/b</tag>|" },
      ],
    },
    {
      id: "mid-paragraph",
      label: "tag after prose",
      seed: "hi ",
      events: ["#", "工", "作", " "],
      checkpoints: [
        { at: 3, expect: "hi <tag:工作>#工作</tag>|" },
      ],
    },
  ],
};
