#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

/// Runs a shell command, returning the combined stdout and stderr output.
#[tauri::command]
fn run_command(cmd: &str) -> Result<String, String> {
    // Choose shell based on the operating system
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd").args(&["/C", cmd]).output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh").arg("-c").arg(cmd).output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            let mut result = String::new();
            result.push_str(&stdout);
            if !o.stderr.is_empty() {
                result.push_str(&stderr);
            }
            Ok(result)
        }
        Err(e) => Err(format!("failed to execute command: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Register the `run_command` command for frontend invocation
        .invoke_handler(tauri::generate_handler![run_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
