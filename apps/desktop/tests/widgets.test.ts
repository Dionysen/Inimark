import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { createSelect } from "../src/ui/widgets/select.ts";
import { createSlider } from "../src/ui/widgets/slider.ts";
import { createMenu } from "../src/ui/widgets/menu.ts";

describe("widgets/select", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    document.querySelectorAll(".inimark-select-panel").forEach((el) => el.remove());
  });

  test("opens panel, selects option, and closes", () => {
    let value = "a";
    const select = createSelect({
      value,
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
      onChange(next) {
        value = next;
      },
    });
    host.append(select.el);

    const trigger = select.el.querySelector("button")!;
    trigger.click();
    const panel = document.querySelector(".inimark-select-panel") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.hidden).toBe(false);

    const beta = [...panel.querySelectorAll("button")].find(
      (btn) => btn.dataset.value === "b",
    )!;
    beta.click();
    expect(value).toBe("b");
    expect(select.getValue()).toBe("b");
    expect(panel.hidden).toBe(true);

    select.destroy();
  });

  test("keyboard ArrowDown opens and Enter commits active option", () => {
    let value = "a";
    const select = createSelect({
      value,
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
      onChange(next) {
        value = next;
      },
    });
    host.append(select.el);
    const trigger = select.el.querySelector("button")!;

    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.querySelector(".inimark-select-panel")).not.toBeNull();

    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(value).toBe("b");
    select.destroy();
  });
});

describe("widgets/slider", () => {
  test("clamps setValue and reports input", () => {
    const values: number[] = [];
    const slider = createSlider({
      min: 10,
      max: 20,
      step: 1,
      value: 15,
      onInput(v) {
        values.push(v);
      },
    });
    document.body.append(slider.el);

    slider.setValue(99);
    expect(slider.getValue()).toBe(20);
    slider.setValue(1);
    expect(slider.getValue()).toBe(10);

    slider.input.value = "12";
    slider.input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(values.at(-1)).toBe(12);
    expect(slider.el.querySelector(".inimark-slider__value")?.textContent).toBe("12");

    slider.destroy();
  });

  test("showValue false hides value label", () => {
    const slider = createSlider({
      min: 0,
      max: 10,
      value: 5,
      showValue: false,
    });
    const valueEl = slider.el.querySelector(".inimark-slider__value") as HTMLElement;
    expect(valueEl.hidden).toBe(true);
    slider.destroy();
  });
});

describe("widgets/menu", () => {
  test("opens, lists items, and closes on outside click helper path", () => {
    const menu = createMenu();
    document.body.append(menu.el);
    menu.setPath("/notes");
    menu.addHeading("Libraries");
    let clicked = false;
    menu.addItem({
      label: "Vault",
      meta: "/notes",
      onClick() {
        clicked = true;
      },
    });
    menu.setOpen(true);
    expect(menu.isOpen()).toBe(true);
    expect(menu.el.hidden).toBe(false);
    expect(menu.el.classList.contains("is-open")).toBe(true);

    const item = menu.el.querySelector(".inimark-menu-item") as HTMLButtonElement;
    item.click();
    expect(clicked).toBe(true);

    menu.setOpen(false);
    expect(menu.isOpen()).toBe(false);
    expect(menu.el.hidden).toBe(true);
    menu.destroy();
  });
});
