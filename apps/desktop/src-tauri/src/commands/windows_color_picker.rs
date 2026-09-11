//! Windows fullscreen screenshot overlay color picker with live magnifier.

use std::mem::size_of;
use std::sync::atomic::{AtomicBool, Ordering};

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
  BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateSolidBrush, DeleteDC,
  DeleteObject, EndPaint, FillRect, FrameRect, GetDC, GetPixel, GetStockObject, InvalidateRect,
  ReleaseDC, SelectObject, SetBkMode, SetTextColor, TextOutW, CLR_INVALID, DEFAULT_GUI_FONT, HBITMAP,
  HDC, PAINTSTRUCT, SRCCOPY, TRANSPARENT,
};
use windows::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;
use windows::Win32::UI::WindowsAndMessaging::{
  CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetCursorPos, GetMessageW,
  LoadCursorW, PostQuitMessage, RegisterClassExW, SetCursor, ShowWindow, TranslateMessage,
  CS_HREDRAW, CS_VREDRAW, IDC_CROSS, MSG, SW_SHOW, WM_DESTROY, WM_KEYDOWN, WM_LBUTTONDOWN,
  WM_MOUSEMOVE, WM_PAINT, WM_SETCURSOR, WNDCLASSEXW, WS_EX_TOPMOST, WS_POPUP, WS_VISIBLE,
};
use windows::Win32::UI::WindowsAndMessaging::{
  GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
};

const CLASS_NAME: PCWSTR = w!("InimarkScreenColorPicker");
const MAG_SRC: i32 = 11; // odd grid of source pixels
const MAG_SCALE: i32 = 12;
const MAG_SIZE: i32 = MAG_SRC * MAG_SCALE;
const CANCEL_W: i32 = 64;
const CANCEL_H: i32 = 32;
const CANCEL_PAD: i32 = 20;

static CLASS_READY: AtomicBool = AtomicBool::new(false);

struct PickerCtx {
  /// Virtual-screen origin (may be negative on multi-monitor).
  vx: i32,
  vy: i32,
  width: i32,
  height: i32,
  /// Memory DC holding the frozen screenshot.
  mem_dc: HDC,
  bitmap: HBITMAP,
  /// Object previously selected into `mem_dc` (restored on drop).
  old_obj: windows::Win32::Graphics::Gdi::HGDIOBJ,
  /// Cursor in screen coordinates.
  cursor_x: i32,
  cursor_y: i32,
  result: Option<Result<String, String>>,
}

impl PickerCtx {
  fn local(&self, screen_x: i32, screen_y: i32) -> (i32, i32) {
    (screen_x - self.vx, screen_y - self.vy)
  }

  fn sample_hex(&self, screen_x: i32, screen_y: i32) -> Option<String> {
    let (lx, ly) = self.local(screen_x, screen_y);
    if lx < 0 || ly < 0 || lx >= self.width || ly >= self.height {
      return None;
    }
    unsafe {
      let color = GetPixel(self.mem_dc, lx, ly);
      if color.0 == CLR_INVALID {
        return None;
      }
      Some(colorref_to_hex(color.0))
    }
  }

  fn cancel_rect(&self) -> RECT {
    RECT {
      left: self.width - CANCEL_PAD - CANCEL_W,
      top: CANCEL_PAD,
      right: self.width - CANCEL_PAD,
      bottom: CANCEL_PAD + CANCEL_H,
    }
  }

  fn hit_cancel(&self, screen_x: i32, screen_y: i32) -> bool {
    let (lx, ly) = self.local(screen_x, screen_y);
    let r = self.cancel_rect();
    lx >= r.left && lx < r.right && ly >= r.top && ly < r.bottom
  }
}

fn colorref_to_hex(color: u32) -> String {
  let r = (color & 0xff) as u8;
  let g = ((color >> 8) & 0xff) as u8;
  let b = ((color >> 16) & 0xff) as u8;
  format!("#{r:02x}{g:02x}{b:02x}")
}

