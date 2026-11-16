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

/// ZLMediaKit API secret：环境变量 ZLM_SECRET，否则读取随包 config.ini 的 [api] secret
pub fn zlmediakit_secret() -> String {
    static SECRET: OnceLock<String> = OnceLock::new();
    SECRET
        .get_or_init(|| {
            if let Ok(s) = std::env::var("ZLM_SECRET") {
                return s;
            }
            let ini = zlmediakit().and_then(|p| p.parent().map(|d| d.join("config.ini")));
            let content = ini.and_then(|p| std::fs::read_to_string(p).ok()).unwrap_or_default();
            let mut in_api = false;
            for line in content.lines().map(str::trim) {
                if line.starts_with('[') {
                    in_api = line == "[api]";
                } else if in_api {
                    if let Some(v) = line.strip_prefix("secret=") {
                        return v.trim().to_string();
                    }
                }
            }
            String::new()
        })
        .clone()
}

#[tauri::command]
pub fn get_zlm_secret() -> String {
    zlmediakit_secret()
}
