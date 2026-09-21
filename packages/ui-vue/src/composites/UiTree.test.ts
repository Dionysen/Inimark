import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiTree from "./UiTree.vue";

const nodes = [
  {
    id: "notes",
    label: "Notes",
    kind: "folder" as const,
    meta: "2 notes",
    outlined: true,
    children: [{ id: "welcome", label: "Welcome.md", kind: "file" as const }],
  },
  { id: "readme", label: "README.md", kind: "file" as const },
];

describe("UiTree", () => {
  it("renders visible nodes with tree semantics and icons", () => {
    const wrapper = mount(UiTree, {
      props: { nodes, expandedIds: ["notes"], selectedId: "welcome" },
    });

    expect(wrapper.get("[role='tree']").attributes("aria-label")).toBe("Files");
    expect(wrapper.findAll("[role='treeitem']")).toHaveLength(3);
    expect(wrapper.findAll(".dionysen-tree__kind-icon svg")).toHaveLength(3);
    expect(wrapper.get("[data-node-id='welcome']").attributes("aria-selected")).toBe("true");
    expect(wrapper.get("[data-node-id='notes']").classes()).toContain("is-outlined");
    expect(wrapper.get("[data-node-id='notes'] .dionysen-tree__meta").text()).toBe("2 notes");
  });

  it("optionally renders indentation guides", () => {
    const wrapper = mount(UiTree, {
      props: { nodes, expandedIds: ["notes"], indentLines: true },
    });

    expect(wrapper.get("[role='tree']").classes()).toContain("has-indent-lines");
  });

  it("toggles folders and selects rows", async () => {
    const wrapper = mount(UiTree, {
      props: { nodes, expandedIds: [] },
    });

    await wrapper.get("[data-node-id='notes'] .dionysen-tree__chevron").trigger("click");
    await wrapper.get("[data-node-id='readme']").trigger("click");

    expect(wrapper.emitted("update:expandedIds")?.[0]).toEqual([["notes"]]);
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({ id: "readme" });
  });

  it("moves keyboard focus through visible nodes", async () => {
    const wrapper = mount(UiTree, {
      attachTo: document.body,
      props: { nodes, expandedIds: ["notes"] },
    });

    const first = wrapper.get("[data-node-id='notes']");
    (first.element as HTMLElement).focus();
    await first.trigger("keydown", { key: "ArrowDown" });

    expect(document.activeElement).toBe(wrapper.get("[data-node-id='welcome']").element);
    wrapper.unmount();
  });
});
