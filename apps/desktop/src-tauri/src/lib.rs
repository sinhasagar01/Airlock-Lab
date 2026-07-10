use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
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

#[derive(Serialize)]
struct GitChangedFile {
    path: String,
    old_path: Option<String>,
    kind: String,
    stage: String,
    status_code: String,
}

#[derive(Serialize)]
struct GitStatusSummary {
    repository_id: String,
    repository_path: String,
    branch: Option<String>,
    is_git_repository: bool,
    is_clean: bool,
    changed_file_count: usize,
    staged_count: usize,
    unstaged_count: usize,
    untracked_count: usize,
    conflicted_count: usize,
    files: Vec<GitChangedFile>,
    refreshed_at: String,
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

fn now_unix_seconds() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn empty_git_status_summary(
    repository_id: String,
    repository_path: String,
    is_git_repository: bool,
    branch: Option<String>,
) -> GitStatusSummary {
    GitStatusSummary {
        repository_id,
        repository_path,
        branch,
        is_git_repository,
        is_clean: true,
        changed_file_count: 0,
        staged_count: 0,
        unstaged_count: 0,
        untracked_count: 0,
        conflicted_count: 0,
        files: Vec::new(),
        refreshed_at: now_unix_seconds(),
    }
}

fn git_change_kind(index_status: char, worktree_status: char) -> String {
    if is_conflicted_status(index_status, worktree_status) {
        return "conflicted".to_string();
    }

    let status = if index_status != ' ' && index_status != '?' {
        index_status
    } else {
        worktree_status
    };

    match status {
        'A' => "added",
        'M' => "modified",
        'D' => "deleted",
        'R' => "renamed",
        'C' => "copied",
        '?' => "untracked",
        'U' => "conflicted",
        _ => "unknown",
    }
    .to_string()
}

fn git_change_stage(index_status: char, worktree_status: char) -> String {
    if index_status == '?' && worktree_status == '?' {
        return "untracked".to_string();
    }

    if is_conflicted_status(index_status, worktree_status) {
        return "unknown".to_string();
    }

    let is_staged = index_status != ' ';
    let is_unstaged = worktree_status != ' ';

    match (is_staged, is_unstaged) {
        (true, true) => "both",
        (true, false) => "staged",
        (false, true) => "unstaged",
        _ => "unknown",
    }
    .to_string()
}

fn is_conflicted_status(index_status: char, worktree_status: char) -> bool {
    matches!(
        (index_status, worktree_status),
        ('D', 'D') | ('A', 'U') | ('U', 'D') | ('U', 'A') | ('D', 'U') | ('A', 'A') | ('U', 'U')
    )
}

fn parse_porcelain_line(line: &str) -> Option<GitChangedFile> {
    if line.len() < 4 {
        return None;
    }

    let mut chars = line.chars();
    let index_status = chars.next()?;
    let worktree_status = chars.next()?;
    let status_code = format!("{index_status}{worktree_status}");
    let raw_path = line.get(3..)?.trim();

    if raw_path.is_empty() {
        return None;
    }

    let (old_path, path) = if index_status == 'R' || index_status == 'C' {
        raw_path
            .split_once(" -> ")
            .map(|(old_path, new_path)| (Some(old_path.to_string()), new_path.to_string()))
            .unwrap_or((None, raw_path.to_string()))
    } else {
        (None, raw_path.to_string())
    };

    Some(GitChangedFile {
        path,
        old_path,
        kind: git_change_kind(index_status, worktree_status),
        stage: git_change_stage(index_status, worktree_status),
        status_code,
    })
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

#[tauri::command]
fn load_git_status_summary(repository_id: String, repository_path: String) -> GitStatusSummary {
    let repository_root = match fs::canonicalize(&repository_path) {
        Ok(path) => path,
        Err(_) => {
            return empty_git_status_summary(repository_id, repository_path, false, None);
        }
    };
    let canonical_repository_path = repository_root.to_string_lossy().to_string();
    let is_git_repository = git_output(
        &canonical_repository_path,
        &["rev-parse", "--is-inside-work-tree"],
    )
    .is_some_and(|value| value == "true");

    if !is_git_repository {
        return empty_git_status_summary(
            repository_id,
            canonical_repository_path,
            false,
            Some("not a git repository".to_string()),
        );
    }

    let git_top_level = git_output(
        &canonical_repository_path,
        &["rev-parse", "--show-toplevel"],
    )
    .and_then(|path| fs::canonicalize(path).ok());

    if git_top_level.as_ref() != Some(&repository_root) {
        return empty_git_status_summary(
            repository_id,
            canonical_repository_path,
            false,
            Some("repository root mismatch".to_string()),
        );
    }

    let branch = git_output(&canonical_repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| {
            git_output(
                &canonical_repository_path,
                &["rev-parse", "--short", "HEAD"],
            )
            .map(|commit| format!("detached {commit}"))
        });
    let status_output =
        git_output(&canonical_repository_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let files: Vec<GitChangedFile> = status_output
        .lines()
        .filter_map(parse_porcelain_line)
        .collect();
    let staged_count = files
        .iter()
        .filter(|file| file.stage == "staged" || file.stage == "both")
        .count();
    let unstaged_count = files
        .iter()
        .filter(|file| file.stage == "unstaged" || file.stage == "both")
        .count();
    let untracked_count = files
        .iter()
        .filter(|file| file.stage == "untracked")
        .count();
    let conflicted_count = files
        .iter()
        .filter(|file| file.kind == "conflicted")
        .count();

    GitStatusSummary {
        repository_id,
        repository_path: canonical_repository_path,
        branch,
        is_git_repository,
        is_clean: files.is_empty(),
        changed_file_count: files.len(),
        staged_count,
        unstaged_count,
        untracked_count,
        conflicted_count,
        files,
        refreshed_at: now_unix_seconds(),
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
            load_git_status_summary,
            load_repository_git_metadata,
            preview_repository_file,
            scan_repository_file_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Developer Workspace");
}
