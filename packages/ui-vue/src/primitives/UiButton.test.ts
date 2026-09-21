import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiButton from "./UiButton.vue";

describe("UiButton", () => {
  it("renders its label and emits press", async () => {
    const wrapper = mount(UiButton, {
      slots: { default: "Save" },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.text()).toContain("Save");
    expect(wrapper.emitted("press")).toHaveLength(1);
  });

  it("does not emit while disabled", async () => {
    const wrapper = mount(UiButton, {
      props: { disabled: true },
      slots: { default: "Save" },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.emitted("press")).toBeUndefined();
  });

  it("exposes loading state accessibly", () => {
    const wrapper = mount(UiButton, {
      props: { loading: true },
      slots: { default: "Saving" },
    });

    expect(wrapper.get("button").attributes("aria-busy")).toBe("true");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.find(".dionysen-button__spinner").exists()).toBe(true);
  });
});
