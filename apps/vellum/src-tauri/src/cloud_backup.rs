//! Detached cloud-backup process.
//!
//! The main window exits first. This binary is started again with
//! `--vellum-cloud-backup` and the job on stdin, so the push outlives the UI.
//! Success posts a system notification. Failure asks to retry or stop, the same
//! choice the in-app dialog used to offer.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use dionysen_git_sync::{push_backup, Vault};
use purewriter_store::Library;
use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
use serde::{Deserialize, Serialize};

pub const CLOUD_BACKUP_FLAG: &str = "--vellum-cloud-backup";

static LAST_LIBRARY_ROOT: Mutex<Option<PathBuf>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupJob {
    pub app_id: String,
    pub library_root: String,
    pub success_title: String,
    pub success_body: String,
    pub fail_title: String,
    pub fail_message: String,
    pub retry_label: String,
    pub exit_label: String,
}

/// Runs the worker and returns true when this process was started as one.
/// The normal app path returns false without reading stdin.
pub fn run_cloud_backup_worker() -> bool {
    let worker = std::env::args().any(|arg| arg == CLOUD_BACKUP_FLAG);
    if !worker {
        return false;
    }
    let mut raw = String::new();
    let _ = std::io::stdin().read_to_string(&mut raw);
    match serde_json::from_str::<CloudBackupJob>(&raw) {
        Ok(job) => run_job(job),
        Err(err) => {
            let _ = MessageDialog::new()
                .set_title("Vellum")
                .set_description(&format!("Cloud backup could not start: {err}"))
                .set_level(MessageLevel::Error)
                .show();
        }
    }
    true
}

fn run_job(job: CloudBackupJob) {
    let title = job.success_title.clone();
    let body = job.success_body.clone();
    let fail_title = job.fail_title.clone();
    let fail_message = job.fail_message.clone();
    let retry_label = job.retry_label.clone();
    let exit_label = job.exit_label.clone();
    run_push_loop(
        || push_open_library(&job.app_id, &job.library_root),
        |error| {
            let message = fail_message.replace("{{error}}", error);
            ask_retry(&fail_title, &message, &retry_label, &exit_label)
        },
        || system_notify(&title, &body),
    );
}

/// Push until it succeeds or `ask_retry` says to stop.
pub fn run_push_loop(
    mut push: impl FnMut() -> Result<(), String>,
    mut ask_retry: impl FnMut(&str) -> bool,
    notify: impl FnOnce(),
) {
    loop {
        match push() {
            Ok(()) => {
                notify();
                return;
            }
            Err(error) => {
                if !ask_retry(&error) {
                    return;
                }
            }
        }
    }
}

fn push_open_library(app_id: &str, library_root: &str) -> Result<(), String> {
    let vault = Vault::open_default().map_err(|e| e.to_string())?;
    let lib = Library::open(library_root).map_err(|e| e.to_string())?;
    push_backup(&vault, app_id, &lib).map(|_| ()).map_err(|e| e.to_string())
}

fn ask_retry(title: &str, message: &str, retry_label: &str, exit_label: &str) -> bool {
    let result = MessageDialog::new()
        .set_title(title)
        .set_description(message)
        .set_level(MessageLevel::Warning)
        .set_buttons(MessageButtons::OkCancelCustom(
            retry_label.to_string(),
            exit_label.to_string(),
        ))
        .show();
    is_retry(&result, retry_label)
}

pub fn is_retry(result: &MessageDialogResult, retry_label: &str) -> bool {
    match result {
        MessageDialogResult::Ok | MessageDialogResult::Yes => true,
        MessageDialogResult::Custom(label) => label == retry_label,
        _ => false,
    }
}

/// Release the open library lock, then start a process that is not tied to the UI.
pub fn detach_cloud_backup(root: Option<PathBuf>, job_without_root: CloudBackupJob) -> Result<(), String> {
    let resolved = match root {
        Some(root) => {
            if let Ok(mut last) = LAST_LIBRARY_ROOT.lock() {
                *last = Some(root.clone());
            }
            Some(root)
        }
        None => LAST_LIBRARY_ROOT.lock().ok().and_then(|guard| guard.clone()),
    };
    let Some(root) = resolved else {
        return Ok(());
    };
    let mut job = job_without_root;
    job.library_root = root.display().to_string();
    spawn_worker(&job)
}

fn spawn_worker(job: &CloudBackupJob) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let payload = serde_json::to_vec(job).map_err(|e| e.to_string())?;
    let mut command = Command::new(exe);
    command
        .arg(CLOUD_BACKUP_FLAG)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    detach_command(&mut command);
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(&payload).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn detach_command(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
}

fn system_notify(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            applescript_string(body),
            applescript_string(title)
        );
        let _ = Command::new("osascript").arg("-e").arg(script).status();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = Command::new("notify-send").arg(title).arg(body).status();
    }
    #[cfg(windows)]
    {
        let script = format!(
            "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; \
             $n = New-Object System.Windows.Forms.NotifyIcon; \
             $n.Icon = [System.Drawing.SystemIcons]::Information; \
             $n.Visible = $true; \
             $n.ShowBalloonTip(8000, '{}', '{}', 'Info')",
            powershell_string(title),
            powershell_string(body)
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .status();
    }
}

#[cfg(target_os = "macos")]
fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(windows)]
fn powershell_string(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_loop_retries_then_notifies() {
        let mut attempts = 0;
        let mut asked = Vec::new();
        let mut notified = false;
        run_push_loop(
            || {
                attempts += 1;
                if attempts == 1 {
                    Err("offline".into())
                } else {
                    Ok(())
                }
            },
            |error| {
                asked.push(error.to_string());
                true
            },
            || notified = true,
        );
        assert_eq!(attempts, 2);
        assert_eq!(asked, vec!["offline".to_string()]);
        assert!(notified);
    }

    #[test]
    fn push_loop_stops_when_the_user_gives_up() {
        let mut attempts = 0;
        let mut notified = false;
        run_push_loop(
            || {
                attempts += 1;
                Err("denied".into())
            },
            |_| false,
            || notified = true,
        );
        assert_eq!(attempts, 1);
        assert!(!notified);
    }

    #[test]
    fn retry_button_is_the_custom_ok_label() {
        assert!(is_retry(
            &MessageDialogResult::Custom("重试".into()),
            "重试"
        ));
        assert!(!is_retry(
            &MessageDialogResult::Custom("直接退出".into()),
            "重试"
        ));
        assert!(!is_retry(&MessageDialogResult::Cancel, "重试"));
        assert!(is_retry(&MessageDialogResult::Ok, "重试"));
    }
}
