import {
  getSession,
  initRepo,
  isProviderConfigured,
  listRemoteBackups,
  login,
  logout,
  pushBackup,
  restoreBackup,
  STATUS_EVENT,
  type BackupMeta,
  type SessionSummary,
  type SyncStatusPayload,
} from "@dionysen/git-sync";
import { createSectionTitle } from "@dionysen/settings-kit";
import { isTauri } from "@dionysen/shell";
import { t } from "../i18n/index.ts";
import { withBusy } from "./busy-modal.ts";
import {
  emitGitSyncChanged,
  GIT_SYNC_CHANGED_EVENT,
  VELLUM_GIT_SYNC,
} from "./config.ts";
import { isSyncBusy, requestManualCloudSync } from "./manual-sync.ts";

function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vellum-settings-btn";
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

/** Replace the sync button label with a spinner. Other settings stay usable. */
function showSyncSpinner(btn: HTMLButtonElement, busy: boolean): void {
  if (busy) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent ?? "";
    if (btn.querySelector(".vellum-settings-btn-spin")) return;
    btn.classList.add("is-syncing");
    btn.setAttribute("aria-busy", "true");
    btn.setAttribute("aria-label", t("syncStatus.syncing"));
    btn.replaceChildren();
    const spin = document.createElement("span");
    spin.className = "vellum-settings-btn-spin";
    spin.setAttribute("aria-hidden", "true");
    btn.append(spin);
    return;
  }
  if (!btn.classList.contains("is-syncing")) return;
  btn.classList.remove("is-syncing");
  btn.removeAttribute("aria-busy");
  btn.removeAttribute("aria-label");
  btn.textContent = btn.dataset.label || t("settings.account.syncNow");
}

function statusLine(text: string, kind: "info" | "error" | "ok" = "info"): HTMLElement {
  const el = document.createElement("p");
  el.className = `vellum-cloud-status vellum-cloud-status--${kind}`;
  el.textContent = text;
  return el;
}

function textInput(value: string, placeholder: string): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.className = "vellum-settings-input";
  el.value = value;
  el.placeholder = placeholder;
  return el;
}

function displayName(session: SessionSummary): string {
  return session.name || session.login || t("settings.account.unknownUser");
}

