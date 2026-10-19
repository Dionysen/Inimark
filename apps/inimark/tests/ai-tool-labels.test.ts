import { describe, expect, test } from "vitest";

import { formatToolCardBody } from "../src/ai/tool-labels.ts";
import type { UiToolCard } from "../src/ai/types.ts";

function tool(partial: Partial<UiToolCard> & Pick<UiToolCard, "id" | "name">): UiToolCard {
  return {
    argsPreview: "",
    status: "done",
    ...partial,
  };
}

describe("formatToolCardBody", () => {
  test("pretty-prints JSON args and leaves markdown results as prose", () => {
    const body = formatToolCardBody(
      tool({
        id: "1",
        name: "read_file",
        argsPreview: '{"path":"notes.md"}',
        resultPreview: "# Title\n\nParagraph **bold**.",
      }),
    );
    expect(body).toContain("```json");
    expect(body).toContain('"path": "notes.md"');
    expect(body).toContain("# Title");
    expect(body).not.toContain("\n---\n");
  });

  test("pretty-prints JSON tool results", () => {
    const body = formatToolCardBody(
      tool({
        id: "2",
        name: "list_dir",
        argsPreview: '{"path":""}',
        resultPreview: '[{"name":"a.md","kind":"file"}]',
      }),
    );
    expect(body.match(/```json/g)?.length).toBe(2);
    expect(body).toContain('"kind": "file"');
  });
});
