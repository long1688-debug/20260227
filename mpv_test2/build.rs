fn main() {
    println!("cargo:rustc-link-search=native=F:\\20260227\\mpv");
    println!("cargo:rustc-link-lib=dylib=mpv");
}
