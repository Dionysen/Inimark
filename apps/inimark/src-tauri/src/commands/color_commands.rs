//! Screen color sampler (system eyedropper).

/// Opens the platform color sampler and returns `#RRGGBB`.
#[tauri::command]
pub async fn pick_screen_color() -> Result<String, String> {
  #[cfg(target_os = "macos")]
  {
    macos_pick_screen_color().await
  }
  #[cfg(windows)]
  {
    tauri::async_runtime::spawn_blocking(super::windows_color_picker::run)
      .await
      .map_err(|e| format!("Color picker failed: {e}"))?
  }
  #[cfg(not(any(target_os = "macos", windows)))]
  {
    Err("Screen color picker is not available on this platform".into())
  }
}

#[cfg(target_os = "macos")]
async fn macos_pick_screen_color() -> Result<String, String> {
  use block2::RcBlock;
  use dispatch2::DispatchQueue;
  use objc2::rc::Retained;
  use objc2_app_kit::{NSColor, NSColorSampler, NSColorSpace};
  use std::sync::Mutex;
  use tokio::sync::oneshot;

  let (tx, rx) = oneshot::channel::<Option<String>>();

  DispatchQueue::main().exec_async(move || {
    let sampler = NSColorSampler::new();
    let tx = Mutex::new(Some(tx));
    let handler = RcBlock::new(move |color: *mut NSColor| {
      let Ok(mut guard) = tx.lock() else {
        return;
      };
      let Some(tx) = guard.take() else {
        return;
      };
      if color.is_null() {
        let _ = tx.send(None);
        return;
      }
      let Some(color) = (unsafe { Retained::retain(color) }) else {
        let _ = tx.send(None);
        return;
      };
      let srgb = NSColorSpace::sRGBColorSpace();
      let converted = color
        .colorUsingColorSpace(&srgb)
        .unwrap_or_else(|| color.clone());
      let r = (converted.redComponent() * 255.0).round().clamp(0.0, 255.0) as u8;
      let g = (converted.greenComponent() * 255.0).round().clamp(0.0, 255.0) as u8;
      let b = (converted.blueComponent() * 255.0).round().clamp(0.0, 255.0) as u8;
      let _ = tx.send(Some(format!("#{r:02x}{g:02x}{b:02x}")));
    });

    // NSColorSampler retains itself until the session completes; keep the block alive.
    unsafe {
      sampler.showSamplerWithSelectionHandler(&handler);
    }
    std::mem::forget(handler);
  });

  match rx.await {
    Ok(Some(hex)) => Ok(hex),
    Ok(None) => Err("Color picker cancelled".into()),
    Err(_) => Err("Color picker failed".into()),
  }
}