function formatSyncTime(ts: number | null | undefined): string {
  if (!ts) return t("settings.account.neverSynced");
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function openRestoreDialog(): void {
  const overlay = document.createElement("div");
  overlay.className = "vellum-restore-overlay";

  const panel = document.createElement("div");
  panel.className = "vellum-restore-panel";

  const title = document.createElement("h3");
  title.textContent = t("settings.account.restoreTitle");

  const listHost = document.createElement("div");
  listHost.className = "vellum-restore-list inimark-scrollbar";
  listHost.append(statusLine(t("settings.account.restoreLoading"), "info"));

  const closeBtn = button(t("settings.account.restoreClose"), () => {
    overlay.remove();
  });

  const footer = document.createElement("div");
  footer.className = "vellum-cloud-actions";
  footer.append(closeBtn);

  panel.append(title, listHost, footer);
  overlay.append(panel);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.append(overlay);

  void (async () => {
    try {
      const items = await listRemoteBackups(VELLUM_GIT_SYNC.appId);
      listHost.replaceChildren();
      if (!items.length) {
        listHost.append(statusLine(t("settings.account.restoreEmpty"), "info"));
        return;
      }
      for (const item of items) {
        listHost.append(backupRow(item, () => overlay.remove()));
      }
    } catch (err) {
      listHost.replaceChildren(statusLine(String(err), "error"));
    }
  })();
}

function backupRow(item: BackupMeta, onDone: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "vellum-restore-row";

  const meta = document.createElement("div");
  meta.className = "vellum-restore-meta";
  meta.innerHTML = "";
  const line1 = document.createElement("div");
  line1.className = "vellum-restore-meta-title";
  line1.textContent = item.createdAt || item.path;
  const line2 = document.createElement("div");
  line2.className = "vellum-restore-meta-sub";
  line2.textContent = t("settings.account.restoreMeta", {
    device: item.deviceId || "—",
    size: formatBytes(item.size || 0),
    articles: String(item.articleCount ?? 0),
    words: String(item.wordCount ?? 0),
  });
  meta.append(line1, line2);

  const actions = document.createElement("div");
  actions.className = "vellum-restore-row-actions";

  const run = (mode: "overwrite" | "merge") => {
    void (async () => {
      const ok =
        mode === "overwrite"
          ? window.confirm(t("settings.account.restoreOverwriteConfirm"))
          : true;
      if (!ok) return;
      try {
        await withBusy(t("settings.account.busyPulling"), () =>
          restoreBackup(VELLUM_GIT_SYNC.appId, item.path, mode),
        );
        emitGitSyncChanged();
        onDone();
        window.alert(t("settings.account.restoreDone"));
      } catch (err) {
        window.alert(String(err));
      }
    })();
  };

  actions.append(
    button(t("settings.account.restoreMerge"), () => run("merge")),
    button(t("settings.account.restoreOverwrite"), () => run("overwrite")),
  );
  row.append(meta, actions);
  return row;
}

/**
 * Account panel: GitHub / Gitee login, repo init, push, restore.
 */
export function renderAccountSection(body: HTMLElement): () => void {
  const root = document.createElement("div");
  root.className = "vellum-cloud-account";
  body.append(root);

  let disposed = false;
  let refreshGen = 0;
  let cloudSyncing = false;
  const cleanups: Array<() => void> = [];

  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const unlisten = await listen<SyncStatusPayload>(STATUS_EVENT, (event) => {
        cloudSyncing = event.payload.state === "syncing";
        const btn = root.querySelector<HTMLButtonElement>("[data-role='sync-now']");
        if (btn) showSyncSpinner(btn, cloudSyncing);
      });
      cleanups.push(unlisten);
    });
  }

  async function refresh(): Promise<void> {
    if (disposed) return;
    const gen = ++refreshGen;
    root.replaceChildren();
    root.append(createSectionTitle(t("settings.nav.sync")));

    if (!isTauri()) {
      root.append(statusLine(t("settings.account.tauriOnly"), "info"));
      return;
    }

    let session: SessionSummary;
    try {
      session = await getSession(VELLUM_GIT_SYNC.appId);
    } catch (err) {
      if (gen !== refreshGen || disposed) return;
      root.append(
        statusLine(
          t("settings.account.loadFailed", { error: String(err) }),
          "error",
        ),
      );
      return;
    }
    if (gen !== refreshGen || disposed) return;

    root.replaceChildren();
    root.append(createSectionTitle(t("settings.account.loginTitle")));

    if (!session.loggedIn) {
      root.append(statusLine(t("settings.account.signedOut"), "info"));
      const actions = document.createElement("div");
      actions.className = "vellum-cloud-actions";
      const ghReady = isProviderConfigured(VELLUM_GIT_SYNC, "github");
      const giteeReady = isProviderConfigured(VELLUM_GIT_SYNC, "gitee");
      actions.append(
        button(
          t("settings.account.loginGithub"),
          () => {
            void login(VELLUM_GIT_SYNC, "github").catch((err) => {
              if (!disposed) root.append(statusLine(String(err), "error"));
            });
          },
          !ghReady,
        ),
        button(
          t("settings.account.loginGitee"),
          () => {
            void login(VELLUM_GIT_SYNC, "gitee").catch((err) => {
              if (!disposed) root.append(statusLine(String(err), "error"));
            });
          },
          !giteeReady,
        ),
      );
      root.append(actions);
      root.append(statusLine(t("settings.account.loginHint"), "info"));
      if (!ghReady || !giteeReady) {
        root.append(statusLine(t("settings.account.needClientId"), "info"));
      }
      return;
    }

    root.append(
      statusLine(
        t("settings.account.signedInAs", {
          name: `${session.provider ?? "?"}/${displayName(session)}`,
        }),
        "ok",
      ),
    );

    const detailHost = document.createElement("div");
    root.append(detailHost);

    if (!session.repoFullName) {
      detailHost.append(statusLine(t("settings.account.repoNeedInit"), "info"));
      const repoInput = textInput("vellum-pwb-sync", "vellum-pwb-sync");
      detailHost.append(repoInput);
      const initActions = document.createElement("div");
      initActions.className = "vellum-cloud-actions";
      const feedback = document.createElement("div");
      initActions.append(
        button(t("settings.account.repoInit"), () => {
          void (async () => {
            try {
              await withBusy(t("settings.account.busyCreating"), async (modal) => {
                await initRepo(VELLUM_GIT_SYNC.appId, repoInput.value.trim());
                modal.setMessage(t("settings.account.busyPushing"));
                await pushBackup(VELLUM_GIT_SYNC.appId);
              });
              emitGitSyncChanged();
              await refresh();
            } catch (err) {
              feedback.replaceChildren(statusLine(String(err), "error"));
            }
          })();
        }),
        button(t("settings.account.logout"), () => {
          void logout(VELLUM_GIT_SYNC.appId).then(() => {
            emitGitSyncChanged();
            return refresh();
          });
        }),
      );
      detailHost.append(initActions, feedback);
      return;
    }

    detailHost.append(
      statusLine(
        t("settings.account.repoBound", { repo: session.repoFullName }),
        "info",
      ),
      statusLine(
        t("settings.account.lastSync", {
          time: formatSyncTime(session.lastSyncAt),
        }),
        "info",
      ),
    );

    const actions = document.createElement("div");
    actions.className = "vellum-cloud-actions";
    const feedback = document.createElement("div");

    const syncBtn = button(t("settings.account.syncNow"), () => {
      showSyncSpinner(syncBtn, true);
      void (async () => {
        try {
          const result = await requestManualCloudSync();
          emitGitSyncChanged();
          feedback.replaceChildren(
            statusLine(
              t("settings.account.pushOk", {
                path: result.path,
                remote: String(result.remoteBackupCount),
              }),
              "ok",
            ),
          );
          await refresh();
        } catch (err) {
          if (isSyncBusy(err)) {
            if (!cloudSyncing) showSyncSpinner(syncBtn, false);
            return;
          }
          showSyncSpinner(syncBtn, false);
          feedback.replaceChildren(statusLine(String(err), "error"));
        }
      })();
    });
    syncBtn.dataset.role = "sync-now";
    if (cloudSyncing) showSyncSpinner(syncBtn, true);

    actions.append(
      syncBtn,
      button(t("settings.account.restoreBackup"), () => {
        openRestoreDialog();
      }),
      button(t("settings.account.logout"), () => {
        void logout(VELLUM_GIT_SYNC.appId).then(() => {
          emitGitSyncChanged();
          return refresh();
        });
      }),
    );
    detailHost.append(actions, feedback);
    detailHost.append(statusLine(t("settings.account.syncHint"), "info"));
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
    // Do not append a second full section — only a status line after rebuild.
    void refresh().then(() => {
      if (!disposed) root.append(statusLine(detail, "error"));
    });
  };
  document.addEventListener("vellum:git-sync-error", onError);
  cleanups.push(() =>
    document.removeEventListener("vellum:git-sync-error", onError),
  );

  return () => {
    disposed = true;
    refreshGen += 1;
    for (const fn of cleanups) fn();
  };
}
