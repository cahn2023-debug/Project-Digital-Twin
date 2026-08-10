use std::collections::HashMap;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Default)]
pub struct WatcherState {
    pub stops: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[cfg(test)]
mod tests {
    use super::WatcherState;
    use std::sync::{atomic::AtomicBool, Arc};

    #[test]
    fn watcher_stop_flags_are_independent() {
        let state = WatcherState::default();
        let first = Arc::new(AtomicBool::new(false));
        let second = Arc::new(AtomicBool::new(false));
        state.stops.lock().expect("watcher state").extend([
            (String::from("source-1"), first.clone()),
            (String::from("source-2"), second.clone()),
        ]);

        first.store(true, std::sync::atomic::Ordering::Relaxed);
        assert!(first.load(std::sync::atomic::Ordering::Relaxed));
        assert!(!second.load(std::sync::atomic::Ordering::Relaxed));
    }
}
