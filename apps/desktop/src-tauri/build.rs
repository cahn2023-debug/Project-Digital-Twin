fn main() {
    let icon = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons/icon.ico");
    if !icon.exists() {
        std::fs::write(icon, minimal_icon()).expect("write fallback Windows icon");
    }
    tauri_build::build()
}

fn minimal_icon() -> Vec<u8> {
    vec![
        0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0, 48, 0, 0, 0, 22, 0, 0, 0, 40, 0, 0, 0, 1, 0, 0,
        0, 2, 0, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 42, 132, 25, 255, 0, 0, 0, 0,
    ]
}
