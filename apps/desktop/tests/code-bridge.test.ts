import { describe, expect, test } from "vitest";
import { buildCodeThemeStyleContent, expandCodeThemeCss } from "../src/themes/code-bridge.ts";

describe("code-bridge", () => {
  test("maps hljs vars to tw-code vars used by the editor", () => {
    const css = buildCodeThemeStyleContent({
      "--hljs-keyword": "#d73a49",
      "--hljs-string": "#032f62",
      "--hljs-comment": "#6a737d",
      "--hljs-number": "#005cc5",
      "--hljs-built_in": "#e36209",
    });
    expect(css).toContain("--tw-code-keyword: #d73a49");
    expect(css).toContain("--tw-code-string: #032f62");
    expect(css).toContain("--tw-code-comment: #6a737d");
    expect(css).toContain("--tw-code-literal: #005cc5");
    expect(css).toContain("--tw-code-function: #e36209");
    expect(css).toContain("--tw-code-type: #d73a49");
  });

  test("expandCodeThemeCss extracts hljs declarations", () => {
    const css = expandCodeThemeCss(`:root {\n  --hljs-keyword: #aaa;\n  --hljs-string: #bbb;\n}`);
    expect(css).toContain("--tw-code-keyword: #aaa");
    expect(css).toContain("--tw-code-string: #bbb");
  });
});
