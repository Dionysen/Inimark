import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiIconTabs from "./UiIconTabs.vue";

const Icon = defineComponent(() => () => h("svg"));
const items = [
  { id: "files", label: "Files", icon: Icon },
  { id: "search", label: "Search", icon: Icon },
];

describe("UiIconTabs", () => {
  it("renders accessible tabs and emits selection", async () => {
    const wrapper = mount(UiIconTabs, {
      props: { items, modelValue: "files", label: "Sidebar panels" },
    });

    expect(wrapper.get("[role='tablist']").attributes("aria-label")).toBe("Sidebar panels");
    expect(wrapper.get("[data-tab-id='files']").attributes("aria-selected")).toBe("true");
    await wrapper.get("[data-tab-id='search']").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["search"]);
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({ id: "search" });
  });
});
