import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import {
  chapterPreviewText,
  fillChapterTreeLabel,
  formatArticleTime,
  formatChapterFootline,
} from "./chapter-row.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
});

describe("formatArticleTime", () => {
  it("formats epoch ms as local YYYY-MM-DD", () => {
    const ms = Date.UTC(2020, 2, 15, 12, 0, 0);
    const formatted = formatArticleTime(ms);
    const [y, m, d] = formatted.split("-").map(Number);
    const local = new Date(ms);
    assert.equal(y, local.getFullYear());
    assert.equal(m, local.getMonth() + 1);
    assert.equal(d, local.getDate());
  });
});

describe("chapterPreviewText", () => {
  it("collapses whitespace to one line", () => {
    assert.equal(chapterPreviewText("甲\n乙  丙"), "甲 乙 丙");
  });

  it("returns empty for nullish summary", () => {
    assert.equal(chapterPreviewText(null), "");
    assert.equal(chapterPreviewText(undefined), "");
  });
});

describe("formatChapterFootline", () => {
  it("joins create, update, and word count", () => {
    const create = Date.UTC(2020, 0, 2, 8, 0, 0);
    const update = Date.UTC(2021, 5, 10, 8, 0, 0);
    const line = formatChapterFootline(create, update, "120字");
    assert.equal(
      line,
      `${formatArticleTime(create)} - ${formatArticleTime(update)} - 120字`,
    );
  });
});

describe("fillChapterTreeLabel", () => {
  it("builds a three-line chapter block", () => {
    const label = happy.document.createElement("span");
    label.className = "inimark-tree-label";
    fillChapterTreeLabel(label as unknown as HTMLElement, {
      title: "狭隙",
      summary: "第一行\n第二行",
      createTime: Date.UTC(2020, 0, 1, 12, 0, 0),
      updateTime: Date.UTC(2020, 0, 2, 12, 0, 0),
      wordCountLabel: "42字",
    });

    assert.ok(label.classList.contains("vellum-chapter-body"));
    assert.equal(label.querySelector(".vellum-chapter-title")?.textContent, "狭隙");
    assert.equal(
      label.querySelector(".vellum-chapter-preview")?.textContent,
      "第一行 第二行",
    );
    assert.match(
      label.querySelector(".vellum-chapter-meta")?.textContent ?? "",
      / - 42字$/,
    );
  });
});
