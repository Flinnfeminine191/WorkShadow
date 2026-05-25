//! Application diagnostic logs (separate from user journal "logs" directory).
//! Rotation: daily base file; when a file exceeds max size, append numeric suffix;
//! retention by age and total file count.

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

const BEIJING_TIME_ZONE: &str = "Asia/Shanghai";

static LOG_STATE: Mutex<Option<LogState>> = Mutex::new(None);
static APP_TIMEZONE: Mutex<String> = Mutex::new(String::new());

const LOG_DIR_NAME: &str = "app-logs";
const FILE_PREFIX: &str = "workshadow-";
const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
const RETENTION_DAYS: i64 = 30;
const MAX_LOG_FILES: usize = 80;

struct LogState {
    dir: PathBuf,
    active_path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogPolicy {
    pub max_file_bytes: u64,
    pub retention_days: i64,
    pub max_log_files: usize,
    pub rotation: String,
}

fn log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "application data directory is unavailable".to_string())?
        .join(LOG_DIR_NAME);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn effective_timezone_name() -> String {
    APP_TIMEZONE
        .lock()
        .ok()
        .and_then(|g| {
            let s = g.clone();
            if s.is_empty() { None } else { Some(s) }
        })
        .or_else(|| iana_time_zone::get_timezone().ok())
        .unwrap_or_else(|| BEIJING_TIME_ZONE.to_string())
}

fn parse_tz(name: &str) -> Tz {
    name.parse().unwrap_or(chrono_tz::Asia::Shanghai)
}

fn now_in_app_tz() -> DateTime<Tz> {
    Utc::now().with_timezone(&parse_tz(&effective_timezone_name()))
}

fn today_stamp() -> String {
    now_in_app_tz().format("%Y-%m-%d").to_string()
}

fn local_timestamp_millis() -> String {
    now_in_app_tz().to_rfc3339_opts(chrono::SecondsFormat::Millis, false)
}

fn normalize_timezone_name(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("empty timezone".into());
    }
    trimmed
        .parse::<Tz>()
        .map(|_| trimmed.to_string())
        .map_err(|_| format!("invalid timezone: {trimmed}"))
}

fn base_name_for_day(day: &str) -> String {
    format!("{FILE_PREFIX}{day}.log")
}

fn suffix_name_for_day(day: &str, index: u32) -> String {
    format!("{FILE_PREFIX}{day}.{index:03}.log")
}

fn parse_day_from_name(name: &str) -> Option<String> {
    let rest = name.strip_prefix(FILE_PREFIX)?;
    let day = rest.split('.').next()?;
    if day.len() == 10 && day.as_bytes().get(4) == Some(&b'-') {
        Some(day.to_string())
    } else {
        None
    }
}

fn is_app_log_file(name: &str) -> bool {
    name.starts_with(FILE_PREFIX) && name.ends_with(".log")
}

fn file_modified_iso(path: &Path) -> String {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.with_timezone(&parse_tz(&effective_timezone_name()))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, false)
        })
        .unwrap_or_else(local_timestamp_millis)
}

fn list_log_files_sorted(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files: Vec<PathBuf> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.file_name().and_then(|n| n.to_str()).map(is_app_log_file).unwrap_or(false))
        .collect();
    files.sort_by(|a, b| {
        let ma = fs::metadata(a).and_then(|m| m.modified()).ok();
        let mb = fs::metadata(b).and_then(|m| m.modified()).ok();
        mb.cmp(&ma)
    });
    Ok(files)
}

