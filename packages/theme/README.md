# @dionysen/theme

Chrome-scoped app theme runtime shared by Dionysen products.

## Scope

- Built-in app themes + `themes.css`
- Appearance mode (`system` | `light` | `dark`) and preferred light/dark theme pair
- Custom app themes under `{appDataDir}/themes/`
- Theme pack import/export (`inimark-theme-pack` v2; consumers may ignore `code` entries)
- Chrome settings panel (`renderChromeThemePanel`) and editor field widgets

Code themes stay in product apps (Inimark).

## Usage

```ts
import {
  configureTheme,
  initThemeManager,
  renderChromeThemePanel,
  DEFAULT_APP_THEME_PAIR,
} from "@dionysen/theme";
import "@dionysen/theme/themes.css";
import "@dionysen/theme/theme-settings.css"; // settings window only

configureTheme({
  productId: "vellum",
  storageKeys: { /* … */ },
  syncEvents: { /* … */ },
  pack: { format: "inimark-theme-pack", fileExtension: "inimark-theme.json", dialogTitle: "Theme Pack" },
  features: { systemAppearance: true },
  editorProfile: "chrome", // or "full"
  defaults: { appearanceMode: "system", preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR } },
  t: (key, params) => t(key, params),
});

await initThemeManager();
```
