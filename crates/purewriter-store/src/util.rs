/// Approximate Pure Writer `count` / `summary` helpers.

pub fn content_count(content: &str) -> i64 {
    content
        .chars()
        .filter(|c| !matches!(c, '\n' | '\r'))
        .count() as i64
}

pub fn content_summary(content: &str, max_chars: usize) -> String {
    let flat: String = content
        .chars()
        .map(|c| if c == '\n' || c == '\r' { ' ' } else { c })
        .collect();
    let trimmed = flat.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    trimmed.chars().take(max_chars).collect()
}
