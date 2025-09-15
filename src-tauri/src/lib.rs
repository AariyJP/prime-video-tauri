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
    
    let user_profile = env::var("USERPROFILE").unwrap_or_default();
    let local_app_data = env::var("LOCALAPPDATA").unwrap_or_default();
    
    env::set_var(
        "WEBVIEW2_USER_DATA_FOLDER",
        PathBuf::from(&local_app_data).join("net.aariy.wb2")
    );
    
    let fonter_path = PathBuf::from(&user_profile)
        .join("git")
        .join("fonter");
    let adg_path = PathBuf::from(&user_profile)
        .join("git")
        .join("adg");

    let mut context: tauri::Context<tauri::Wry> = tauri::generate_context!();

    if let Some(window) = context.config_mut().app.windows.get_mut(0) {
        window.additional_browser_args = Some(format!(
            "--load-extension={},{} --disable-gpu",
            fonter_path.to_string_lossy(),
            adg_path.to_string_lossy()
        ));
    }
    
    let discord_state = DiscordState {
        client: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(discord_state)
        .setup(|app| {
            let handle = app.handle();
            let discord_state: tauri::State<DiscordState> = handle.state();
            let mut client_lock = discord_state.client.lock().unwrap();

            // IMPORTANT: Replace "123456789012345678" with your actual Discord App Client ID
            let mut client = DiscordIpcClient::new("739528267039768647");

            if client.connect().is_ok() {
                if client.set_activity(make_activity()).is_err() {
                    println!("Failed to set Discord activity.");
                }
                *client_lock = Some(client);
            } else {
                println!("Failed to connect to Discord.");
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .run(context)
        .expect("error while running tauri application");
}
