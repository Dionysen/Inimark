//! macOS traffic-light positioning for Overlay titlebars.
//!
//! Stock wry/tao only grow the title-bar container and leave each button's
//! `origin.y` alone. On recent macOS that leaves the lights flush with the
//! window top. This module uses the same centering formula as Inimark's
//! patched wry: `y` is the top inset, the container height is
//! `button_height + 2y`, and buttons are vertically centered.

#![cfg(target_os = "macos")]

use std::time::Duration;

use objc2::MainThreadMarker;
use objc2_app_kit::{NSView, NSWindow, NSWindowButton};
use objc2_foundation::NSPoint;
use tauri::{WebviewWindow, WindowEvent};

/// Left inset of the close button — matches `tauri.conf.json` / Inimark.
pub const TRAFFIC_LIGHT_X: f64 = 14.0;

/// Top inset — with 2× padding centers ~14px lights in a 36px titlebar.
pub const TRAFFIC_LIGHT_Y: f64 = 11.0;

pub fn position(window: &WebviewWindow) {
    let Ok(ptr) = window.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    // NSWindow AppKit calls require the main thread.
    let _mtm = MainThreadMarker::new().expect("traffic lights must run on main thread");

    unsafe {
        let ns_window = &*ptr.cast::<NSWindow>();
        let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(miniaturize) = ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton)
        else {
            return;
        };
        let zoom = ns_window.standardWindowButton(NSWindowButton::ZoomButton);

        let Some(title_bar) = close.superview() else {
            return;
        };
        let Some(container) = title_bar.superview() else {
            return;
        };

        let close_rect = close.frame();
        let button_height = close_rect.size.height;
        if button_height <= 0.0 {
            return;
        }

        // Same formula as Inimark's vendored wry inset_traffic_lights.
        let title_bar_frame_height = button_height + TRAFFIC_LIGHT_Y * 2.0;
        let mut container_rect = container.frame();
        container_rect.size.height = title_bar_frame_height;
        container_rect.origin.y = ns_window.frame().size.height - title_bar_frame_height;
        container.setFrame(container_rect);

        let space_between = miniaturize.frame().origin.x - close_rect.origin.x;
        let origin_y = (title_bar_frame_height - button_height) / 2.0;

        let buttons: &[&NSView] = if let Some(ref zoom_btn) = zoom {
            &[close.as_ref(), miniaturize.as_ref(), zoom_btn.as_ref()]
        } else {
            &[close.as_ref(), miniaturize.as_ref()]
        };

        for (i, button) in buttons.iter().enumerate() {
            button.setFrameOrigin(NSPoint::new(
                TRAFFIC_LIGHT_X + (i as f64) * space_between,
                origin_y,
            ));
        }
    }
}

fn position_on_main_thread(window: &WebviewWindow) {
    let window = window.clone();
    let _ = window.clone().run_on_main_thread(move || {
        position(&window);
    });
}

/// Apply once, retry after AppKit's delayed titlebar layout, and re-apply on
/// resize / theme / scale / focus so AppKit cannot leave lights stale.
pub fn install(window: &WebviewWindow) {
    position(window);

    let startup = window.clone();
    std::thread::spawn(move || {
        for delay_ms in [80_u64, 250, 600] {
            std::thread::sleep(Duration::from_millis(delay_ms));
            position_on_main_thread(&startup);
        }
    });

    let watched = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_)
        | WindowEvent::ThemeChanged(_)
        | WindowEvent::ScaleFactorChanged { .. }
        | WindowEvent::Focused(true) => {
            position_on_main_thread(&watched);
        }
        _ => {}
    });
}
