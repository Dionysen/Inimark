import { onLocaleChange, t } from "../i18n/index.ts";
import type { AutoUpdateService, AutoUpdateState } from "../update/auto-update.ts";

export interface TitlebarUpdateCapsuleController {
  destroy(): void;
}

/** Compact update prompt in the titlebar, left of the More menu button. */
export function mountTitlebarUpdateCapsule(
  host: HTMLElement,
  service: AutoUpdateService,
): TitlebarUpdateCapsuleController {
  const root = document.createElement("div");
  root.className = "inimark-titlebar-update-capsule";
  root.hidden = true;
  host.prepend(root);

  let busy = false;

  const render = (state: AutoUpdateState): void => {
    root.replaceChildren();

    if (state.phase === "idle") {
      root.hidden = true;
      return;
    }

    root.hidden = false;

    if (state.phase === "downloading" || state.phase === "installing") {
      root.className = "inimark-titlebar-update-capsule is-visible is-progress";

      const track = document.createElement("div");
      track.className = "inimark-titlebar-update-capsule__track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(state.progress));

      const fill = document.createElement("div");
      fill.className = "inimark-titlebar-update-capsule__fill";
      fill.style.width = `${state.progress}%`;

      const label = document.createElement("span");
      label.className = "inimark-titlebar-update-capsule__label";
      label.textContent =
        state.phase === "installing"
          ? t("titlebar.updateInstalling")
          : state.progress > 0
            ? `${state.progress}%`
            : t("titlebar.updateDownloading");

      track.append(fill, label);
      root.append(track);
      return;
    }

    if (state.phase === "available" && state.version) {
      root.className = "inimark-titlebar-update-capsule is-visible is-pill";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-titlebar-update-capsule__pill";
      btn.disabled = busy;
      btn.textContent = t("titlebar.updateCapsule", { version: state.version });
      btn.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        btn.disabled = true;
        void service.startInstall().finally(() => {
          busy = false;
        });
      });
      root.append(btn);
    }
  };

  const unsubscribeLocale = onLocaleChange(() => {
    render(service.getState());
  });

  const unsubscribeService = service.subscribe(render);

  return {
    destroy() {
      unsubscribeLocale();
      unsubscribeService();
      root.remove();
    },
  };
}
