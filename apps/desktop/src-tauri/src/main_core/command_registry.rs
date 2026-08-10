pub fn run<F>(invoke_handler: F)
where
    F: Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static,
{
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(super::WatcherState::default())
        .manage(crate::EncryptedDbState::default())
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running Project Digital Twin desktop");
}
