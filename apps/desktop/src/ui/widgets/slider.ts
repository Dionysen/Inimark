export interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Format the value label; default `${value}` */
  formatValue?: (value: number) => string;
  /** When false, hides the trailing value label (default true). */
  showValue?: boolean;
  onInput?: (value: number) => void;
  onChange?: (value: number) => void;
}

export interface SliderController {
  el: HTMLDivElement;
  input: HTMLInputElement;
  setValue(value: number): void;
  getValue(): number;
  destroy(): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createSlider(options: SliderOptions): SliderController {
  const root = document.createElement("div");
  root.className = "inimark-slider";

  const track = document.createElement("div");
  track.className = "inimark-slider__track-wrap";

  const input = document.createElement("input");
  input.type = "range";
  input.className = "inimark-control inimark-slider__input";
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step ?? 1);
  input.value = String(clamp(options.value, options.min, options.max));

  const showValue = options.showValue !== false;
  const valueEl = document.createElement("span");
  valueEl.className = "inimark-slider__value";
  valueEl.hidden = !showValue;

  const format = options.formatValue ?? ((v: number) => String(v));

  function syncFill(): void {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--inimark-slider-fill", `${pct}%`);
    if (showValue) valueEl.textContent = format(value);
  }

  input.addEventListener("input", () => {
    syncFill();
    options.onInput?.(Number(input.value));
  });
  input.addEventListener("change", () => {
    options.onChange?.(Number(input.value));
  });

  track.append(input);
  root.append(track, valueEl);
  syncFill();

  return {
    el: root,
    input,
    setValue(value) {
      input.value = String(clamp(value, options.min, options.max));
      syncFill();
    },
    getValue() {
      return Number(input.value);
    },
    destroy() {
      root.remove();
    },
  };
}
