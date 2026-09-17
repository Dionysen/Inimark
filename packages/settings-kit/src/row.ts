/** Settings section heading inside a panel body. */
export function createSectionTitle(title: string): HTMLElement {
  const el = document.createElement("h3");
  el.className = "inimark-settings-section-title";
  el.textContent = title;
  return el;
}

/**
 * Standard settings row: title + optional description on the left, control on the right.
 * When `settingId` is set, search navigation can highlight the row via `[data-setting-id]`.
 */
export function createRow(
  title: string,
  description: string,
  control: HTMLElement,
  settingId?: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "inimark-settings-row";
  if (settingId) row.dataset.settingId = settingId;
  const meta = document.createElement("div");
  meta.className = "inimark-settings-row-meta";
  const h = document.createElement("div");
  h.className = "inimark-settings-row-title";
  h.textContent = title;
  meta.append(h);
  if (description) {
    const p = document.createElement("p");
    p.className = "inimark-settings-row-desc";
    p.textContent = description;
    meta.append(p);
  }
  const ctrl = document.createElement("div");
  ctrl.className = "inimark-settings-row-control";
  ctrl.append(control);
  row.append(meta, ctrl);
  return row;
}
