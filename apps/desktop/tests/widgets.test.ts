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

  test("closes panel when an outer scroll container scrolls", () => {
    const scrollHost = document.createElement("div");
    scrollHost.style.height = "100px";
    scrollHost.style.overflow = "auto";
    const scrollContent = document.createElement("div");
    scrollContent.style.height = "400px";
    scrollHost.append(scrollContent);
    document.body.append(scrollHost);

    const select = createSelect({
      value: "a",
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
    });
    scrollHost.append(select.el);

    const trigger = select.el.querySelector("button")!;
    trigger.click();
    const panel = document.querySelector(".inimark-select-panel") as HTMLElement;
    expect(panel.hidden).toBe(false);

    scrollHost.dispatchEvent(new Event("scroll", { bubbles: false }));
    expect(panel.hidden).toBe(true);

    select.destroy();
    scrollHost.remove();
  });

  test("matchTriggerWidth sizes panel to trigger", () => {
    const select = createSelect({
      value: "s",
      matchTriggerWidth: true,
      options: [
        { value: "s", label: "s" },
        { value: "min", label: "min" },
      ],
    });
    select.el.style.width = "72px";
    host.append(select.el);

    const trigger = select.el.querySelector("button")!;
    trigger.click();
    const panel = document.querySelector(".inimark-select-panel") as HTMLElement;
    expect(panel.classList.contains("inimark-select-panel--match-trigger")).toBe(true);
    expect(panel.style.width).toBe(`${trigger.getBoundingClientRect().width}px`);

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
  test("opts out of titlebar drag and blocks double-click maximize", () => {
    const menu = createMenu();
    expect(menu.el.getAttribute("data-tauri-drag-region")).toBe("false");

    let bubbled = false;
    const host = document.createElement("header");
    host.addEventListener("dblclick", () => {
      bubbled = true;
    });
    host.append(menu.el);
    menu.el.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    expect(bubbled).toBe(false);

    menu.destroy();
  });

  test("renders meta below the label when metaPlacement is below", () => {
    const menu = createMenu();
    menu.addItem({
      label: "note",
      meta: "C:\\Users\\example\\Documents\\note",
      metaPlacement: "below",
    });
    const btn = menu.el.querySelector(".inimark-menu-item") as HTMLButtonElement;
    expect(btn.classList.contains("inimark-menu-item--meta-below")).toBe(true);
    expect(btn.querySelector(".inimark-menu-item__meta--below")?.textContent).toBe(
      "C:\\Users\\example\\Documents\\note",
    );
    menu.destroy();
  });

  test("opens, lists items, and closes on outside click", () => {
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

    const item = menu.el.querySelector(".inimark-menu-item") as HTMLButtonElement;
    item.click();
    expect(clicked).toBe(true);

    menu.setOpen(true);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(menu.isOpen()).toBe(false);

    menu.destroy();
  });
});
