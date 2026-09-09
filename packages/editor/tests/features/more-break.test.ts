import { describe, expect, test } from "vitest";

import { moreBreakSpecs } from "../../specs/features/more-break.specs.ts";
import { parse } from "../../src/parser.ts";
import { schema } from "../../src/schema.ts";
import { serialize } from "../../src/serializer.ts";
import { runFeatureCases } from "../utils.ts";

runFeatureCases(moreBreakSpecs);

describe("more-break serialize", () => {
  test("draft <!--more--> paragraph is not angle-bracket escaped", () => {
    const para = schema.nodes.paragraph.create(null, schema.text("<!--more-->"));
    const doc = schema.nodes.doc.create(null, [para]);
    expect(serialize(doc)).toBe("<!--more-->");
    expect(serialize(doc)).not.toContain("\\");
  });

  test("smart-dash variant still parses as more break", () => {
    expect(parse("<!—more-->").child(0).type.name).toBe("more_break");
  });
});
