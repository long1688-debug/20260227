//! Locates bundled runtime tools (ffmpeg, ZLMediaKit, node) shipped under `<install dir>/runtime/`.
//!
//! Lookup order: env override → `<exe dir>/runtime/<subdir>/` → (debug only) `src-tauri/resources/runtime/<subdir>/` → PATH.

use std::path::PathBuf;
use std::sync::OnceLock;

fn exe_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// `<exe dir>/runtime`, which is where Tauri `bundle.resources` and the Inno Setup script place runtime tools.
pub fn runtime_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()?
        .parent()
        .map(|p| p.join("runtime"))
}

fn resolve(env_var: &str, subdir: &str, name: &str) -> Option<PathBuf> {
    if let Ok(p) = std::env::var(env_var) {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }

    let file = exe_name(name);
    if let Some(candidate) = runtime_dir().map(|d| d.join(subdir).join(&file)) {
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    #[cfg(debug_assertions)]
    {
        let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("runtime")
            .join(subdir)
            .join(&file);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    which::which(name).ok()
}

pub fn ffmpeg() -> PathBuf {
    static FFMPEG: OnceLock<PathBuf> = OnceLock::new();
    FFMPEG
        .get_or_init(|| resolve("FFMPEG_PATH", "ffmpeg", "ffmpeg").unwrap_or_else(|| PathBuf::from("ffmpeg")))
        .clone()
}

pub fn node() -> PathBuf {
    static NODE: OnceLock<PathBuf> = OnceLock::new();
    NODE.get_or_init(|| resolve("NODE_PATH_EXE", "node", "node").unwrap_or_else(|| PathBuf::from("node")))
        .clone()
}

pub fn zlmediakit() -> Option<PathBuf> {
    resolve("ZLMEDIAKIT_PATH", "zlmediakit", "MediaServer")
}
