import {
  adoptSession,
  configureOss,
  deleteObject,
  getObjectText,
  getProfile,
  listObjects,
  listSiblingSessions,
  login,
  logout,
  putObject,
  type AppProfileSummary,
  type SiblingSession,
} from "@dionysen/cloud-sync";
import { createRow, createSectionTitle } from "@dionysen/settings-kit";
import { isTauri } from "@dionysen/shell";
import { t } from "../i18n/index.ts";
import {
  CLOUD_SYNC_CHANGED_EVENT,
  emitCloudSyncChanged,
  VELLUM_CLOUD_SYNC,
} from "./config.ts";

function field(
  label: string,
  input: HTMLInputElement,
  id: string,
): HTMLElement {
  return createRow(label, "", input, id);
}

function textInput(
  value: string,
  opts: {
    type?: string;
    placeholder?: string;
    autocomplete?: HTMLInputElement["autocomplete"];
  } = {},
): HTMLInputElement {
  const el = document.createElement("input");
  el.type = opts.type ?? "text";
  el.value = value;
  el.className = "vellum-settings-input";
  if (opts.placeholder) el.placeholder = opts.placeholder;
  if (opts.autocomplete) el.autocomplete = opts.autocomplete;
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vellum-settings-btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function statusLine(text: string, kind: "info" | "error" | "ok" = "info"): HTMLElement {
  const el = document.createElement("p");
  el.className = `vellum-cloud-status vellum-cloud-status--${kind}`;
  el.textContent = text;
  return el;
}

function displayName(profile: AppProfileSummary): string {
  return (
    profile.name ||
    profile.loginName ||
    profile.uid ||
    t("settings.account.unknownUser")
  );
}

/**
 * Account + Aliyun OSS settings panel.
 * OAuth covers identity only; OSS uses user-supplied AccessKey credentials.
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

    let profile: AppProfileSummary;
    let siblings: SiblingSession[] = [];
    try {
      profile = await getProfile(VELLUM_CLOUD_SYNC.appId);
      siblings = await listSiblingSessions(VELLUM_CLOUD_SYNC.appId);
    } catch (err) {
      root.append(
        statusLine(
          t("settings.account.loadFailed", { error: String(err) }),
          "error",
        ),
      );
      return;
    }

    // —— Login ——
    root.append(createSectionTitle(t("settings.account.loginTitle")));
    if (profile.loggedIn) {
      root.append(
        statusLine(
          t("settings.account.signedInAs", { name: displayName(profile) }),
          "ok",
        ),
      );
      const actions = document.createElement("div");
      actions.className = "vellum-cloud-actions";
      actions.append(
        button(t("settings.account.logout"), () => {
          void (async () => {
            try {
              await logout(VELLUM_CLOUD_SYNC.appId, false);
              emitCloudSyncChanged();
              await refresh();
            } catch (err) {
              root.append(
                statusLine(String(err), "error"),
              );
            }
          })();
        }),
      );
      root.append(actions);
    } else {
      root.append(statusLine(t("settings.account.signedOut"), "info"));
      const actions = document.createElement("div");
      actions.className = "vellum-cloud-actions";
      actions.append(
        button(t("settings.account.login"), () => {
          void (async () => {
            try {
              await login(VELLUM_CLOUD_SYNC);
            } catch (err) {
              root.append(statusLine(String(err), "error"));
            }
          })();
        }),
      );
      for (const sibling of siblings) {
        const label = t("settings.account.adopt", {
          app: sibling.appId,
          name:
            sibling.name ||
            sibling.loginName ||
            sibling.uid ||
            t("settings.account.unknownUser"),
        });
        actions.append(
          button(label, () => {
            void (async () => {
              try {
                await adoptSession({
                  fromAppId: sibling.appId,
                  toAppId: VELLUM_CLOUD_SYNC.appId,
                  copyOss: false,
                });
                emitCloudSyncChanged();
                await refresh();
              } catch (err) {
                root.append(statusLine(String(err), "error"));
              }
            })();
          }),
        );
      }
      root.append(actions);
      root.append(statusLine(t("settings.account.loginHint"), "info"));
      root.append(statusLine(t("settings.account.blankPageHint"), "info"));
    }

    // —— OSS ——
    root.append(createSectionTitle(t("settings.account.ossTitle")));
    root.append(statusLine(t("settings.account.ossHint"), "info"));

    const endpoint = textInput(profile.oss?.endpoint ?? "oss-cn-hangzhou.aliyuncs.com", {
      placeholder: "oss-cn-hangzhou.aliyuncs.com",
    });
    const bucket = textInput(profile.oss?.bucket ?? "", {
      placeholder: "my-bucket",
    });
    const accessKeyId = textInput(profile.oss?.accessKeyId ?? "", {
      autocomplete: "off",
    });
    const accessKeySecret = textInput("", {
      type: "password",
      placeholder: profile.hasOss
        ? t("settings.account.secretKeep")
        : t("settings.account.secretRequired"),
      autocomplete: "new-password",
    });
    const prefix = textInput(profile.oss?.prefix ?? "vellum/", {
      placeholder: "vellum/",
    });

    root.append(field(t("settings.account.endpoint"), endpoint, "account-oss-endpoint"));
    root.append(field(t("settings.account.bucket"), bucket, "account-oss-bucket"));
    root.append(field(t("settings.account.accessKeyId"), accessKeyId, "account-oss-ak"));
    root.append(
      field(t("settings.account.accessKeySecret"), accessKeySecret, "account-oss-sk"),
    );
    root.append(field(t("settings.account.prefix"), prefix, "account-oss-prefix"));

    const ossActions = document.createElement("div");
    ossActions.className = "vellum-cloud-actions";
    const statusHost = document.createElement("div");

    ossActions.append(
      button(t("settings.account.saveOss"), () => {
        void (async () => {
          try {
            await configureOss(VELLUM_CLOUD_SYNC.appId, {
              endpoint: endpoint.value.trim(),
              bucket: bucket.value.trim(),
              accessKeyId: accessKeyId.value.trim(),
              accessKeySecret: accessKeySecret.value.trim(),
              prefix: prefix.value.trim(),
            });
            emitCloudSyncChanged();
            statusHost.replaceChildren(
              statusLine(t("settings.account.ossSaved"), "ok"),
            );
            await refresh();
          } catch (err) {
            statusHost.replaceChildren(statusLine(String(err), "error"));
          }
        })();
      }),
      button(t("settings.account.testOss"), () => {
        void (async () => {
          const key = `_vellum_probe_${Date.now()}.txt`;
          const payload = `vellum-probe ${new Date().toISOString()}`;
          try {
            await putObject(
              VELLUM_CLOUD_SYNC.appId,
              key,
              payload,
              "text/plain",
            );
            const roundtrip = await getObjectText(VELLUM_CLOUD_SYNC.appId, key);
            await deleteObject(VELLUM_CLOUD_SYNC.appId, key);
            const listed = await listObjects(VELLUM_CLOUD_SYNC.appId, {
              maxKeys: 5,
            });
            if (roundtrip !== payload) {
              throw new Error("round-trip content mismatch");
            }
            statusHost.replaceChildren(
              statusLine(
                t("settings.account.testOk", { count: String(listed.length) }),
                "ok",
              ),
            );
          } catch (err) {
            statusHost.replaceChildren(statusLine(String(err), "error"));
          }
        })();
      }),
    );
    root.append(ossActions, statusHost);
  }

  void refresh();

  const onChanged = () => {
    void refresh();
  };
  document.addEventListener(CLOUD_SYNC_CHANGED_EVENT, onChanged);
  cleanups.push(() =>
    document.removeEventListener(CLOUD_SYNC_CHANGED_EVENT, onChanged),
  );

  const onError = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (disposed || !detail) return;
    root.append(statusLine(detail, "error"));
  };
  document.addEventListener("vellum:cloud-sync-error", onError);
  cleanups.push(() =>
    document.removeEventListener("vellum:cloud-sync-error", onError),
  );

  return () => {
    disposed = true;
    for (const fn of cleanups) fn();
  };
}
