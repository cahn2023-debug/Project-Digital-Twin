use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Default)]
pub struct WatcherState {
    pub stop: Mutex<Option<Arc<AtomicBool>>>,
}
