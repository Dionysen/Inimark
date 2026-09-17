use rand::RngCore;

/// Generate a Pure Writer–style hex id (12–24 hex chars).
pub fn new_id() -> String {
    let mut bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}
