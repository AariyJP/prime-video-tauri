use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

struct DiscordState {
    client: Mutex<Option<DiscordIpcClient>>,
}

fn make_activity() -> activity::Activity<'static> {
    let start_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    activity::Activity::new()
        .activity_type(activity::ActivityType::Watching)
        // .details("Watching Prime Video")
        // .state("Browsing...")
        // .assets(
        //     activity::Assets::new()
        //         .large_image("prime-logo") // You need to upload this asset in your Discord App
        //         .large_text("Prime Video"),
        // )
        .timestamps(activity::Timestamps::new().start(start_time as i64))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::env;
    use std::path::PathBuf;

    let local_app_data = env::var("localappdata").unwrap_or_default();

    env::set_var(
        "WEBVIEW2_USER_DATA_FOLDER",
        PathBuf::from(&local_app_data).join("net.aariy.wb2"),
    );

    let discord_state = DiscordState {
        client: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(discord_state)
        .setup(move |app| {
            let handle = app.handle();
            let discord_state: tauri::State<DiscordState> = handle.state();
            let mut client_lock = discord_state.client.lock().unwrap();
            let mut client = DiscordIpcClient::new("739528267039768647");

            if client.connect().is_ok() {
                if client.set_activity(make_activity()).is_err() {
                    println!("Failed to set Discord activity.");
                }
                *client_lock = Some(client);
            } else {
                println!("Failed to connect to Discord.");
            }

            let exe_path = std::env::current_exe().expect("Failed to get current exe path");
            let exe_dir = exe_path.parent().expect("Failed to get parent directory");

            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("https://www.amazon.co.jp/gp/video/storefront".into()),
            )
            .title("Prime Video")
            .inner_size(1280.0, 800.0)
            .decorations(false)
            .browser_extensions_enabled(true)
            .additional_browser_args(
                format!(
                    "--load-extension={},{} --disable-gpu",
                    exe_dir.join("adg").to_str().unwrap(),
                    exe_dir.join("ext").to_str().unwrap()
                )
                .as_str(),
            )
            .initialization_script(
                r#"
                Object.defineProperty(window, 'EmbeddedBrowserWebView', {
                    value: undefined,
                    writable: false,
                    configurable: false
                });
                Object.defineProperty(window, 'chrome', {
                    value: undefined,
                    writable: false,
                    configurable: false
                });
                "#
            )
            .build()?;

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
