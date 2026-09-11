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
    windows_pick_screen_color().await
  }
  #[cfg(not(any(target_os = "macos", windows)))]
  {
    Err("Screen color picker is not available on this platform".into())
  }
}

#[cfg(windows)]
fn colorref_to_hex(color: u32) -> String {
  // COLORREF packs 0x00BBGGRR
  let r = (color & 0xff) as u8;
  let g = ((color >> 8) & 0xff) as u8;
  let b = ((color >> 16) & 0xff) as u8;
  format!("#{r:02x}{g:02x}{b:02x}")
}

/// Sample one screen pixel via BitBlt (more reliable than GetPixel on a screen DC).
#[cfg(windows)]
fn sample_screen_pixel(x: i32, y: i32) -> Option<String> {
  use windows::Win32::Foundation::COLORREF;
  use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetPixel,
    ReleaseDC, SelectObject, CLR_INVALID, SRCCOPY,
  };

  unsafe {
    let screen_dc = GetDC(None);
    if screen_dc.is_invalid() {
      return None;
    }

    let mem_dc = CreateCompatibleDC(Some(screen_dc));
    if mem_dc.is_invalid() {
      ReleaseDC(None, screen_dc);
      return None;
    }

    let bitmap = CreateCompatibleBitmap(screen_dc, 1, 1);
    if bitmap.is_invalid() {
      let _ = DeleteDC(mem_dc);
      ReleaseDC(None, screen_dc);
      return None;
    }

    let previous = SelectObject(mem_dc, bitmap.into());
    let blit_ok = BitBlt(mem_dc, 0, 0, 1, 1, Some(screen_dc), x, y, SRCCOPY);
    let color = if blit_ok.is_ok() {
      GetPixel(mem_dc, 0, 0)
    } else {
      COLORREF(CLR_INVALID)
    };

    let _ = SelectObject(mem_dc, previous);
    let _ = DeleteObject(bitmap.into());
    let _ = DeleteDC(mem_dc);
    ReleaseDC(None, screen_dc);

    if color.0 == CLR_INVALID {
      return None;
    }
    Some(colorref_to_hex(color.0))
  }
}

#[cfg(windows)]
mod windows_picker {
  use super::sample_screen_pixel;
  use std::sync::atomic::{AtomicBool, Ordering};
  use std::sync::Mutex;
  use std::time::Duration;
  use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
  use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON};
  use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, LoadCursorW, PostQuitMessage, SetCursor,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, IDC_CROSS, KBDLLHOOKSTRUCT,
    MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_LBUTTONDOWN, WM_QUIT,
  };

  static DONE: AtomicBool = AtomicBool::new(false);
  static RESULT: Mutex<Option<Result<String, String>>> = Mutex::new(None);

  unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
      if code >= 0 && wparam.0 == WM_LBUTTONDOWN as usize && !DONE.load(Ordering::SeqCst) {
        let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        let outcome = match sample_screen_pixel(info.pt.x, info.pt.y) {
          Some(hex) => Ok(hex),
          None => Err("Color picker failed".into()),
        };
        if let Ok(mut slot) = RESULT.lock() {
          *slot = Some(outcome);
        }
        DONE.store(true, Ordering::SeqCst);
        PostQuitMessage(0);
        return LRESULT(1);
      }
      CallNextHookEx(None, code, wparam, lparam)
    }
  }

  unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
      if code >= 0 && wparam.0 == WM_KEYDOWN as usize && !DONE.load(Ordering::SeqCst) {
        let info = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        if info.vkCode == VK_ESCAPE.0 as u32 {
          if let Ok(mut slot) = RESULT.lock() {
            *slot = Some(Err("Color picker cancelled".into()));
          }
          DONE.store(true, Ordering::SeqCst);
          PostQuitMessage(0);
          return LRESULT(1);
        }
      }
      CallNextHookEx(None, code, wparam, lparam)
    }
  }

  /// Global low-level hooks + message pump so clicks outside the app are captured.
  pub fn run() -> Result<String, String> {
    // Wait out the UI click that started this command.
    unsafe {
      while GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 {
        std::thread::sleep(Duration::from_millis(10));
      }
    }

    DONE.store(false, Ordering::SeqCst);
    if let Ok(mut slot) = RESULT.lock() {
      *slot = None;
    }

    let mouse_hook: HHOOK;
    let keyboard_hook: HHOOK;

    unsafe {
      let cross = LoadCursorW(None, IDC_CROSS).map_err(|e| e.to_string())?;
      let _ = SetCursor(Some(cross));

      mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0)
        .map_err(|e| format!("Color picker hook failed: {e}"))?;
      keyboard_hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0) {
        Ok(h) => h,
        Err(e) => {
          let _ = UnhookWindowsHookEx(mouse_hook);
          return Err(format!("Color picker hook failed: {e}"));
        }
      };

      let mut msg = MSG::default();
      loop {
        let _ = SetCursor(Some(cross));
        let ok = GetMessageW(&mut msg, None, 0, 0);
        if !ok.as_bool() || msg.message == WM_QUIT {
          break;
        }
        let _ = TranslateMessage(&msg);
        DispatchMessageW(&msg);
      }

      let _ = UnhookWindowsHookEx(mouse_hook);
      let _ = UnhookWindowsHookEx(keyboard_hook);
    }

    RESULT
      .lock()
      .map_err(|_| "Color picker failed".to_string())?
      .take()
      .unwrap_or_else(|| Err("Color picker cancelled".into()))
  }
}

#[cfg(windows)]
async fn windows_pick_screen_color() -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(windows_picker::run)
    .await
    .map_err(|e| format!("Color picker failed: {e}"))?
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

#[cfg(all(test, windows))]
mod tests {
  use super::colorref_to_hex;

  #[test]
  fn colorref_packs_bgr_to_hex() {
    assert_eq!(colorref_to_hex(0x00_00_00_ff), "#ff0000");
    assert_eq!(colorref_to_hex(0x00_00_ff_00), "#00ff00");
    assert_eq!(colorref_to_hex(0x00_ff_00_00), "#0000ff");
    assert_eq!(colorref_to_hex(0x00_4e_b2_89), "#89b24e");
  }
}
