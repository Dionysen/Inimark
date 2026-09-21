import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SidebarTopbar from "../src/sidebar/vue/SidebarTopbar.vue";
import { SIDEBAR_TAB_ICONS } from "../src/sidebar/vue/sidebar-icons.ts";

const tabs = [
  { id: "files", label: "Files", icon: SIDEBAR_TAB_ICONS.files },
  { id: "search", label: "Search", icon: SIDEBAR_TAB_ICONS.search },
];

describe("Vue sidebar topbar", () => {
  it("switches panels and requests sidebar collapse", async () => {
    const wrapper = mount(SidebarTopbar, {
      props: {
        tabs,
        activeId: "files",
        sidebarOpen: true,
        collapseLabel: "Collapse sidebar",
        side: "left",
      },
    });

    expect(wrapper.get("[data-tab-id='files']").attributes("aria-selected")).toBe("true");
    await wrapper.get("[data-tab-id='search']").trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["search"]);

    await wrapper.get(".inimark-sidebar-collapse-btn").trigger("click");
    expect(wrapper.emitted("toggle")).toHaveLength(1);
  });
});
