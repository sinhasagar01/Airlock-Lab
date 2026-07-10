use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

const MAX_INDEXED_FILES: usize = 5_000;
const MAX_PREVIEW_BYTES: u64 = 256 * 1024;
const MAX_DIFF_BYTES: usize = 512 * 1024;
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

#[derive(Serialize)]
struct GitDiffLine {
    r#type: String,
    content: String,
    old_line_number: Option<u32>,
    new_line_number: Option<u32>,
}

#[derive(Serialize)]
struct GitFileDiff {
    repository_id: String,
    repository_path: String,
    file_path: String,
    old_path: Option<String>,
    kind: String,
    is_binary: bool,
    is_too_large: bool,
    line_count: usize,
    additions: usize,
    deletions: usize,
    raw_diff: Option<String>,
    lines: Vec<GitDiffLine>,
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

fn git_output_raw(repository_path: &str, args: &[&str]) -> Option<Vec<u8>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository_path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(output.stdout)
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

fn empty_git_file_diff(
    repository_id: String,
    repository_path: String,
    file_path: String,
    old_path: Option<String>,
    kind: &str,
) -> GitFileDiff {
    GitFileDiff {
        repository_id,
        repository_path,
        file_path,
        old_path,
        kind: kind.to_string(),
        is_binary: false,
        is_too_large: false,
        line_count: 0,
        additions: 0,
        deletions: 0,
        raw_diff: None,
        lines: Vec::new(),
        refreshed_at: now_unix_seconds(),
    }
}

fn canonical_selected_git_root(repository_path: &str) -> Result<(PathBuf, String), String> {
    let repository_root = fs::canonicalize(repository_path).map_err(|_| "unavailable")?;
    let canonical_repository_path = repository_root.to_string_lossy().to_string();
    let is_git_repository = git_output(
        &canonical_repository_path,
        &["rev-parse", "--is-inside-work-tree"],
    )
    .is_some_and(|value| value == "true");

    if !is_git_repository {
        return Err("not_git_repository".to_string());
    }

    let git_top_level = git_output(
        &canonical_repository_path,
        &["rev-parse", "--show-toplevel"],
    )
    .and_then(|path| fs::canonicalize(path).ok());

    if git_top_level.as_ref() != Some(&repository_root) {
        return Err("repository_root_mismatch".to_string());
    }

    Ok((repository_root, canonical_repository_path))
}

fn is_safe_relative_git_path(file_path: &str) -> bool {
    is_safe_relative_path(file_path)
}

fn is_safe_relative_path(file_path: &str) -> bool {
    if file_path.trim().is_empty() || file_path.contains('\0') {
        return false;
    }

    let path = Path::new(file_path);

    if path.is_absolute() {
        return false;
    }

    path.components().all(|component| match component {
        Component::Normal(_) => true,
        Component::CurDir | Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
            false
        }
    })
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

fn diff_kind_for_stage(stage: &str, change_kind: &str) -> String {
    if change_kind == "untracked" || stage == "untracked" {
        return "untracked".to_string();
    }

    match stage {
        "staged" => "staged",
        "unstaged" => "unstaged",
        "both" => "combined",
        _ => "unavailable",
    }
    .to_string()
}

fn parse_git_diff(raw_diff: &str) -> (Vec<GitDiffLine>, usize, usize, bool) {
    let mut additions = 0;
    let mut deletions = 0;
    let is_binary = raw_diff.contains("Binary files ") || raw_diff.contains("GIT binary patch");
    let lines = raw_diff
        .lines()
        .map(|line| {
            let line_type = if line.starts_with("@@") {
                "hunk"
            } else if line.starts_with("diff --git")
                || line.starts_with("index ")
                || line.starts_with("new file mode")
                || line.starts_with("deleted file mode")
                || line.starts_with("rename from")
                || line.starts_with("rename to")
                || line.starts_with("---")
                || line.starts_with("+++")
            {
                "metadata"
            } else if line.starts_with('+') {
                additions += 1;
                "added"
            } else if line.starts_with('-') {
                deletions += 1;
                "removed"
            } else {
                "context"
            };

            GitDiffLine {
                r#type: line_type.to_string(),
                content: line.to_string(),
                old_line_number: None,
                new_line_number: None,
            }
        })
        .collect();

    (lines, additions, deletions, is_binary)
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

    if !is_safe_relative_path(&file_path) {
        return FileContentPreview {
            path: file_path,
            status: "outside_repository".to_string(),
            content: None,
            size_bytes: 0,
            max_size_bytes: MAX_PREVIEW_BYTES,
        };
    }

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

#[tauri::command]
fn load_git_file_diff(
    repository_id: String,
    repository_path: String,
    file_path: String,
    stage: String,
    kind: String,
    old_path: Option<String>,
) -> GitFileDiff {
    let (_, canonical_repository_path) = match canonical_selected_git_root(&repository_path) {
        Ok(root) => root,
        Err(_) => {
            return empty_git_file_diff(
                repository_id,
                repository_path,
                file_path,
                old_path,
                "unavailable",
            );
        }
    };

    if !is_safe_relative_git_path(&file_path)
        || old_path
            .as_deref()
            .is_some_and(|path| !is_safe_relative_git_path(path))
    {
        return empty_git_file_diff(
            repository_id,
            canonical_repository_path,
            file_path,
            old_path,
            "unavailable",
        );
    }

    let diff_kind = diff_kind_for_stage(&stage, &kind);

    if diff_kind == "untracked" {
        return empty_git_file_diff(
            repository_id,
            canonical_repository_path,
            file_path,
            old_path,
            "untracked",
        );
    }

    if diff_kind == "unavailable" {
        return empty_git_file_diff(
            repository_id,
            canonical_repository_path,
            file_path,
            old_path,
            "unavailable",
        );
    }

    let mut diff_bytes = Vec::new();
    let mut append_diff = |args: &[&str]| -> bool {
        let Some(output) = git_output_raw(&canonical_repository_path, args) else {
            return false;
        };

        if !diff_bytes.is_empty() && !output.is_empty() {
            diff_bytes.extend_from_slice(b"\n");
        }

        diff_bytes.extend_from_slice(&output);
        true
    };

    let loaded = match diff_kind.as_str() {
        "staged" => append_diff(&["diff", "--cached", "--", file_path.as_str()]),
        "unstaged" => append_diff(&["diff", "--", file_path.as_str()]),
        "combined" => {
            let staged_loaded = append_diff(&["diff", "--cached", "--", file_path.as_str()]);
            let unstaged_loaded = append_diff(&["diff", "--", file_path.as_str()]);
            staged_loaded || unstaged_loaded
        }
        _ => false,
    };

    if !loaded {
        return empty_git_file_diff(
            repository_id,
            canonical_repository_path,
            file_path,
            old_path,
            "unavailable",
        );
    }

    if diff_bytes.len() > MAX_DIFF_BYTES {
        return GitFileDiff {
            is_too_large: true,
            ..empty_git_file_diff(
                repository_id,
                canonical_repository_path,
                file_path,
                old_path,
                diff_kind.as_str(),
            )
        };
    }

    let raw_diff = String::from_utf8_lossy(&diff_bytes).to_string();

    if raw_diff.trim().is_empty() {
        return empty_git_file_diff(
            repository_id,
            canonical_repository_path,
            file_path,
            old_path,
            "unavailable",
        );
    }

    let (lines, additions, deletions, is_binary) = parse_git_diff(&raw_diff);
    let line_count = lines.len();

    GitFileDiff {
        repository_id,
        repository_path: canonical_repository_path,
        file_path,
        old_path,
        kind: if is_binary {
            "binary".to_string()
        } else {
            diff_kind
        },
        is_binary,
        is_too_large: false,
        line_count,
        additions,
        deletions,
        raw_diff: Some(raw_diff),
        lines,
        refreshed_at: now_unix_seconds(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
        sync::atomic::{AtomicU64, Ordering},
    };

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_temp_dir(name: &str) -> PathBuf {
        let suffix = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        std::env::temp_dir().join(format!(
            "ai-developer-workspace-{name}-{}-{suffix}",
            std::process::id()
        ))
    }

    fn create_temp_dir(name: &str) -> PathBuf {
        let path = unique_temp_dir(name);
        fs::create_dir_all(&path).expect("create temp test directory");
        path
    }

    fn remove_temp_dir(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    fn init_git_repo(path: &Path) {
        let output = Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .expect("run git init");

        assert!(
            output.status.success(),
            "git init failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn safe_relative_path_rejects_traversal_absolute_empty_and_null_paths() {
        assert!(is_safe_relative_path("src/App.tsx"));
        assert!(is_safe_relative_path("apps/desktop/src/App.tsx"));
        assert!(!is_safe_relative_path(""));
        assert!(!is_safe_relative_path("   "));
        assert!(!is_safe_relative_path("../outside.txt"));
        assert!(!is_safe_relative_path("src/../outside.txt"));
        assert!(!is_safe_relative_path("/tmp/outside.txt"));
        assert!(!is_safe_relative_path("src/App.tsx\0.png"));
    }

    #[test]
    fn preview_rejects_traversal_and_absolute_paths_before_reading() {
        let repository = create_temp_dir("preview-repository");
        let outside = create_temp_dir("preview-outside");
        fs::write(repository.join("safe.txt"), "hello").expect("write safe file");
        fs::write(outside.join("secret.txt"), "secret").expect("write outside file");

        let traversal_preview = preview_repository_file(
            repository.to_string_lossy().to_string(),
            "../preview-outside/secret.txt".to_string(),
        );
        let absolute_preview = preview_repository_file(
            repository.to_string_lossy().to_string(),
            outside.join("secret.txt").to_string_lossy().to_string(),
        );
        let safe_preview = preview_repository_file(
            repository.to_string_lossy().to_string(),
            "safe.txt".to_string(),
        );

        assert_eq!(traversal_preview.status, "outside_repository");
        assert_eq!(absolute_preview.status, "outside_repository");
        assert_eq!(safe_preview.status, "ready");
        assert_eq!(safe_preview.content.as_deref(), Some("hello"));

        remove_temp_dir(&repository);
        remove_temp_dir(&outside);
    }

    #[test]
    fn git_status_reports_non_git_repository_gracefully() {
        let repository = create_temp_dir("non-git-status");
        let summary = load_git_status_summary(
            "repo-test".to_string(),
            repository.to_string_lossy().to_string(),
        );

        assert!(!summary.is_git_repository);
        assert!(summary.is_clean);
        assert_eq!(summary.changed_file_count, 0);
        assert_eq!(summary.branch.as_deref(), Some("not a git repository"));

        remove_temp_dir(&repository);
    }

    #[test]
    fn git_diff_rejects_traversal_and_absolute_paths() {
        let repository = create_temp_dir("git-diff-safety");
        init_git_repo(&repository);

        let traversal_diff = load_git_file_diff(
            "repo-test".to_string(),
            repository.to_string_lossy().to_string(),
            "../outside.txt".to_string(),
            "unstaged".to_string(),
            "modified".to_string(),
            None,
        );
        let absolute_diff = load_git_file_diff(
            "repo-test".to_string(),
            repository.to_string_lossy().to_string(),
            repository.join("file.txt").to_string_lossy().to_string(),
            "unstaged".to_string(),
            "modified".to_string(),
            None,
        );
        let unsafe_old_path_diff = load_git_file_diff(
            "repo-test".to_string(),
            repository.to_string_lossy().to_string(),
            "new.txt".to_string(),
            "staged".to_string(),
            "renamed".to_string(),
            Some("../old.txt".to_string()),
        );

        assert_eq!(traversal_diff.kind, "unavailable");
        assert!(traversal_diff.raw_diff.is_none());
        assert_eq!(absolute_diff.kind, "unavailable");
        assert!(absolute_diff.raw_diff.is_none());
        assert_eq!(unsafe_old_path_diff.kind, "unavailable");
        assert!(unsafe_old_path_diff.raw_diff.is_none());

        remove_temp_dir(&repository);
    }

    #[test]
    fn parses_porcelain_status_kinds_and_stages() {
        let modified = parse_porcelain_line(" M apps/desktop/src/App.tsx").unwrap();
        let added = parse_porcelain_line("A  packages/core/src/index.ts").unwrap();
        let deleted = parse_porcelain_line(" D old-file.ts").unwrap();
        let renamed = parse_porcelain_line("R  old.ts -> new.ts").unwrap();
        let untracked = parse_porcelain_line("?? docs/new.md").unwrap();
        let staged_and_unstaged = parse_porcelain_line("MM package.json").unwrap();
        let conflicted = parse_porcelain_line("UU src/conflict.ts").unwrap();

        assert_eq!(modified.kind, "modified");
        assert_eq!(modified.stage, "unstaged");
        assert_eq!(added.kind, "added");
        assert_eq!(added.stage, "staged");
        assert_eq!(deleted.kind, "deleted");
        assert_eq!(deleted.stage, "unstaged");
        assert_eq!(renamed.kind, "renamed");
        assert_eq!(renamed.stage, "staged");
        assert_eq!(renamed.old_path.as_deref(), Some("old.ts"));
        assert_eq!(renamed.path, "new.ts");
        assert_eq!(untracked.kind, "untracked");
        assert_eq!(untracked.stage, "untracked");
        assert_eq!(staged_and_unstaged.kind, "modified");
        assert_eq!(staged_and_unstaged.stage, "both");
        assert_eq!(conflicted.kind, "conflicted");
        assert_eq!(conflicted.stage, "unknown");
        assert!(parse_porcelain_line(" M ").is_none());
    }

    #[test]
    fn parses_git_diff_line_types_and_counts() {
        let raw_diff = "\
diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,5 @@
 import { app } from './app';
-const name = 'old';
+const name = 'new';
+const enabled = true;
 context line";
        let (lines, additions, deletions, is_binary) = parse_git_diff(raw_diff);

        assert!(!is_binary);
        assert_eq!(additions, 2);
        assert_eq!(deletions, 1);
        assert_eq!(lines[0].r#type, "metadata");
        assert_eq!(lines[3].r#type, "metadata");
        assert_eq!(lines[4].r#type, "hunk");
        assert_eq!(lines[5].r#type, "context");
        assert_eq!(lines[6].r#type, "removed");
        assert_eq!(lines[7].r#type, "added");
        assert_eq!(lines[8].r#type, "added");
        assert_eq!(lines[9].r#type, "context");
    }

    #[test]
    fn parses_binary_git_diff_as_binary_without_counting_metadata_headers() {
        let raw_diff = "\
diff --git a/image.png b/image.png
index 1111111..2222222 100644
Binary files a/image.png and b/image.png differ";
        let (lines, additions, deletions, is_binary) = parse_git_diff(raw_diff);

        assert!(is_binary);
        assert_eq!(additions, 0);
        assert_eq!(deletions, 0);
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0].r#type, "metadata");
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
            load_git_file_diff,
            load_git_status_summary,
            load_repository_git_metadata,
            preview_repository_file,
            scan_repository_file_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Developer Workspace");
}
