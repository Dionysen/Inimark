# Vendored wry 0.55.1

Patched for Inimark Overlay titlebars (same approach as the Inimark app):

- `src/wkwebview/class/wry_web_view_parent.rs` — `inset_traffic_lights`
  - Treat `y` as top inset with matching bottom (`height + 2y`)
  - Vertically center the buttons
  - Still re-applied from `drawRect:` so live resize does not flicker

Wired via `[patch.crates-io]` in the parent `Cargo.toml`, with
`trafficLightPosition: { x: 14, y: 11 }` in `tauri.conf.json`.
