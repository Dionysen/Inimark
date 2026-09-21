import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiPopover from "./UiPopover.vue";

describe("UiPopover", () => {
  it("opens and accepts arbitrary interactive content", async () => {
    const wrapper = mount(UiPopover, {
      props: { modelValue: false, triggerLabel: "Filters" },
      slots: { default: '<input aria-label="Query" /><button>Apply</button>' },
    });

    await wrapper.get(".dionysen-popover__trigger").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.get("[role='dialog']").attributes("aria-modal")).toBe("false");
    expect(wrapper.get("input").attributes("aria-label")).toBe("Query");
  });

  it("closes with Escape without trapping focus", async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      props: { modelValue: true, triggerLabel: "Filters" },
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });
});