fn capture_virtual_screen() -> Result<PickerCtx, String> {
  unsafe {
    let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
    let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
    let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    if width <= 0 || height <= 0 {
      return Err("Color picker failed: invalid screen size".into());
    }

    let screen_dc = GetDC(None);
    if screen_dc.is_invalid() {
      return Err("Color picker failed: GetDC".into());
    }

    let mem_dc = CreateCompatibleDC(Some(screen_dc));
    if mem_dc.is_invalid() {
      ReleaseDC(None, screen_dc);
      return Err("Color picker failed: CreateCompatibleDC".into());
    }

    let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
    if bitmap.is_invalid() {
      let _ = DeleteDC(mem_dc);
      ReleaseDC(None, screen_dc);
      return Err("Color picker failed: CreateCompatibleBitmap".into());
    }

    let previous = SelectObject(mem_dc, bitmap.into());
    let blit = BitBlt(mem_dc, 0, 0, width, height, Some(screen_dc), vx, vy, SRCCOPY);
    ReleaseDC(None, screen_dc);

    if blit.is_err() {
      let _ = SelectObject(mem_dc, previous);
      let _ = DeleteObject(bitmap.into());
      let _ = DeleteDC(mem_dc);
      return Err("Color picker failed: BitBlt".into());
    }

    let mut pt = POINT::default();
    let _ = GetCursorPos(&mut pt);

    Ok(PickerCtx {
      vx,
      vy,
      width,
      height,
      mem_dc,
      bitmap,
      old_obj: previous,
      cursor_x: pt.x,
      cursor_y: pt.y,
      result: None,
    })
  }
}

impl Drop for PickerCtx {
  fn drop(&mut self) {
    unsafe {
      let _ = SelectObject(self.mem_dc, self.old_obj);
      let _ = DeleteObject(self.bitmap.into());
      let _ = DeleteDC(self.mem_dc);
    }
  }
}

fn ensure_class(instance: HINSTANCE) -> Result<(), String> {
  if CLASS_READY.load(Ordering::SeqCst) {
    return Ok(());
  }
  let wc = WNDCLASSEXW {
    cbSize: size_of::<WNDCLASSEXW>() as u32,
    style: CS_HREDRAW | CS_VREDRAW,
    lpfnWndProc: Some(wnd_proc),
    hInstance: instance,
    hCursor: unsafe { LoadCursorW(None, IDC_CROSS).unwrap_or_default() },
    lpszClassName: CLASS_NAME,
    ..Default::default()
  };
  unsafe {
    let atom = RegisterClassExW(&wc);
    if atom == 0 {
      // ERROR_CLASS_ALREADY_EXISTS is fine when re-entering the picker.
      let _ = windows::core::Error::from_win32();
    }
  }
  CLASS_READY.store(true, Ordering::SeqCst);
  Ok(())
}

fn magnifier_rect(ctx: &PickerCtx) -> RECT {
  let (lx, ly) = ctx.local(ctx.cursor_x, ctx.cursor_y);
  let chip_h = 36;
  let mut left = lx + 28;
  let mut top = ly + 28;
  if left + MAG_SIZE + 12 > ctx.width {
    left = lx - 28 - MAG_SIZE;
  }
  if top + MAG_SIZE + chip_h + 16 > ctx.height {
    top = ly - 28 - MAG_SIZE - chip_h;
  }
  // Keep clear of the Esc button.
  let cancel = ctx.cancel_rect();
  if left < cancel.right + 12 && left + MAG_SIZE > cancel.left - 12 && top < cancel.bottom + 12 {
    top = cancel.bottom + 16;
  }
  left = left.clamp(8, (ctx.width - MAG_SIZE - 8).max(8));
  top = top.clamp(8, (ctx.height - MAG_SIZE - chip_h - 16).max(8));
  RECT {
    left,
    top,
    right: left + MAG_SIZE,
    bottom: top + MAG_SIZE,
  }
}

