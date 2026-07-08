use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::UNIX_EPOCH,
};

use serde::Serialize;

const MAX_INDEXED_FILES: usize = 5_000;
const MAX_PREVIEW_BYTES: u64 = 256 * 1024;
const IGNORED_DIRECTORIES: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
];

#[derive(Serialize)]
struct RepositoryGitMetadata {
    is_git_repository: bool,
    branch: String,
    open_changes: u32,
}

#[derive(Serialize)]
struct IndexedFileFact {
    repository_id: String,
    path: String,
    size_bytes: u64,
    extension: Option<String>,
    modified_at: Option<String>,
}

#[derive(Serialize)]
struct FileTreeScanResult {
    repository_path: String,
    scanned_files: usize,
    skipped_entries: usize,
    files: Vec<IndexedFileFact>,
}

#[derive(Serialize)]
struct FileContentPreview {
    path: String,
    status: String,
    content: Option<String>,
    size_bytes: u64,
    max_size_bytes: u64,
}

fn git_output(repository_path: &str, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository_path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn should_skip_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| IGNORED_DIRECTORIES.contains(&name))
}

fn modified_at_iso(metadata: &fs::Metadata) -> Option<String> {
    let modified = metadata.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_secs().to_string())
}

fn scan_directory(
    repository_id: &str,
    repository_root: &Path,
    current_path: PathBuf,
    files: &mut Vec<IndexedFileFact>,
    skipped_entries: &mut usize,
) {
    if files.len() >= MAX_INDEXED_FILES {
        return;
    }

    let entries = match fs::read_dir(&current_path) {
        Ok(entries) => entries,
        Err(_) => {
            *skipped_entries += 1;
            return;
        }
    };

    for entry in entries.flatten() {
        if files.len() >= MAX_INDEXED_FILES {
            break;
        }

        let path = entry.path();

        if should_skip_path(&path) {
            *skipped_entries += 1;
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => {
                *skipped_entries += 1;
                continue;
            }
        };

        if file_type.is_symlink() {
            *skipped_entries += 1;
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => {
                *skipped_entries += 1;
                continue;
            }
        };

        if metadata.is_dir() {
            scan_directory(repository_id, repository_root, path, files, skipped_entries);
            continue;
        }

        if !metadata.is_file() {
            *skipped_entries += 1;
            continue;
        }

        let relative_path = path
            .strip_prefix(repository_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_string());

        files.push(IndexedFileFact {
            repository_id: repository_id.to_string(),
            path: relative_path,
            size_bytes: metadata.len(),
            extension,
            modified_at: modified_at_iso(&metadata),
        });
    }
}

#[tauri::command]
fn load_repository_git_metadata(repository_path: String) -> RepositoryGitMetadata {
    let is_git_repository = git_output(&repository_path, &["rev-parse", "--is-inside-work-tree"])
        .is_some_and(|value| value == "true");

    if !is_git_repository {
        return RepositoryGitMetadata {
            is_git_repository,
            branch: "not a git repository".to_string(),
            open_changes: 0,
        };
    }

    let branch = git_output(&repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| {
            git_output(&repository_path, &["rev-parse", "--short", "HEAD"])
                .map(|commit| format!("detached {commit}"))
        })
        .unwrap_or_else(|| "unknown".to_string());

    let open_changes = git_output(&repository_path, &["status", "--porcelain"])
        .map(|status| status.lines().count() as u32)
        .unwrap_or(0);

    RepositoryGitMetadata {
        is_git_repository,
        branch,
        open_changes,
    }
}

#[tauri::command]
fn scan_repository_file_tree(repository_id: String, repository_path: String) -> FileTreeScanResult {
    let repository_root = PathBuf::from(&repository_path);
    let mut files = Vec::new();
    let mut skipped_entries = 0;

    scan_directory(
        &repository_id,
        &repository_root,
        repository_root.clone(),
        &mut files,
        &mut skipped_entries,
    );

    FileTreeScanResult {
        repository_path,
        scanned_files: files.len(),
        skipped_entries,
        files,
    }
}

#[tauri::command]
fn preview_repository_file(repository_path: String, file_path: String) -> FileContentPreview {
    let repository_root = match fs::canonicalize(&repository_path) {
        Ok(path) => path,
        Err(_) => {
            return FileContentPreview {
                path: file_path,
                status: "unavailable".to_string(),
                content: None,
                size_bytes: 0,
                max_size_bytes: MAX_PREVIEW_BYTES,
            };
        }
    };
    let requested_path = repository_root.join(&file_path);
    let canonical_file_path = match fs::canonicalize(&requested_path) {
        Ok(path) => path,
        Err(_) => {
            return FileContentPreview {
                path: file_path,
                status: "unavailable".to_string(),
                content: None,
                size_bytes: 0,
                max_size_bytes: MAX_PREVIEW_BYTES,
            };
        }
    };

    if !canonical_file_path.starts_with(&repository_root) {
        return FileContentPreview {
            path: file_path,
            status: "outside_repository".to_string(),
            content: None,
            size_bytes: 0,
            max_size_bytes: MAX_PREVIEW_BYTES,
        };
    }

    let metadata = match fs::metadata(&canonical_file_path) {
        Ok(metadata) => metadata,
        Err(_) => {
            return FileContentPreview {
                path: file_path,
                status: "unavailable".to_string(),
                content: None,
                size_bytes: 0,
                max_size_bytes: MAX_PREVIEW_BYTES,
            };
        }
    };

    if !metadata.is_file() {
        return FileContentPreview {
            path: file_path,
            status: "unavailable".to_string(),
            content: None,
            size_bytes: metadata.len(),
            max_size_bytes: MAX_PREVIEW_BYTES,
        };
    }

    if metadata.len() > MAX_PREVIEW_BYTES {
        return FileContentPreview {
            path: file_path,
            status: "too_large".to_string(),
            content: None,
            size_bytes: metadata.len(),
            max_size_bytes: MAX_PREVIEW_BYTES,
        };
    }

    let bytes = match fs::read(&canonical_file_path) {
        Ok(bytes) => bytes,
        Err(_) => {
            return FileContentPreview {
                path: file_path,
                status: "unavailable".to_string(),
                content: None,
                size_bytes: metadata.len(),
                max_size_bytes: MAX_PREVIEW_BYTES,
            };
        }
    };

    if bytes.contains(&0) {
        return FileContentPreview {
            path: file_path,
            status: "binary".to_string(),
            content: None,
            size_bytes: metadata.len(),
            max_size_bytes: MAX_PREVIEW_BYTES,
        };
    }

    match String::from_utf8(bytes) {
        Ok(content) => FileContentPreview {
            path: file_path,
            status: "ready".to_string(),
            content: Some(content),
            size_bytes: metadata.len(),
            max_size_bytes: MAX_PREVIEW_BYTES,
        },
        Err(_) => FileContentPreview {
            path: file_path,
            status: "binary".to_string(),
            content: None,
            size_bytes: metadata.len(),
            max_size_bytes: MAX_PREVIEW_BYTES,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_repository_git_metadata,
            preview_repository_file,
            scan_repository_file_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Developer Workspace");
}
