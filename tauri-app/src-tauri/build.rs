fn main() {
    // 配置 mpv 库路径
    #[cfg(feature = "mpv")]
    {
        let mpv_path = std::path::Path::new("F:\\20260227\\mpv");

        // 添加 include 目录
        let include_dir = mpv_path.join("include");
        if include_dir.exists() {
            println!("cargo:include={}", include_dir.display());
        }

        // 添加 lib 目录
        let lib_dir = mpv_path;
        if lib_dir.exists() {
            println!("cargo:rustc-link-search=native={}", lib_dir.display());
        }

        // 链接 mpv.lib
        println!("cargo:rustc-link-lib=mpv");
    }

    tauri_build::build()
}
