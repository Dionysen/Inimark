/**
 * Apply a unique old→new string replacement (Cursor-style apply_edit).
 * Fails when old_string is missing or appears more than once.
 */
export function applyUniqueReplace(
  text: string,
  oldString: string,
  newString: string,
): { ok: true; text: string } | { ok: false; error: string } {
  if (!oldString) {
    return { ok: false, error: "old_string must be non-empty" };
  }
  const first = text.indexOf(oldString);
  if (first < 0) {
    return { ok: false, error: "old_string not found in file" };
  }
  const second = text.indexOf(oldString, first + oldString.length);
  if (second >= 0) {
    return {
      ok: false,
      error: "old_string matches more than once; include more surrounding context",
    };
  }
  return {
    ok: true,
    text: text.slice(0, first) + newString + text.slice(first + oldString.length),
  };
}
