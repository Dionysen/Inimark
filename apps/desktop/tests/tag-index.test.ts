import { afterEach, describe, expect, test } from "vitest";

import { tagIndex } from "../src/tags/tag-index.ts";

describe("tagIndex", () => {
  afterEach(() => {
    tagIndex.clear();
  });

  test("indexes tags per file and reports note counts", () => {
    tagIndex.setFileTags("notes/a.md", "Hello #work and #idea/seed");
    tagIndex.setFileTags("notes/b.md", "Also #work\n#life");

    const byName = tagIndex.listTags("name-asc");
    expect(byName.map((e) => e.name)).toEqual(["idea/seed", "life", "work"]);
    expect(byName.find((e) => e.name === "work")).toEqual({
      name: "work",
      count: 2,
      files: ["notes/a.md", "notes/b.md"],
    });
    expect(tagIndex.getTagsForFile("notes/a.md")).toEqual([
      "work",
      "idea/seed",
    ]);
  });

  test("updates incrementally when file tags change", () => {
    tagIndex.setFileTags("n.md", "#alpha #beta");
    tagIndex.setFileTags("n.md", "#beta #gamma");

    expect(tagIndex.listTags("name-asc").map((e) => e.name)).toEqual([
      "beta",
      "gamma",
    ]);
    expect(tagIndex.listTags("name-asc").find((e) => e.name === "alpha")).toBeUndefined();
  });

  test("removeFile drops tags that lose their last note", () => {
    tagIndex.setFileTags("a.md", "#solo #shared");
    tagIndex.setFileTags("b.md", "#shared");
    tagIndex.removeFile("a.md");

    expect(tagIndex.listTags("name-asc")).toEqual([
      { name: "shared", count: 1, files: ["b.md"] },
    ]);
  });

  test("remapPaths rewrites file membership", () => {
    tagIndex.setFileTags("old/dir/note.md", "#topic");
    tagIndex.remapPaths([{ from: "old/dir", to: "new/dir" }]);

    expect(tagIndex.listTags("name-asc")).toEqual([
      { name: "topic", count: 1, files: ["new/dir/note.md"] },
    ]);
    expect(tagIndex.getTagsForFile("new/dir/note.md")).toEqual(["topic"]);
  });

  test("sorts by name and by usage count", () => {
    tagIndex.setFileTags("a.md", "#zz #aa");
    tagIndex.setFileTags("b.md", "#aa");
    tagIndex.setFileTags("c.md", "#aa #mm");

    expect(tagIndex.listTags("name-asc").map((e) => e.name)).toEqual([
      "aa",
      "mm",
      "zz",
    ]);
    expect(tagIndex.listTags("name-desc").map((e) => e.name)).toEqual([
      "zz",
      "mm",
      "aa",
    ]);
    expect(tagIndex.listTags("count-desc").map((e) => [e.name, e.count])).toEqual([
      ["aa", 3],
      ["mm", 1],
      ["zz", 1],
    ]);
    expect(tagIndex.listTags("count-asc").map((e) => [e.name, e.count])).toEqual([
      ["mm", 1],
      ["zz", 1],
      ["aa", 3],
    ]);
  });

  test("indexes YAML frontmatter tags alongside inline tags", () => {
    tagIndex.setFileTags(
      "post.md",
      [
        "---",
        "tags: [Windows, GLFW]",
        "---",
        "",
        "Also #GLFW and #cpp",
      ].join("\n"),
    );

    expect(tagIndex.listTags("name-asc").map((e) => e.name)).toEqual([
      "cpp",
      "GLFW",
      "Windows",
    ]);
  });

  test("skips notify when the tag set is unchanged", () => {
    let ticks = 0;
    const stop = tagIndex.subscribe(() => {
      ticks += 1;
    });
    tagIndex.setFileTags("n.md", "hello #a #b");
    expect(ticks).toBe(1);
    tagIndex.setFileTags("n.md", "hello #a #b and more prose");
    expect(ticks).toBe(1);
    tagIndex.setFileTags("n.md", "hello #a");
    expect(ticks).toBe(2);
    stop();
  });

  test("pauseNotifications coalesces bulk updates into one emit", () => {
    let ticks = 0;
    const stop = tagIndex.subscribe(() => {
      ticks += 1;
    });
    tagIndex.pauseNotifications();
    tagIndex.setFileTags("a.md", "#one");
    tagIndex.setFileTags("b.md", "#two");
    tagIndex.setFileTags("c.md", "#three");
    expect(ticks).toBe(0);
    tagIndex.resumeNotifications();
    expect(ticks).toBe(1);
    expect(tagIndex.listTags("name-asc").map((e) => e.name)).toEqual([
      "one",
      "three",
      "two",
    ]);
    stop();
  });
});
