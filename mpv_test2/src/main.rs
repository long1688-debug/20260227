use radiance_libmpv::Mpv;

fn main() {
    match Mpv::new() {
        Ok(mut mpv) => {
            println!("mpv 创建成功");

            if let Err(e) = mpv.set_property("hwdec", "auto") {
                println!("设置属性失败: {}", e);
            }

            if let Err(e) = mpv.command("stop", &[]) {
                println!("执行命令失败: {}", e);
            }

            println!("mpv API 测试通过");
        }
        Err(e) => {
            println!("mpv 创建失败: {}", e);
        }
    }
}
