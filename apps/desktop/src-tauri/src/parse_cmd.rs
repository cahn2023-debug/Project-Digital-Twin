use base64::{engine::general_purpose::STANDARD, Engine as _};
use desktop_core::{parse_file as parse_desktop_file, DesktopParseResult, ParseRequest};
use std::fs;

#[tauri::command]
pub fn parse_file(request: ParseRequest) -> Result<DesktopParseResult, String> {
    parse_desktop_file(&request)
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    Ok(STANDARD.encode(fs::read(path).map_err(|error| error.to_string())?))
}
