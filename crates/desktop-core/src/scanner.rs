use rusqlite::Row;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::{sha256_file, DiscoveredFile, FileVersion, ScanFailure};

pub fn scan_directory(
    root: impl AsRef<Path>,
    extensions: &[&str],
) -> io::Result<Vec<DiscoveredFile>> {
    Ok(scan_directory_best_effort(root, extensions)?.0)
}

pub fn scan_directory_best_effort(
    root: impl AsRef<Path>,
    extensions: &[&str],
) -> io::Result<(Vec<DiscoveredFile>, Vec<ScanFailure>)> {
    let mut paths = Vec::new();
    collect_files(root.as_ref(), extensions, &mut paths)?;
    let mut files = Vec::with_capacity(paths.len());
    let mut failures = Vec::new();
    for path in paths {
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) => {
                failures.push(ScanFailure {
                    path: path.to_string_lossy().into_owned(),
                    error: error.to_string(),
                });
                continue;
            }
        };
        let (sha256, size) = match sha256_file(&path) {
            Ok(result) => result,
            Err(error) => {
                failures.push(ScanFailure {
                    path: path.to_string_lossy().into_owned(),
                    error: error.to_string(),
                });
                continue;
            }
        };
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs().to_string());
        files.push(DiscoveredFile {
            path: path.to_string_lossy().into_owned(),
            sha256,
            size,
            modified_at,
        });
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok((files, failures))
}

fn collect_files(root: &Path, extensions: &[&str], output: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            collect_files(&path, extensions, output)?;
            continue;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if extensions
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(extension))
        {
            output.push(path);
        }
    }
    Ok(())
}

pub(crate) fn file_version_from_row(row: &Row<'_>) -> rusqlite::Result<FileVersion> {
    Ok(FileVersion {
        file_version_id: row.get(0)?,
        file_id: row.get(1)?,
        revision: row.get(2)?,
        sha256: row.get(3)?,
        size: row.get::<_, i64>(4)? as u64,
        modified_at: row.get(5)?,
        created_at: row.get(6)?,
        status: row.get(7)?,
    })
}
