import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiIconButton from "./UiIconButton.vue";

describe("UiIconButton", () => {
  it("uses its label as an accessible name", () => {
    const wrapper = mount(UiIconButton, {
      props: { label: "Close" },
      slots: { default: "×" },
    });

    expect(wrapper.get("button").attributes("aria-label")).toBe("Close");
    expect(wrapper.get("button").attributes("title")).toBe("Close");
  });

  it("emits press and exposes toggle state", async () => {
    const wrapper = mount(UiIconButton, {
      props: { label: "Pin", pressed: true },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("press")).toHaveLength(1);
    expect(wrapper.get("button").attributes("aria-pressed")).toBe("true");
  });
});
