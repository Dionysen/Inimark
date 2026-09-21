import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import UiDialog from "./UiDialog.vue";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.style.overflow = "";
});

describe("UiDialog", () => {
  it("teleports an accessible dialog and closes with Escape", async () => {
    const wrapper = mount(UiDialog, {
      attachTo: document.body,
      props: { modelValue: true, title: "Delete theme", description: "This cannot be undone." },
      slots: { default: "Dialog content" },
    });

    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(document.body.textContent).toContain("Delete theme");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
    expect(wrapper.emitted("close")?.at(-1)).toEqual(["escape"]);
    wrapper.unmount();
  });

  it("closes from the close button", async () => {
    const wrapper = mount(UiDialog, {
      attachTo: document.body,
      props: { modelValue: true, title: "Settings" },
    });

    const close = document.body.querySelector<HTMLButtonElement>("[aria-label='Close']");
    close?.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")?.at(-1)).toEqual(["button"]);
    wrapper.unmount();
  });
});