fn next_suffix_path(dir: &Path, day: &str) -> PathBuf {
    let mut index = 1u32;
    loop {
        let candidate = dir.join(suffix_name_for_day(day, index));
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

fn resolve_write_path(dir: &Path) -> PathBuf {
    let day = today_stamp();
    let base = dir.join(base_name_for_day(&day));
    if !base.exists() {
        return base;
    }
    if fs::metadata(&base).map(|m| m.len()).unwrap_or(0) < MAX_FILE_BYTES {
        return base;
    }
    let suffixed = list_log_files_sorted(dir)
        .ok()
        .unwrap_or_default()
        .into_iter()
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(&format!("{FILE_PREFIX}{day}.")) && n.ends_with(".log"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    if let Some(last) = suffixed.first() {
        if fs::metadata(last).map(|m| m.len()).unwrap_or(0) < MAX_FILE_BYTES {
            return last.clone();
        }
    }
    next_suffix_path(dir, &day)
}

fn cleanup_old_logs(dir: &Path) {
    let Ok(files) = list_log_files_sorted(dir) else {
        return;
    };
    let cutoff_date = now_in_app_tz().date_naive() - chrono::Duration::days(RETENTION_DAYS);
    let mut kept: Vec<PathBuf> = Vec::new();
    for path in files {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let remove_by_age = parse_day_from_name(name)
            .and_then(|d| chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok())
            .map(|date| date < cutoff_date)
            .unwrap_or(false);
        if remove_by_age {
            let _ = fs::remove_file(&path);
        } else {
            kept.push(path);
        }
    }
    if kept.len() > MAX_LOG_FILES {
        for path in kept.into_iter().skip(MAX_LOG_FILES) {
            let _ = fs::remove_file(path);
        }
    }
}

fn ensure_state(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = log_dir(app)?;
    let mut guard = LOG_STATE.lock().map_err(|_| "log mutex poisoned".to_string())?;
    if guard.is_none() {
        let active_path = resolve_write_path(&dir);
        *guard = Some(LogState { dir, active_path });
    }
    Ok(())
}

fn rotate_if_needed(state: &mut LogState) -> Result<(), String> {
    let day = today_stamp();
    let expected_base = state.dir.join(base_name_for_day(&day));
    let active_name = state
        .active_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let active_day = parse_day_from_name(active_name);
    let wrong_day = active_day.as_deref() != Some(day.as_str());
    let too_large = fs::metadata(&state.active_path)
        .map(|m| m.len() >= MAX_FILE_BYTES)
        .unwrap_or(false);
    if wrong_day || too_large || !state.active_path.exists() {
        state.active_path = resolve_write_path(&state.dir);
    }
    if too_large && state.active_path == expected_base && expected_base.exists() {
        state.active_path = next_suffix_path(&state.dir, &day);
    }
    Ok(())
}

pub fn init(app: &tauri::AppHandle) {
    if let Ok(dir) = log_dir(app) {
        let active_path = resolve_write_path(&dir);
        if let Ok(mut guard) = LOG_STATE.lock() {
            *guard = Some(LogState { dir, active_path: active_path.clone() });
        }
        let _ = write_line(app, "INFO", "backend", "WorkShadow started", None);
    }
}

pub fn write_line(
    app: &tauri::AppHandle,
    level: &str,
    target: &str,
    message: &str,
    fields: Option<serde_json::Value>,
) -> Result<(), String> {
    ensure_state(app)?;
    let mut guard = LOG_STATE.lock().map_err(|_| "log mutex poisoned".to_string())?;
    let state = guard.as_mut().ok_or("log not initialized")?;
    rotate_if_needed(state)?;
    let ts = local_timestamp_millis();
    let level = level.to_uppercase();
    let fields_part = fields
        .filter(|v| !v.is_null())
        .map(|v| format!(" {}", v))
        .unwrap_or_default();
    let line = format!("{ts} {level:5} {target} {message}{fields_part}\n");
    if let Some(parent) = state.active_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&state.active_path)
        .map_err(|e| e.to_string())?;
    file.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    drop(file);
    cleanup_old_logs(&state.dir);
    Ok(())
}

#[tauri::command]
pub fn app_timezone_init(time_zone: String) -> Result<(), String> {
    let name = normalize_timezone_name(&time_zone)?;
    let mut guard = APP_TIMEZONE
        .lock()
        .map_err(|_| "timezone mutex poisoned".to_string())?;
    *guard = name;
    Ok(())
}

#[tauri::command]
pub fn app_log_write(
    app: tauri::AppHandle,
    level: String,
    target: String,
    message: String,
    fields: Option<serde_json::Value>,
) -> Result<(), String> {
    write_line(&app, &level, &target, &message, fields)
}

#[tauri::command]
pub fn app_log_list_files(app: tauri::AppHandle) -> Result<Vec<AppLogFileInfo>, String> {
    let dir = log_dir(&app)?;
    let files = list_log_files_sorted(&dir)?;
    let mut out = Vec::new();
    for path in files {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        out.push(AppLogFileInfo {
            name,
            path: path.to_string_lossy().into_owned(),
            size_bytes,
            modified_at: file_modified_iso(&path),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn app_log_read_file(
    app: tauri::AppHandle,
    file_name: String,
    max_lines: Option<u32>,
) -> Result<String, String> {
    let dir = log_dir(&app)?;
    let name = Path::new(file_name.trim())
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file_name.trim());
    if !is_app_log_file(name) {
        return Err("invalid log file name".into());
    }
    let path = dir.join(name);
    if !path.starts_with(&dir) {
        return Err("path escape".into());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let limit = max_lines.unwrap_or(2000).min(10_000) as usize;
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= limit {
        return Ok(content);
    }
    Ok(lines[lines.len() - limit..].join("\n"))
}

#[tauri::command]
pub fn app_log_get_directory(app: tauri::AppHandle) -> Result<String, String> {
    Ok(log_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn app_log_get_policy() -> AppLogPolicy {
    AppLogPolicy {
        max_file_bytes: MAX_FILE_BYTES,
        retention_days: RETENTION_DAYS,
        max_log_files: MAX_LOG_FILES,
        rotation: "daily + size (5MB per file)".into(),
    }
}

#[tauri::command]
pub fn app_log_open_directory(app: tauri::AppHandle) -> Result<(), String> {
    let dir = log_dir(&app)?;
    open_path_in_shell(&dir)
}

pub fn open_path_in_shell(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[allow(dead_code)]
pub fn log_backend_error(app: &tauri::AppHandle, command: &str, error: &str) {
    let fields = serde_json::json!({ "command": command });
    let _ = write_line(app, "ERROR", "backend", error, Some(fields));
}
