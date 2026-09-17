/// Build an 18-digit orderKey from a rank-like index (1-based typical).
pub fn order_key_from_index(index: u64) -> String {
    format!("{index:018}")
}

/// Next orderKey after the max existing key in a sibling group.
pub fn next_order_key(max_existing: Option<&str>) -> String {
    let n = max_existing
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);
    order_key_from_index(n.saturating_add(1))
}
