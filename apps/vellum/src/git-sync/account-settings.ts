import {
  getSession,
  isProviderConfigured,
  login,
  logout,
  syncOpenLibrary,
  type SessionSummary,
} from "@dionysen/git-sync";
import { createSectionTitle } from "@dionysen/settings-kit";
import { isTauri } from "@dionysen/shell";
import { t } from "../i18n/index.ts";
import {
  emitGitSyncChanged,
  GIT_SYNC_CHANGED_EVENT,
  VELLUM_GIT_SYNC,
} from "./config.ts";

function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vellum-settings-btn";
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function statusLine(text: string, kind: "info" | "error" | "ok" = "info"): HTMLElement {
  const el = document.createElement("p");
  el.className = `vellum-cloud-status vellum-cloud-status--${kind}`;
  el.textContent = text;
  return el;
}

function displayName(session: SessionSummary): string {
  return (
    session.name ||
    session.login ||
    t("settings.account.unknownUser")
  );
}

function formatSyncTime(ts: number | null | undefined): string {
  if (!ts) return t("settings.account.neverSynced");
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Account panel: GitHub / Gitee login and PWB backup sync.
 */
export function renderAccountSection(body: HTMLElement): () => void {
  const root = document.createElement("div");
  root.className = "vellum-cloud-account";
  body.append(root);

  let disposed = false;
  const cleanups: Array<() => void> = [];

  async function refresh(): Promise<void> {
    if (disposed) return;
    root.replaceChildren();
    root.append(createSectionTitle(t("settings.nav.account")));

    if (!isTauri()) {
      root.append(statusLine(t("settings.account.tauriOnly"), "info"));
      return;
    }

    let session: SessionSummary;
    try {
      session = await getSession(VELLUM_GIT_SYNC.appId);
    } catch (err) {
      root.append(
        statusLine(
          t("settings.account.loadFailed", { error: String(err) }),
          "error",
        ),
      );
      return;
    }

    root.append(createSectionTitle(t("settings.account.loginTitle")));

    if (session.loggedIn) {
      root.append(
        statusLine(
          t("settings.account.signedInAs", {
            name: `${session.provider ?? "?"}/${displayName(session)}`,
          }),
          "ok",
        ),
      );
      if (session.repoFullName) {
        root.append(
          statusLine(
            t("settings.account.repoBound", { repo: session.repoFullName }),
            "info",
          ),
        );
      }
      root.append(
        statusLine(
          t("settings.account.lastSync", {
            time: formatSyncTime(session.lastSyncAt),
          }),
          "info",
        ),
      );

      const actions = document.createElement("div");
      actions.className = "vellum-cloud-actions";
      const statusHost = document.createElement("div");

      actions.append(
        button(t("settings.account.syncNow"), () => {
          void (async () => {
            try {
              const result = await syncOpenLibrary(VELLUM_GIT_SYNC.appId);
              emitGitSyncChanged();
              statusHost.replaceChildren(
                statusLine(
                  t("settings.account.syncOk", {
                    pulled: String(result.pulled),
                    pushed: result.pushed ? "1" : "0",
                    remote: String(result.remoteBackupCount),
                  }),
                  "ok",
                ),
              );
              await refresh();
            } catch (err) {
              statusHost.replaceChildren(statusLine(String(err), "error"));
            }
          })();
        }),
        button(t("settings.account.logout"), () => {
          void (async () => {
            try {
              await logout(VELLUM_GIT_SYNC.appId);
              emitGitSyncChanged();
              await refresh();
            } catch (err) {
              statusHost.replaceChildren(statusLine(String(err), "error"));
            }
          })();
        }),
      );
      root.append(actions, statusHost);
      root.append(statusLine(t("settings.account.syncHint"), "info"));
    } else {
      root.append(statusLine(t("settings.account.signedOut"), "info"));
      const actions = document.createElement("div");
      actions.className = "vellum-cloud-actions";

      const ghReady = isProviderConfigured(VELLUM_GIT_SYNC, "github");
      const giteeReady = isProviderConfigured(VELLUM_GIT_SYNC, "gitee");

      actions.append(
        button(
          t("settings.account.loginGithub"),
          () => {
            void (async () => {
              try {
                await login(VELLUM_GIT_SYNC, "github");
              } catch (err) {
                root.append(statusLine(String(err), "error"));
              }
            })();
          },
          !ghReady,
        ),
        button(
          t("settings.account.loginGitee"),
          () => {
            void (async () => {
              try {
                await login(VELLUM_GIT_SYNC, "gitee");
              } catch (err) {
                root.append(statusLine(String(err), "error"));
              }
            })();
          },
          !giteeReady,
        ),
      );
      root.append(actions);
      root.append(statusLine(t("settings.account.loginHint"), "info"));
      if (!ghReady || !giteeReady) {
        root.append(statusLine(t("settings.account.needClientId"), "info"));
      }
    }
  }

  void refresh();

  const onChanged = () => {
    void refresh();
  };
  document.addEventListener(GIT_SYNC_CHANGED_EVENT, onChanged);
  cleanups.push(() =>
    document.removeEventListener(GIT_SYNC_CHANGED_EVENT, onChanged),
  );

  const onError = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (disposed || !detail) return;
    root.append(statusLine(detail, "error"));
  };
  document.addEventListener("vellum:git-sync-error", onError);
  cleanups.push(() =>
    document.removeEventListener("vellum:git-sync-error", onError),
  );

  // Periodic push when signed in (every 15 minutes).
  const interval = window.setInterval(() => {
    void (async () => {
      if (disposed) return;
      try {
        const session = await getSession(VELLUM_GIT_SYNC.appId);
        if (!session.loggedIn) return;
        await syncOpenLibrary(VELLUM_GIT_SYNC.appId);
        emitGitSyncChanged();
      } catch {
        // Library may not be open; ignore.
      }
    })();
  }, 15 * 60 * 1000);
  cleanups.push(() => window.clearInterval(interval));

  return () => {
    disposed = true;
    for (const fn of cleanups) fn();
  };
}
