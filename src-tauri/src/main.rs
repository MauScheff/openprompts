#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::process::Command;

/// Runs a shell command, returning the combined stdout and stderr output.
#[tauri::command]
fn run_command(stdin: &str, cmd: &str) -> Result<String, String> {
    // DEBUG
    println!("Running command: {}", cmd);

    // Choose shell based on the operating system
    #[cfg(target_os = "windows")]
    let mut child = Command::new("cmd")
        .args(&["/C", cmd])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

    #[cfg(not(target_os = "windows"))]
    let child = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

    match child {
        Ok(mut c) => {
            if let Some(stdin_pipe) = c.stdin.as_mut() {
                if let Err(e) = stdin_pipe.write_all(stdin.as_bytes()) {
                    return Err(format!("failed to write to stdin: {}", e));
                }
            }
            match c.wait_with_output() {
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
                Err(e) => Err(format!("failed to get output: {}", e)),
            }
        }
        Err(e) => Err(format!("failed to execute command: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
