import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiToggle from "./UiToggle.vue";

describe("UiToggle", () => {
  it("emits its next checked state", async () => {
    const wrapper = mount(UiToggle, {
      props: { label: "Autosave", modelValue: false },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
    expect(wrapper.emitted("change")?.[0]).toEqual([true]);
  });

  it("uses switch semantics", () => {
    const wrapper = mount(UiToggle, {
      props: { label: "Autosave", modelValue: true },
    });

    const button = wrapper.get("button");
    expect(button.attributes("role")).toBe("switch");
    expect(button.attributes("aria-checked")).toBe("true");
  });
});
