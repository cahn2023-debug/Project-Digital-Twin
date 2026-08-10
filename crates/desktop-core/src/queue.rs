// Queue operations stay on ManifestDb so SQLite transactions remain atomic.
// This module is the explicit queue-facing contract for future extraction.
pub use super::PendingJob;
