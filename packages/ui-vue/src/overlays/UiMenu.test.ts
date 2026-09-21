import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import UiMenu from "./UiMenu.vue";

const Icon = defineComponent(() => () => h("svg"));
const items = [
  { id: "open", label: "Open", icon: Icon, shortcut: "⌘O" },
  { id: "delete", label: "Delete", danger: true, separatorBefore: true },
];

describe("UiMenu", () => {
  it("opens and selects an item", async () => {
    const wrapper = mount(UiMenu, {
      props: { triggerLabel: "File", items, modelValue: false },
    });

    await wrapper.get(".dionysen-menu__trigger").trigger("click");
    await wrapper.setProps({ modelValue: true });
    await wrapper.get("[role='menuitem']").trigger("click");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({ id: "open" });
  });

  it("moves focus with arrow keys and closes with Escape", async () => {
    const wrapper = mount(UiMenu, {
      attachTo: document.body,
      props: { triggerLabel: "File", items, modelValue: true },
    });

    const buttons = wrapper.findAll("[role='menuitem']");
    (buttons[0]?.element as HTMLElement).focus();
    await wrapper.get("[role='menu']").trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]?.element);
    await wrapper.get("[role='menu']").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });
});
