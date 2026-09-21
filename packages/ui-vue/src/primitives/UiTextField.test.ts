import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiTextField from "./UiTextField.vue";

describe("UiTextField", () => {
  it("supports v-model updates", async () => {
    const wrapper = mount(UiTextField, {
      props: { modelValue: "before", label: "Name" },
    });

    await wrapper.get("input").setValue("after");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["after"]);
  });

  it("connects descriptions and errors to the input", () => {
    const wrapper = mount(UiTextField, {
      props: {
        ariaLabel: "Workspace name",
        description: "Shown in the sidebar",
        error: "Name is required",
      },
    });

    const input = wrapper.get("input");
    expect(input.attributes("aria-label")).toBe("Workspace name");
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("aria-describedby")?.split(" ")).toHaveLength(2);
  });
});