fn draw_overlay(hdc: HDC, ctx: &PickerCtx) {
  unsafe {
    // Frozen screenshot only — no chrome bar.
    let _ = BitBlt(
      hdc,
      0,
      0,
      ctx.width,
      ctx.height,
      Some(ctx.mem_dc),
      0,
      0,
      SRCCOPY,
    );

    SetBkMode(hdc, TRANSPARENT);
    let font = GetStockObject(DEFAULT_GUI_FONT);
    let old_font = SelectObject(hdc, font);

    // Compact floating cancel control (top-right).
    let cancel = ctx.cancel_rect();
    let shadow = RECT {
      left: cancel.left + 2,
      top: cancel.top + 2,
      right: cancel.right + 2,
      bottom: cancel.bottom + 2,
    };
    let shadow_brush = CreateSolidBrush(COLORREF(0x00_00_00_00));
    FillRect(hdc, &shadow, shadow_brush);
    let _ = DeleteObject(shadow_brush.into());
    let btn_brush = CreateSolidBrush(COLORREF(0x00_2a_2a_2a));
    FillRect(hdc, &cancel, btn_brush);
    let _ = DeleteObject(btn_brush.into());
    let border_brush = CreateSolidBrush(COLORREF(0x00_d0_d0_d0));
    let _ = FrameRect(hdc, &cancel, border_brush);
    let _ = DeleteObject(border_brush.into());
    SetTextColor(hdc, COLORREF(0x00_f5_f5_f5));
    let cancel_label: Vec<u16> = "Esc"
      .encode_utf16()
      .chain(std::iter::once(0))
      .collect();
    let _ = TextOutW(
      hdc,
      cancel.left + 20,
      cancel.top + 8,
      &cancel_label[..cancel_label.len() - 1],
    );

    // Magnifier loupe + compact color chip.
    let mag = magnifier_rect(ctx);
    let (lx, ly) = ctx.local(ctx.cursor_x, ctx.cursor_y);
    let half = MAG_SRC / 2;
    for sy in 0..MAG_SRC {
      for sx in 0..MAG_SRC {
        let src_x = lx + sx - half;
        let src_y = ly + sy - half;
        let color = if src_x >= 0 && src_y >= 0 && src_x < ctx.width && src_y < ctx.height {
          GetPixel(ctx.mem_dc, src_x, src_y)
        } else {
          COLORREF(0)
        };
        let brush = CreateSolidBrush(color);
        let cell = RECT {
          left: mag.left + sx * MAG_SCALE,
          top: mag.top + sy * MAG_SCALE,
          right: mag.left + (sx + 1) * MAG_SCALE,
          bottom: mag.top + (sy + 1) * MAG_SCALE,
        };
        FillRect(hdc, &cell, brush);
        let _ = DeleteObject(brush.into());
      }
    }

    // Soft dual-tone loupe frame.
    let outer = RECT {
      left: mag.left - 2,
      top: mag.top - 2,
      right: mag.right + 2,
      bottom: mag.bottom + 2,
    };
    let frame_dark = CreateSolidBrush(COLORREF(0x00_101010));
    let _ = FrameRect(hdc, &outer, frame_dark);
    let _ = DeleteObject(frame_dark.into());
    let frame_light = CreateSolidBrush(COLORREF(0x00_ffffff));
    let _ = FrameRect(hdc, &mag, frame_light);
    let _ = DeleteObject(frame_light.into());

    // Center sample marker.
    let cx0 = mag.left + half * MAG_SCALE;
    let cy0 = mag.top + half * MAG_SCALE;
    let center_cell = RECT {
      left: cx0,
      top: cy0,
      right: cx0 + MAG_SCALE,
      bottom: cy0 + MAG_SCALE,
    };
    let ring = CreateSolidBrush(COLORREF(0x00_ffffff));
    let _ = FrameRect(hdc, &center_cell, ring);
    let _ = DeleteObject(ring.into());
    let ring2 = CreateSolidBrush(COLORREF(0x00_000000));
    let inset = RECT {
      left: cx0 + 1,
      top: cy0 + 1,
      right: cx0 + MAG_SCALE - 1,
      bottom: cy0 + MAG_SCALE - 1,
    };
    let _ = FrameRect(hdc, &inset, ring2);
    let _ = DeleteObject(ring2.into());

    // Single readout strip under the loupe: swatch + hex.
    let center = GetPixel(ctx.mem_dc, lx.clamp(0, ctx.width - 1), ly.clamp(0, ctx.height - 1));
    let hex = colorref_to_hex(center.0);
    let chip = RECT {
      left: mag.left - 2,
      top: mag.bottom + 8,
      right: mag.right + 2,
      bottom: mag.bottom + 36,
    };
    let chip_shadow = RECT {
      left: chip.left + 2,
      top: chip.top + 2,
      right: chip.right + 2,
      bottom: chip.bottom + 2,
    };
    let chip_shadow_brush = CreateSolidBrush(COLORREF(0x00_000000));
    FillRect(hdc, &chip_shadow, chip_shadow_brush);
    let _ = DeleteObject(chip_shadow_brush.into());
    let chip_brush = CreateSolidBrush(COLORREF(0x00_f7_f7_f7));
    FillRect(hdc, &chip, chip_brush);
    let _ = DeleteObject(chip_brush.into());
    let chip_border = CreateSolidBrush(COLORREF(0x00_202020));
    let _ = FrameRect(hdc, &chip, chip_border);
    let _ = DeleteObject(chip_border.into());

    let swatch = RECT {
      left: chip.left + 6,
      top: chip.top + 6,
      right: chip.left + 22,
      bottom: chip.bottom - 6,
    };
    let swatch_brush = CreateSolidBrush(center);
    FillRect(hdc, &swatch, swatch_brush);
    let _ = DeleteObject(swatch_brush.into());
    let swatch_border = CreateSolidBrush(COLORREF(0x00_404040));
    let _ = FrameRect(hdc, &swatch, swatch_border);
    let _ = DeleteObject(swatch_border.into());

    SetTextColor(hdc, COLORREF(0x00_202020));
    let hex_wide: Vec<u16> = hex.encode_utf16().chain(std::iter::once(0)).collect();
    let _ = TextOutW(hdc, chip.left + 30, chip.top + 7, &hex_wide[..hex_wide.len() - 1]);

    let _ = SelectObject(hdc, old_font);
  }
}

unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
  unsafe {
    let ctx_ptr = windows::Win32::UI::WindowsAndMessaging::GetWindowLongPtrW(
      hwnd,
      windows::Win32::UI::WindowsAndMessaging::GWLP_USERDATA,
    ) as *mut PickerCtx;

    match msg {
      WM_SETCURSOR => {
        if let Ok(cross) = LoadCursorW(None, IDC_CROSS) {
          let _ = SetCursor(Some(cross));
        }
        return LRESULT(1);
      }
      WM_MOUSEMOVE if !ctx_ptr.is_null() => {
        let ctx = &mut *ctx_ptr;
        let mut pt = POINT::default();
        let _ = GetCursorPos(&mut pt);
        if pt.x != ctx.cursor_x || pt.y != ctx.cursor_y {
          ctx.cursor_x = pt.x;
          ctx.cursor_y = pt.y;
          let _ = InvalidateRect(Some(hwnd), None, false);
        }
        return LRESULT(0);
      }
      WM_LBUTTONDOWN if !ctx_ptr.is_null() => {
        let ctx = &mut *ctx_ptr;
        let mut pt = POINT::default();
        let _ = GetCursorPos(&mut pt);
        if ctx.hit_cancel(pt.x, pt.y) {
          ctx.result = Some(Err("Color picker cancelled".into()));
          let _ = DestroyWindow(hwnd);
          return LRESULT(0);
        }
        match ctx.sample_hex(pt.x, pt.y) {
          Some(hex) => {
            ctx.result = Some(Ok(hex));
            let _ = DestroyWindow(hwnd);
          }
          None => {
            ctx.result = Some(Err("Color picker failed".into()));
            let _ = DestroyWindow(hwnd);
          }
        }
        return LRESULT(0);
      }
      WM_KEYDOWN if !ctx_ptr.is_null() => {
        if wparam.0 == VK_ESCAPE.0 as usize {
          let ctx = &mut *ctx_ptr;
          ctx.result = Some(Err("Color picker cancelled".into()));
          let _ = DestroyWindow(hwnd);
          return LRESULT(0);
        }
      }
      WM_PAINT if !ctx_ptr.is_null() => {
        let ctx = &*ctx_ptr;
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);

        // Double-buffer to avoid flicker.
        let buf_dc = CreateCompatibleDC(Some(hdc));
        let buf_bmp = CreateCompatibleBitmap(hdc, ctx.width, ctx.height);
        let old = SelectObject(buf_dc, buf_bmp.into());
        draw_overlay(buf_dc, ctx);
        let _ = BitBlt(hdc, 0, 0, ctx.width, ctx.height, Some(buf_dc), 0, 0, SRCCOPY);
        let _ = SelectObject(buf_dc, old);
        let _ = DeleteObject(buf_bmp.into());
        let _ = DeleteDC(buf_dc);

        let _ = EndPaint(hwnd, &ps);
        return LRESULT(0);
      }
      WM_DESTROY => {
        PostQuitMessage(0);
        return LRESULT(0);
      }
      _ => {}
    }

    DefWindowProcW(hwnd, msg, wparam, lparam)
  }
}

/// Blocks until the user picks a color, cancels via Esc / button.
pub fn run() -> Result<String, String> {
  let mut ctx = capture_virtual_screen()?;

  unsafe {
    let module = windows::Win32::System::LibraryLoader::GetModuleHandleW(None)
      .map_err(|e| e.to_string())?;
    let instance = HINSTANCE(module.0);
    ensure_class(instance)?;

    let hwnd = CreateWindowExW(
      WS_EX_TOPMOST,
      CLASS_NAME,
      w!("Inimark Color Picker"),
      WS_POPUP | WS_VISIBLE,
      ctx.vx,
      ctx.vy,
      ctx.width,
      ctx.height,
      None,
      None,
      Some(instance),
      None,
    )
    .map_err(|e| format!("Color picker window failed: {e}"))?;

    windows::Win32::UI::WindowsAndMessaging::SetWindowLongPtrW(
      hwnd,
      windows::Win32::UI::WindowsAndMessaging::GWLP_USERDATA,
      &mut ctx as *mut PickerCtx as isize,
    );

    let _ = ShowWindow(hwnd, SW_SHOW);
    let _ = windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow(hwnd);

    let mut msg = MSG::default();
    while GetMessageW(&mut msg, None, 0, 0).as_bool() {
      let _ = TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }

    // Window is destroyed; clear USERDATA only if still valid — DestroyWindow already ran.
    let _ = hwnd;
  }

  ctx
    .result
    .take()
    .unwrap_or_else(|| Err("Color picker cancelled".into()))
}

#[cfg(test)]
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
