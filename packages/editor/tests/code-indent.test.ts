import { describe, expect, test } from "vitest";

import {
  CODE_INDENT_SIZE_DEFAULT,
  CODE_INDENT_SIZE_MAX,
  CODE_INDENT_SIZE_MIN,
  clampCodeIndentSize,
} from "../src/code-indent.ts";

describe("code indent size", () => {
  test("clamps to the supported 1–8 space range", () => {
    expect(clampCodeIndentSize(CODE_INDENT_SIZE_DEFAULT)).toBe(2);
    expect(clampCodeIndentSize(CODE_INDENT_SIZE_MIN)).toBe(1);
    expect(clampCodeIndentSize(CODE_INDENT_SIZE_MAX)).toBe(8);
    expect(clampCodeIndentSize(0)).toBe(1);
    expect(clampCodeIndentSize(99)).toBe(8);
    expect(clampCodeIndentSize(3.6)).toBe(4);
    expect(clampCodeIndentSize(Number.NaN)).toBe(2);
  });
});
