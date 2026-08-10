use std::fs::OpenOptions;
use std::io;
use std::path::Path;

use super::{sha256_file, ManifestEntry};

#[derive(Debug)]
pub enum SafeWriteError {
    Io(io::Error),
    FileConflict { expected: String, actual: String },
    FileLocked { path: String },
    EmptyReplacement,
}

impl From<io::Error> for SafeWriteError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

/// Writes a verified replacement while preserving a sibling backup.
/// The Excel/profile layer validates replacement bytes before calling this primitive.
pub fn safe_replace(
    path: impl AsRef<Path>,
    expected_sha256: &str,
    replacement: &[u8],
) -> Result<ManifestEntry, SafeWriteError> {
    let path = path.as_ref();
    match OpenOptions::new().read(true).write(true).open(path) {
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            return Err(SafeWriteError::FileLocked {
                path: path.to_string_lossy().into_owned(),
            });
        }
        Err(error) => return Err(SafeWriteError::Io(error)),
    }
    let (actual_sha256, _) = sha256_file(path)?;
    if actual_sha256 != expected_sha256 {
        return Err(SafeWriteError::FileConflict {
            expected: expected_sha256.to_owned(),
            actual: actual_sha256,
        });
    }
    if replacement.is_empty() {
        return Err(SafeWriteError::EmptyReplacement);
    }

    let backup = path.with_extension(format!(
        "{}bak",
        path.extension()
            .and_then(|value| value.to_str())
            .map_or(String::new(), |value| format!("{}.", value))
    ));
    std::fs::copy(path, &backup).map_err(|error| {
        SafeWriteError::Io(io::Error::new(error.kind(), format!("backup: {error}")))
    })?;
    let temporary = path.with_extension("project-digital-twin.tmp");
    std::fs::write(&temporary, replacement).map_err(|error| {
        SafeWriteError::Io(io::Error::new(error.kind(), format!("temporary: {error}")))
    })?;
    sync_temporary(&temporary).map_err(|error| {
        SafeWriteError::Io(io::Error::new(
            error.kind(),
            format!("sync temporary: {error}"),
        ))
    })?;
    let result = atomic_replace(&temporary, path).or_else(|error| {
        #[cfg(windows)]
        if error.kind() == io::ErrorKind::PermissionDenied {
            // Some Windows file providers reject ReplaceFileW for files in a
            // temporary directory. Removing only after the atomic API fails
            // keeps the normal path atomic and still preserves lock checks.
            if std::fs::copy(&temporary, path).is_ok() {
                let _ = std::fs::remove_file(&temporary);
                return Ok(());
            }
            std::fs::remove_file(path)?;
            return std::fs::rename(&temporary, path);
        }
        Err(error)
    });
    if let Err(error) = result {
        let _ = std::fs::remove_file(&temporary);
        if error.kind() == io::ErrorKind::PermissionDenied {
            return Err(SafeWriteError::FileLocked {
                path: path.to_string_lossy().into_owned(),
            });
        }
        return Err(SafeWriteError::Io(error));
    }
    let (sha256, size) = sha256_file(path)?;
    Ok(ManifestEntry {
        logical_role: "MANAGED_FILE_MASTER".to_owned(),
        path: path.to_string_lossy().into_owned(),
        sha256,
        size,
    })
}

#[cfg(not(windows))]
fn atomic_replace(source: &Path, destination: &Path) -> io::Result<()> {
    std::fs::rename(source, destination)
}

#[cfg(not(windows))]
fn sync_temporary(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(windows)]
fn sync_temporary(_path: &Path) -> io::Result<()> {
    // ReplaceFileW uses WRITE_THROUGH below; some Windows file providers
    // reject opening the temporary file for an explicit sync before replace.
    Ok(())
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const REPLACEFILE_WRITE_THROUGH: u32 = 0x0000_0001;

    #[link(name = "kernel32")]
    extern "system" {
        fn ReplaceFileW(
            replaced_file: *const u16,
            replacement_file: *const u16,
            backup_file: *const u16,
            replace_flags: u32,
            exclude: *mut std::ffi::c_void,
            reserved: *mut std::ffi::c_void,
        ) -> i32;
    }

    let replaced: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let replacement: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let moved = unsafe {
        ReplaceFileW(
            replaced.as_ptr(),
            replacement.as_ptr(),
            std::ptr::null(),
            REPLACEFILE_WRITE_THROUGH,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if moved == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}
