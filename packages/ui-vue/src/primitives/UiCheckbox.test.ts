import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiCheckbox from "./UiCheckbox.vue";

describe("UiCheckbox", () => {
  it("emits checked state changes", async () => {
    const wrapper = mount(UiCheckbox, {
      props: { label: "Include hidden files", modelValue: false },
    });

    await wrapper.get("input").setValue(true);

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
    expect(wrapper.emitted("change")?.[0]).toEqual([true]);
  });

  it("exposes the mixed accessibility state", () => {
    const wrapper = mount(UiCheckbox, {
      props: { label: "Select all", indeterminate: true },
    });

    expect(wrapper.get("input").attributes("aria-checked")).toBe("mixed");
    expect((wrapper.get("input").element as HTMLInputElement).indeterminate).toBe(true);
  });
});
