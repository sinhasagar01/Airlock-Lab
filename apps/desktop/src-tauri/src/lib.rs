use std::{
    collections::BTreeSet,
    env, fs,
    fs::OpenOptions,
    io::{Seek, SeekFrom, Write},
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};
use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::sync::Mutex;

const MAX_INDEXED_FILES: usize = 5_000;
const MAX_PREVIEW_BYTES: u64 = 256 * 1024;
const MAX_DIFF_BYTES: usize = 512 * 1024;
const MAX_PROVIDER_TASK_BYTES: usize = 1_200;
const MAX_PROVIDER_KEY_FILES: usize = 20;
const MAX_PROVIDER_FOLDERS: usize = 20;
const MAX_PROVIDER_EXTENSIONS: usize = 12;
const MAX_GENERATED_PATCH_BYTES: usize = 64 * 1024;
const MAX_GENERATED_PATCH_LINES: usize = 4_000;
const MAX_FINGERPRINT_BYTES: u64 = 256 * 1024;
const MAX_FINGERPRINT_TARGETS: usize = 64;
const WORKSPACE_DATABASE_URL: &str = "sqlite:workspace.db";
const APPLY_CONFIRMATION_PHRASE: &str = "APPLY PATCH";
const ACKNOWLEDGE_CONFIRMATION_PHRASE: &str = "INSPECTED";
const ROLLBACK_CONFIRMATION_PHRASE: &str = "ROLL BACK";
const GIT_APPLY_TIMEOUT: Duration = Duration::from_secs(15);
const GIT_CHILD_POLL_INTERVAL: Duration = Duration::from_millis(10);
const APPLY_LOCK_STALE_AFTER_SECONDS: u64 = 5 * 60;
const DEFAULT_OPENAI_MODEL: &str = "gpt-5.6-luna";
const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models";
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

static PATCH_APPLY_LOCK: Mutex<()> = Mutex::const_new(());

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FixedGitApplyOutcome {
    Succeeded,
    Rejected,
    TimedOut,
    Unavailable,
    Interrupted,
}

#[derive(Debug)]
struct RepositoryApplyLock {
    file: fs::File,
    lock_id: Option<String>,
}

impl Drop for RepositoryApplyLock {
    fn drop(&mut self) {
        let _ = fs::File::unlock(&self.file);
    }
}

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

#[derive(Clone, Debug, Serialize)]
struct GitChangedFile {
    path: String,
    old_path: Option<String>,
    kind: String,
    stage: String,
    status_code: String,
}

#[derive(Clone, Debug, Serialize)]
struct GitStatusSummary {
    repository_id: String,
    repository_path: String,
    branch: Option<String>,
    head_sha: Option<String>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PatchValidationInput {
    repository_id: String,
    repository_path: String,
    file_path: String,
    operation: String,
    is_binary: bool,
    raw_diff: Option<String>,
    artifact_digest: Option<String>,
    #[serde(default)]
    relevant_file_paths: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositorySnapshotInput {
    repository_id: String,
    repository_path: String,
    artifact_digest: String,
    relevant_file_paths: Vec<String>,
}

#[derive(Clone, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct TargetFileFingerprint {
    path: String,
    exists: bool,
    size_bytes: Option<u64>,
    modified_at: Option<String>,
    content_sha256: Option<String>,
    status: String,
    reason: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryValidationSnapshot {
    repository_id: String,
    branch: Option<String>,
    head_sha: Option<String>,
    is_clean: bool,
    changed_file_count: usize,
    relevant_file_paths: Vec<String>,
    artifact_digest: Option<String>,
    target_file_fingerprints: Vec<TargetFileFingerprint>,
    repository_snapshot_digest: Option<String>,
    captured_at: String,
    fingerprinted_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PatchValidationResult {
    repository_id: String,
    file_path: String,
    status: String,
    message: String,
    artifact_digest: Option<String>,
    repository_snapshot: Option<RepositoryValidationSnapshot>,
    validated_at: String,
    dry_run_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyApprovedPatchArtifactInput {
    repository_id: String,
    proposed_change_id: String,
    approval_request_id: String,
    patch_artifact_id: String,
    confirmation_phrase: String,
}

/// Rollback carries durable IDs and the typed phrase only.
///
/// No path, no bytes, no Git arguments: native reloads every durable record and
/// re-derives every check. There is deliberately no `approvalRequestId` — the
/// approval authorized the apply, not the undo, and the linked ID is read from
/// the persisted proposal rather than accepted from the caller.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RollbackAppliedPatchArtifactInput {
    repository_id: String,
    proposed_change_id: String,
    patch_artifact_id: String,
    confirmation_phrase: String,
}

/// The bytes rollback is about to destroy, captured once.
///
/// One read serves both the drift check and the pre-rollback backup. Reading
/// twice would widen the TOCTOU window recorded under roadmap #12 and could
/// hash different bytes than it stores.
#[derive(Debug)]
struct RollbackTargetCapture {
    content: String,
    content_sha256: String,
}

/// Post-restore evidence.
///
/// Deliberately not `PostApplyPathVerification`. Rollback's expectation is a
/// delta against the pre-restore tree rather than a single approved path, and it
/// carries staged-path evidence that apply has no analogue for. Conflating the
/// two would render a staged-set mismatch as "no unexpected paths, quarantined
/// anyway" — an unexplained refusal.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PostRollbackVerification {
    status: String,
    target_path: String,
    expected_changed_paths: Vec<String>,
    observed_changed_paths: Vec<String>,
    unexpected_paths: Vec<String>,
    missing_expected_paths: Vec<String>,
    expected_staged_paths: Vec<String>,
    observed_staged_paths: Vec<String>,
    verified_at: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RollbackAppliedPatchArtifactResult {
    status: String,
    rollback_attempt_id: String,
    proposed_change_id: String,
    patch_artifact_id: String,
    rollback_backup_id: String,
    rolled_back_at: String,
    post_rollback_git_status: GitStatusSummary,
    post_rollback_verification: PostRollbackVerification,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcknowledgeApplyAttemptInput {
    apply_attempt_id: String,
    confirmation_phrase: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AcknowledgeApplyAttemptResult {
    apply_attempt_id: String,
    status: String,
    acknowledged_from_status: String,
    acknowledged_at: String,
    message: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPatchBackupFile {
    path: String,
    existed_before_apply: bool,
    content_sha256: Option<String>,
    content: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PatchApplyEvidence {
    artifact_digest: String,
    repository_snapshot: Option<RepositoryValidationSnapshot>,
    git_status: Option<Value>,
    captured_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PostApplyPathVerification {
    status: String,
    expected_paths: Vec<String>,
    observed_changed_paths: Vec<String>,
    unexpected_paths: Vec<String>,
    missing_expected_paths: Vec<String>,
    verified_at: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PatchApplyAttemptRecord {
    apply_attempt_id: String,
    repository_id: String,
    proposed_change_id: String,
    approval_request_id: String,
    patch_artifact_id: String,
    backup_id: Option<String>,
    rollback_backup_id: Option<String>,
    status: String,
    started_at: String,
    completed_at: Option<String>,
    sanitized_error: Option<String>,
    pre_apply_evidence: Option<PatchApplyEvidence>,
    post_apply_evidence: Option<PatchApplyEvidence>,
    post_apply_verification: Option<PostApplyPathVerification>,
    post_rollback_verification: Option<PostRollbackVerification>,
    current_git_status_changed: Option<bool>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyApprovedPatchArtifactResult {
    status: String,
    apply_attempt_id: String,
    proposed_change_id: String,
    patch_artifact_id: String,
    backup_id: String,
    applied_at: String,
    post_apply_git_status: GitStatusSummary,
    post_apply_verification: PostApplyPathVerification,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPatchError {
    code: String,
    message: String,
}

#[derive(Serialize)]
struct OpenAiProviderConfiguration {
    configured: bool,
    model: String,
    reason: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAiConnectionDiagnostic {
    status: String,
    configured: bool,
    model: String,
    checked_at: String,
    latency_ms: Option<u64>,
    message: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAiPlanExtensionSummary {
    extension: String,
    count: usize,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAiPlanGitContext {
    is_git_repository: bool,
    is_clean: bool,
    changed_file_count: usize,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAiPlanContext {
    branch: String,
    indexed_file_count: usize,
    key_files: Vec<String>,
    project_folders: Vec<String>,
    top_extensions: Vec<OpenAiPlanExtensionSummary>,
    git: OpenAiPlanGitContext,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenAiPlanInput {
    run_id: String,
    repository_id: String,
    repository_name: Option<String>,
    task_title: String,
    task_prompt: String,
    context: OpenAiPlanContext,
}

/// Runs a fixed command with a deadline and returns its stdout on success.
///
/// Only the mutating apply command used to be bounded, so any `git status` or
/// `git diff` read could hang indefinitely. Rollback has to read git status to
/// verify what it restored, which makes an unbounded read a liveness hole in a
/// destructive path.
///
/// stdout is drained on a separate thread rather than after the wait: git status
/// output routinely exceeds a pipe buffer, and waiting first would deadlock with
/// the child blocked on a full pipe. stderr is discarded, as everywhere else, so
/// raw git text cannot reach a caller.
fn run_bounded_capture(
    program: &str,
    working_directory: &str,
    args: &[&str],
    timeout: Duration,
) -> Option<Vec<u8>> {
    let mut child = Command::new(program)
        .args(args)
        .current_dir(working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdout = child.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        std::io::Read::read_to_end(&mut stdout, &mut buffer).map(|_| buffer)
    });
    let outcome = wait_for_child_with_timeout(&mut child, timeout);
    let captured = reader.join().ok()?.ok()?;

    match outcome {
        FixedGitApplyOutcome::Succeeded => Some(captured),
        _ => None,
    }
}

fn git_output(repository_path: &str, args: &[&str]) -> Option<String> {
    let stdout = run_bounded_capture("git", repository_path, args, GIT_APPLY_TIMEOUT)?;

    // Only trailing whitespace is safe to strip. Porcelain v1 encodes an
    // unstaged change as a leading space in `XY PATH`, and trimming the start
    // shifts every path slice on the first status line by one byte.
    Some(String::from_utf8_lossy(&stdout).trim_end().to_string())
}

fn git_output_raw(repository_path: &str, args: &[&str]) -> Option<Vec<u8>> {
    run_bounded_capture("git", repository_path, args, GIT_APPLY_TIMEOUT)
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
    unix_seconds().to_string()
}

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
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
        head_sha: None,
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
    // Control characters (including NUL) are rejected: git always quotes them,
    // they cannot round-trip safely through the UI or audit records, and a path
    // that needs them is pathological. Rejection reaches quarantine through the
    // same mechanism as every other rejected line -- the raw status line count
    // makes the drop visible.
    if file_path.trim().is_empty() || file_path.chars().any(char::is_control) {
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

fn is_valid_sha256(digest: &str) -> bool {
    digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn is_forbidden_fingerprint_path(file_path: &str) -> bool {
    let normalized = file_path.to_ascii_lowercase();
    let path = Path::new(&normalized);

    path.components()
        .any(|component| matches!(component, Component::Normal(segment) if segment == ".git"))
        || is_sensitive_provider_path(file_path)
}

fn metadata_modified_at(metadata: &fs::Metadata) -> Option<String> {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs().to_string())
}

fn fingerprint_target_file(repository_root: &Path, file_path: &str) -> TargetFileFingerprint {
    if is_forbidden_fingerprint_path(file_path) {
        return TargetFileFingerprint {
            path: file_path.to_string(),
            exists: false,
            size_bytes: None,
            modified_at: None,
            content_sha256: None,
            status: "forbidden".to_string(),
            reason: Some("Policy forbids reading or fingerprinting this path.".to_string()),
        };
    }

    let target_path = repository_root.join(file_path);
    let metadata = match fs::symlink_metadata(&target_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return TargetFileFingerprint {
                path: file_path.to_string(),
                exists: false,
                size_bytes: None,
                modified_at: None,
                content_sha256: None,
                status: "missing".to_string(),
                reason: None,
            };
        }
        Err(_) => {
            return TargetFileFingerprint {
                path: file_path.to_string(),
                exists: false,
                size_bytes: None,
                modified_at: None,
                content_sha256: None,
                status: "unavailable".to_string(),
                reason: Some("File metadata is unavailable.".to_string()),
            };
        }
    };

    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return TargetFileFingerprint {
            path: file_path.to_string(),
            exists: true,
            size_bytes: Some(metadata.len()),
            modified_at: metadata_modified_at(&metadata),
            content_sha256: None,
            status: "unavailable".to_string(),
            reason: Some("Only regular repository files can be fingerprinted.".to_string()),
        };
    }

    if metadata.len() > MAX_FINGERPRINT_BYTES {
        return TargetFileFingerprint {
            path: file_path.to_string(),
            exists: true,
            size_bytes: Some(metadata.len()),
            modified_at: metadata_modified_at(&metadata),
            content_sha256: None,
            status: "too_large".to_string(),
            reason: Some("File exceeds the 256 KiB fingerprint limit.".to_string()),
        };
    }

    let canonical_target = match fs::canonicalize(&target_path) {
        Ok(path) if path.starts_with(repository_root) => path,
        _ => {
            return TargetFileFingerprint {
                path: file_path.to_string(),
                exists: true,
                size_bytes: Some(metadata.len()),
                modified_at: metadata_modified_at(&metadata),
                content_sha256: None,
                status: "unavailable".to_string(),
                reason: Some("File resolves outside the selected repository.".to_string()),
            };
        }
    };
    let content = match fs::read(canonical_target) {
        Ok(content) => content,
        Err(_) => {
            return TargetFileFingerprint {
                path: file_path.to_string(),
                exists: true,
                size_bytes: Some(metadata.len()),
                modified_at: metadata_modified_at(&metadata),
                content_sha256: None,
                status: "unavailable".to_string(),
                reason: Some("File content could not be read for fingerprinting.".to_string()),
            };
        }
    };

    if content.contains(&0) || std::str::from_utf8(&content).is_err() {
        return TargetFileFingerprint {
            path: file_path.to_string(),
            exists: true,
            size_bytes: Some(metadata.len()),
            modified_at: metadata_modified_at(&metadata),
            content_sha256: None,
            status: "binary".to_string(),
            reason: Some("Binary or non-UTF-8 content is not hashed.".to_string()),
        };
    }

    TargetFileFingerprint {
        path: file_path.to_string(),
        exists: true,
        size_bytes: Some(metadata.len()),
        modified_at: metadata_modified_at(&metadata),
        content_sha256: Some(sha256_hex(&content)),
        status: "captured".to_string(),
        reason: None,
    }
}

fn patch_validation_result(
    input: &PatchValidationInput,
    status: &str,
    message: &str,
) -> PatchValidationResult {
    PatchValidationResult {
        repository_id: input.repository_id.clone(),
        file_path: input.file_path.clone(),
        status: status.to_string(),
        message: message.to_string(),
        artifact_digest: input.artifact_digest.clone(),
        repository_snapshot: None,
        validated_at: now_unix_seconds(),
        dry_run_at: None,
    }
}

fn patch_validation_result_with_snapshot(
    input: &PatchValidationInput,
    status: &str,
    message: &str,
    repository_snapshot: RepositoryValidationSnapshot,
    dry_run_completed: bool,
) -> PatchValidationResult {
    PatchValidationResult {
        repository_id: input.repository_id.clone(),
        file_path: input.file_path.clone(),
        status: status.to_string(),
        message: message.to_string(),
        artifact_digest: input.artifact_digest.clone(),
        repository_snapshot: Some(repository_snapshot),
        validated_at: now_unix_seconds(),
        dry_run_at: dry_run_completed.then(now_unix_seconds),
    }
}

fn capture_repository_validation_snapshot(
    repository_id: &str,
    repository_root: &Path,
    canonical_repository_path: &str,
    artifact_digest: &str,
    relevant_paths: &[String],
) -> Result<RepositoryValidationSnapshot, String> {
    if !is_valid_sha256(artifact_digest) {
        return Err("The artifact digest is invalid.".to_string());
    }

    if relevant_paths.is_empty()
        || relevant_paths.len() > MAX_FINGERPRINT_TARGETS
        || relevant_paths
            .iter()
            .any(|path| path.len() > 320 || !is_safe_relative_git_path(path))
    {
        return Err("A target path is unsafe or outside the repository.".to_string());
    }

    let head_sha = git_output(canonical_repository_path, &["rev-parse", "--short", "HEAD"]);
    let branch = git_output(canonical_repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| head_sha.as_ref().map(|commit| format!("detached {commit}")));
    // A failed `git status` must stay unknown. Defaulting to empty output would
    // report zero changed files and a clean working tree, letting the clean-tree
    // apply gate pass on evidence that was never actually read.
    let Some(status_output) = git_output(canonical_repository_path, &["status", "--porcelain=v1"])
    else {
        return Err("The repository Git status could not be read.".to_string());
    };
    let changed_file_count = status_output.lines().count();
    let mut relevant_file_paths = relevant_paths.to_vec();
    relevant_file_paths.sort();
    relevant_file_paths.dedup();
    let target_file_fingerprints: Vec<TargetFileFingerprint> = relevant_file_paths
        .iter()
        .map(|path| fingerprint_target_file(repository_root, path))
        .collect();
    let canonical_snapshot = json!({
        "artifactDigest": artifact_digest.to_ascii_lowercase(),
        "branch": &branch,
        "changedFileCount": changed_file_count,
        "headSha": &head_sha,
        "isClean": changed_file_count == 0,
        "relevantFilePaths": &relevant_file_paths,
        "repositoryId": repository_id,
        "targetFileFingerprints": &target_file_fingerprints,
    });
    let repository_snapshot_digest = serde_json::to_vec(&canonical_snapshot)
        .ok()
        .map(|bytes| sha256_hex(&bytes));
    let captured_at = now_unix_seconds();

    Ok(RepositoryValidationSnapshot {
        repository_id: repository_id.to_string(),
        branch,
        head_sha,
        is_clean: changed_file_count == 0,
        changed_file_count,
        relevant_file_paths,
        artifact_digest: Some(artifact_digest.to_ascii_lowercase()),
        target_file_fingerprints,
        repository_snapshot_digest,
        captured_at: captured_at.clone(),
        fingerprinted_at: captured_at,
    })
}

fn validate_generated_patch_structure(input: &PatchValidationInput) -> Result<(), String> {
    if !is_safe_relative_git_path(&input.file_path) {
        return Err("The patch path is unsafe or outside the repository.".to_string());
    }

    if input.is_binary {
        return Err("binary_unavailable".to_string());
    }

    if input
        .relevant_file_paths
        .iter()
        .any(|path| !is_safe_relative_git_path(path))
    {
        return Err("A proposed file path is unsafe or outside the repository.".to_string());
    }

    if input.operation == "rename" {
        return Err("rename_unavailable".to_string());
    }

    if !matches!(
        input.operation.as_str(),
        "create" | "modify" | "delete" | "unknown"
    ) {
        return Err("The proposed file operation is invalid.".to_string());
    }

    let Some(raw_diff) = input.raw_diff.as_deref() else {
        return Err("content_unavailable".to_string());
    };
    let lines: Vec<&str> = raw_diff.split('\n').collect();

    if raw_diff.is_empty()
        || raw_diff.len() > MAX_GENERATED_PATCH_BYTES
        || lines.len() > MAX_GENERATED_PATCH_LINES
    {
        return Err("The patch exceeds the validation size or line-count limit.".to_string());
    }

    if raw_diff.contains('\0')
        || raw_diff.contains('\r')
        || raw_diff.contains("GIT binary patch")
        || raw_diff.contains("Binary files ")
        || raw_diff.contains("new file mode 120000")
        || raw_diff.contains("new file mode 160000")
        || lines.iter().any(|line| {
            line.starts_with("rename from ")
                || line.starts_with("rename to ")
                || line.starts_with("copy from ")
                || line.starts_with("copy to ")
        })
    {
        return Err(
            "The text patch contains unsupported binary, link, or path metadata.".to_string(),
        );
    }

    let expected_diff_header = format!("diff --git a/{path} b/{path}", path = input.file_path);
    let diff_headers: Vec<&str> = lines
        .iter()
        .copied()
        .filter(|line| line.starts_with("diff --git "))
        .collect();
    if !lines.iter().any(|line| line.starts_with("@@ ")) {
        return Err("The artifact must contain a unified diff hunk.".to_string());
    }

    let sections = unified_diff_sections(raw_diff)?;

    if diff_headers.len() != 1 || diff_headers[0] != expected_diff_header || sections.len() != 1 {
        return Err("The artifact must contain one matching single-file unified diff.".to_string());
    }

    let section = &sections[0];
    let expected_old_path = format!("a/{}", input.file_path);
    let expected_new_path = format!("b/{}", input.file_path);
    let old_path = section.old_path.as_str();
    let new_path = section.new_path.as_str();
    let operation_matches = match input.operation.as_str() {
        "create" => old_path == "/dev/null" && new_path == expected_new_path,
        "delete" => old_path == expected_old_path && new_path == "/dev/null",
        "modify" => old_path == expected_old_path && new_path == expected_new_path,
        "unknown" => {
            (old_path == expected_old_path || old_path == "/dev/null")
                && (new_path == expected_new_path || new_path == "/dev/null")
        }
        _ => false,
    };

    if !operation_matches {
        return Err("The patch headers do not match the proposed file operation.".to_string());
    }

    Ok(())
}

fn apply_patch_error(code: &str, message: &str) -> ApplyPatchError {
    ApplyPatchError {
        code: code.to_string(),
        message: message.to_string(),
    }
}

fn apply_failure_details(
    outcome: FixedGitApplyOutcome,
) -> Option<(&'static str, &'static str, &'static str, &'static str)> {
    match outcome {
        FixedGitApplyOutcome::Succeeded => None,
        FixedGitApplyOutcome::TimedOut => Some((
            "interrupted",
            "interrupted",
            "git_apply_timeout",
            "Git patch application exceeded 15 seconds and was terminated. The backup was preserved and manual inspection is required.",
        )),
        FixedGitApplyOutcome::Interrupted => Some((
            "interrupted",
            "interrupted",
            "git_apply_interrupted",
            "Git patch application did not report a reliable terminal result. The backup was preserved and manual inspection is required.",
        )),
        FixedGitApplyOutcome::Rejected | FixedGitApplyOutcome::Unavailable => Some((
            "failed",
            "apply_failed",
            "git_apply_failed",
            "Git could not apply the approved patch. The working tree should be reviewed before retrying.",
        )),
    }
}

fn normalized_patch_text(raw_diff: &str) -> String {
    let normalized = raw_diff.replace("\r\n", "\n").replace('\r', "\n");
    if normalized.ends_with('\n') {
        normalized
    } else {
        format!("{normalized}\n")
    }
}

fn wait_for_child_with_timeout(child: &mut Child, timeout: Duration) -> FixedGitApplyOutcome {
    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return FixedGitApplyOutcome::Succeeded,
            Ok(Some(_)) => return FixedGitApplyOutcome::Rejected,
            Ok(None) if started_at.elapsed() < timeout => {
                std::thread::sleep(GIT_CHILD_POLL_INTERVAL);
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return FixedGitApplyOutcome::TimedOut;
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return FixedGitApplyOutcome::Interrupted;
            }
        }
    }
}

fn run_fixed_git_apply(
    repository_path: &str,
    patch: &str,
    check_only: bool,
) -> FixedGitApplyOutcome {
    run_fixed_git_apply_command(repository_path, patch, check_only, false)
}

fn run_fixed_git_reverse_check(repository_path: &str, patch: &str) -> FixedGitApplyOutcome {
    run_fixed_git_apply_command(repository_path, patch, true, true)
}

fn run_fixed_git_apply_command(
    repository_path: &str,
    patch: &str,
    check_only: bool,
    reverse: bool,
) -> FixedGitApplyOutcome {
    let mut command = Command::new("git");
    command.arg("apply");
    if check_only {
        command.arg("--check");
    }
    if reverse {
        command.arg("--reverse");
    }
    let mut child = match command
        .args(["--whitespace=nowarn", "-"])
        .current_dir(repository_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(_) => return FixedGitApplyOutcome::Unavailable,
    };
    let Some(mut stdin) = child.stdin.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return FixedGitApplyOutcome::Unavailable;
    };
    let patch_bytes = patch.as_bytes().to_vec();
    let writer = std::thread::spawn(move || stdin.write_all(&patch_bytes));
    let outcome = wait_for_child_with_timeout(&mut child, GIT_APPLY_TIMEOUT);
    let write_succeeded = writer.join().is_ok_and(|result| result.is_ok());

    if outcome == FixedGitApplyOutcome::Succeeded && !write_succeeded {
        FixedGitApplyOutcome::Interrupted
    } else {
        outcome
    }
}

fn git_status_summary_json(summary: &GitStatusSummary) -> Value {
    json!({
        "repositoryId": &summary.repository_id,
        "repositoryPath": &summary.repository_path,
        "branch": &summary.branch,
        "headSha": &summary.head_sha,
        "isGitRepository": summary.is_git_repository,
        "isClean": summary.is_clean,
        "changedFileCount": summary.changed_file_count,
        "stagedCount": summary.staged_count,
        "unstagedCount": summary.unstaged_count,
        "untrackedCount": summary.untracked_count,
        "conflictedCount": summary.conflicted_count,
        "files": summary.files.iter().map(|file| json!({
            "path": &file.path,
            "oldPath": &file.old_path,
            "kind": &file.kind,
            "stage": &file.stage,
            "statusCode": &file.status_code,
        })).collect::<Vec<_>>(),
        "refreshedAt": &summary.refreshed_at,
    })
}

fn patch_apply_evidence(
    artifact_digest: &str,
    repository_snapshot: Option<RepositoryValidationSnapshot>,
    git_status: Option<&GitStatusSummary>,
) -> PatchApplyEvidence {
    PatchApplyEvidence {
        artifact_digest: artifact_digest.to_string(),
        repository_snapshot,
        git_status: git_status.map(git_status_summary_json),
        captured_at: now_unix_seconds(),
    }
}

fn git_status_changed_from_evidence(
    evidence: &PatchApplyEvidence,
    current_status: &GitStatusSummary,
) -> Option<bool> {
    let previous = evidence.git_status.as_ref()?;
    let current = git_status_summary_json(current_status);
    Some(git_status_evidence_changed(previous, &current))
}

fn git_status_evidence_changed(previous: &Value, current: &Value) -> bool {
    [
        "branch",
        "headSha",
        "isGitRepository",
        "isClean",
        "changedFileCount",
        "stagedCount",
        "unstagedCount",
        "untrackedCount",
        "conflictedCount",
        "files",
    ]
    .iter()
    .any(|key| previous.get(key) != current.get(key))
}

struct UnifiedDiffSection {
    old_path: String,
    new_path: String,
}

fn hunk_span(spec: &str) -> Option<usize> {
    match spec.split_once(',') {
        Some((_, count)) => count.parse().ok(),
        None => Some(1),
    }
}

fn parse_hunk_line_counts(line: &str) -> Option<(usize, usize)> {
    let rest = line.strip_prefix("@@ ")?;
    let end = rest.find(" @@")?;
    let mut ranges = rest[..end].split(' ');
    let old_spec = ranges.next()?.strip_prefix('-')?;
    let new_spec = ranges.next()?.strip_prefix('+')?;

    if ranges.next().is_some() {
        return None;
    }

    Some((hunk_span(old_spec)?, hunk_span(new_spec)?))
}

/// Walks every section of a unified diff, consuming each hunk body by its
/// declared line counts. Git accepts traditional sections that carry no
/// `diff --git` header, so a file smuggled after the first hunk is only visible
/// to a parser that tracks hunk boundaries instead of stopping at the first
/// `@@ `. Consuming bodies by count also keeps content lines such as
/// `--- signature` from being read as file headers.
fn unified_diff_sections(raw_diff: &str) -> Result<Vec<UnifiedDiffSection>, String> {
    let lines: Vec<&str> = raw_diff.lines().collect();
    let mut sections = Vec::new();
    let mut pending_old_path: Option<String> = None;
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];

        if line.starts_with("@@ ") {
            let (old_count, new_count) = parse_hunk_line_counts(line)
                .ok_or_else(|| "The patch contains a malformed hunk header.".to_string())?;
            let (mut old_seen, mut new_seen) = (0usize, 0usize);
            index += 1;

            while index < lines.len() && (old_seen < old_count || new_seen < new_count) {
                match lines[index].chars().next() {
                    Some(' ') | None => {
                        old_seen += 1;
                        new_seen += 1;
                    }
                    Some('-') => old_seen += 1,
                    Some('+') => new_seen += 1,
                    Some('\\') => {}
                    _ => return Err("The patch contains a malformed hunk body.".to_string()),
                }
                index += 1;
            }

            if old_seen != old_count || new_seen != new_count {
                return Err("The patch contains an incomplete hunk.".to_string());
            }

            continue;
        }

        if let Some(old_path) = line.strip_prefix("--- ") {
            if pending_old_path.is_some() {
                return Err("The patch contains an unmatched source header.".to_string());
            }
            pending_old_path = Some(old_path.to_string());
        } else if let Some(new_path) = line.strip_prefix("+++ ") {
            let old_path = pending_old_path.take().ok_or_else(|| {
                "The patch contains a target header without a source header.".to_string()
            })?;
            sections.push(UnifiedDiffSection {
                old_path,
                new_path: new_path.to_string(),
            });
        }

        index += 1;
    }

    if pending_old_path.is_some() {
        return Err("The patch contains an unmatched source header.".to_string());
    }

    Ok(sections)
}

fn parsed_unified_diff_paths(raw_diff: &str) -> BTreeSet<String> {
    unified_diff_sections(raw_diff)
        .unwrap_or_default()
        .into_iter()
        .flat_map(|section| [section.old_path, section.new_path])
        .filter(|path| path != "/dev/null")
        .filter_map(|path| {
            path.strip_prefix("a/")
                .or_else(|| path.strip_prefix("b/"))
                .map(str::to_string)
        })
        .collect()
}

fn verify_post_apply_changed_paths(
    artifact_path: &str,
    proposed_path: &str,
    parsed_patch_paths: &BTreeSet<String>,
    backup_path: &str,
    fingerprint_path: &str,
    post_apply_git_status: &GitStatusSummary,
) -> PostApplyPathVerification {
    let expected_paths = BTreeSet::from([artifact_path.to_string()]);
    let evidence_paths = BTreeSet::from([
        proposed_path.to_string(),
        backup_path.to_string(),
        fingerprint_path.to_string(),
    ]);
    let evidence_matches =
        evidence_paths == expected_paths && parsed_patch_paths == &expected_paths;
    let mut observed_paths = BTreeSet::new();
    let mut observed_unsafe_path = false;
    for file in &post_apply_git_status.files {
        for path in [Some(file.path.as_str()), file.old_path.as_deref()]
            .into_iter()
            .flatten()
        {
            if is_safe_relative_git_path(path) {
                observed_paths.insert(path.to_string());
            } else {
                observed_unsafe_path = true;
            }
        }
    }

    let unexpected_paths = observed_paths
        .difference(&expected_paths)
        .cloned()
        .collect::<Vec<_>>();
    let missing_expected_paths = expected_paths
        .difference(&observed_paths)
        .cloned()
        .collect::<Vec<_>>();
    let status_is_consistent = post_apply_git_status.is_git_repository
        && post_apply_git_status.changed_file_count == post_apply_git_status.files.len()
        && post_apply_git_status.staged_count == 0;
    let verified = evidence_matches
        && status_is_consistent
        && !observed_unsafe_path
        && unexpected_paths.is_empty()
        && missing_expected_paths.is_empty();
    let message = if verified {
        "Post-apply verification confirmed that only the approved artifact path changed. No files were staged or committed."
    } else {
        "Post-apply verification could not prove that only the approved artifact path changed. The outcome is quarantined for manual inspection."
    };

    PostApplyPathVerification {
        status: if verified {
            "applied_verified".to_string()
        } else {
            "quarantine_required".to_string()
        },
        expected_paths: expected_paths.into_iter().collect(),
        observed_changed_paths: observed_paths.into_iter().collect(),
        unexpected_paths,
        missing_expected_paths,
        verified_at: now_unix_seconds(),
        message: message.to_string(),
    }
}

fn set_artifact_post_apply_verification(
    artifacts: &mut Value,
    artifact_id: &str,
    verification: &PostApplyPathVerification,
) -> Result<(), ApplyPatchError> {
    let artifact = artifacts
        .as_array_mut()
        .and_then(|items| {
            items
                .iter_mut()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(artifact_id))
        })
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            apply_patch_error(
                "artifact_not_found",
                "The persisted patch artifact is unavailable.",
            )
        })?;
    artifact.insert(
        "postApplyVerification".to_string(),
        serde_json::to_value(verification).map_err(|_| {
            apply_patch_error(
                "apply_state_persistence_failed",
                "Post-apply path verification could not be serialized safely.",
            )
        })?,
    );
    Ok(())
}

fn set_artifact_rollback_metadata(
    artifacts: &mut Value,
    artifact_id: &str,
    status: &str,
    rollback_backup_id: Option<&str>,
    rolled_back_at: Option<&str>,
    rollback_error: Option<&str>,
    verification: Option<&PostRollbackVerification>,
    post_rollback_git_status: Option<&GitStatusSummary>,
) -> Result<(), ApplyPatchError> {
    let artifact = artifacts
        .as_array_mut()
        .and_then(|items| {
            items
                .iter_mut()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(artifact_id))
        })
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            apply_patch_error(
                "artifact_not_found",
                "The persisted patch artifact is unavailable.",
            )
        })?;

    artifact.insert("applyStatus".to_string(), json!(status));
    if let Some(rollback_backup_id) = rollback_backup_id {
        artifact.insert("rollbackBackupId".to_string(), json!(rollback_backup_id));
    }
    if let Some(rolled_back_at) = rolled_back_at {
        artifact.insert("rolledBackAt".to_string(), json!(rolled_back_at));
        artifact.insert("rolledBackBy".to_string(), json!("local_user"));
    }
    if let Some(error) = rollback_error {
        artifact.insert("applyError".to_string(), json!(error));
    }
    if let Some(verification) = verification {
        artifact.insert(
            "postRollbackVerification".to_string(),
            serde_json::to_value(verification).map_err(|_| {
                apply_patch_error(
                    "rollback_state_persistence_failed",
                    "Post-restore verification could not be serialized safely.",
                )
            })?,
        );
    }
    if let Some(summary) = post_rollback_git_status {
        artifact.insert(
            "postApplyGitStatus".to_string(),
            git_status_summary_json(summary),
        );
    }

    Ok(())
}

fn set_artifact_apply_metadata(
    artifacts: &mut Value,
    artifact_id: &str,
    status: &str,
    backup_id: Option<&str>,
    applied_at: Option<&str>,
    apply_error: Option<&str>,
    post_apply_git_status: Option<&GitStatusSummary>,
) -> Result<(), ApplyPatchError> {
    let artifact = artifacts
        .as_array_mut()
        .and_then(|items| {
            items
                .iter_mut()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(artifact_id))
        })
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            apply_patch_error(
                "artifact_not_found",
                "The persisted patch artifact is unavailable.",
            )
        })?;

    artifact.insert("applyStatus".to_string(), json!(status));
    if let Some(backup_id) = backup_id {
        artifact.insert("backupId".to_string(), json!(backup_id));
    }
    if let Some(applied_at) = applied_at {
        artifact.insert("appliedAt".to_string(), json!(applied_at));
        artifact.insert("appliedBy".to_string(), json!("local_user"));
    }
    if let Some(error) = apply_error {
        artifact.insert("applyError".to_string(), json!(error));
    } else {
        artifact.remove("applyError");
    }
    if let Some(summary) = post_apply_git_status {
        artifact.insert(
            "postApplyGitStatus".to_string(),
            git_status_summary_json(summary),
        );
    }

    Ok(())
}

async fn ensure_patch_apply_tables(pool: &SqlitePool) -> Result<(), ApplyPatchError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patch_apply_backups (id TEXT PRIMARY KEY, proposed_change_id TEXT NOT NULL, patch_artifact_id TEXT NOT NULL, repository_id TEXT NOT NULL, files_json TEXT NOT NULL, created_at TEXT NOT NULL)",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Native backup storage is unavailable. The patch was not applied.",
        )
    })?;
    // A separate table, not an extra row in `patch_apply_backups`.
    //
    // Conflating the bytes we restore *from* with the bytes we overwrote is how a
    // recovery path destroys what it is recovering. Reconciliation already reads
    // `patch_apply_backups` scoped by four IDs expecting apply semantics, and an
    // extra row there could be mistaken for the pre-apply backup — the one thing
    // rollback restores from.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patch_rollback_backups (id TEXT PRIMARY KEY, rollback_attempt_id TEXT NOT NULL, proposed_change_id TEXT NOT NULL, patch_artifact_id TEXT NOT NULL, repository_id TEXT NOT NULL, files_json TEXT NOT NULL, created_at TEXT NOT NULL)",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Native rollback backup storage is unavailable. Nothing was rolled back.",
        )
    })?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patch_apply_attempts (id TEXT PRIMARY KEY, proposed_change_id TEXT NOT NULL, patch_artifact_id TEXT NOT NULL, approval_request_id TEXT NOT NULL, repository_id TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, sanitized_error TEXT, backup_id TEXT, started_at TEXT NOT NULL, completed_at TEXT, pre_apply_evidence_json TEXT, post_apply_evidence_json TEXT, post_apply_git_status_json TEXT, post_apply_verification_json TEXT)",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Native apply audit storage is unavailable. The patch was not applied.",
        )
    })?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patch_apply_locks (id TEXT PRIMARY KEY, repository_id TEXT NOT NULL, process_id INTEGER NOT NULL, operation TEXT NOT NULL, patch_artifact_id TEXT, status TEXT NOT NULL, started_at TEXT NOT NULL, stale_after INTEGER NOT NULL, completed_at TEXT)",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Native apply lock storage is unavailable. The patch was not applied.",
        )
    })?;
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patch_apply_locks_active_repository ON patch_apply_locks(repository_id) WHERE status = 'active'",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Native apply lock storage could not be initialized safely.",
        )
    })?;

    let table_columns = sqlx::query("PRAGMA table_info(patch_apply_attempts)")
        .fetch_all(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "Native apply audit storage could not be inspected.",
            )
        })?
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect::<Vec<_>>();
    for (column, statement) in [
        (
            "sanitized_error",
            "ALTER TABLE patch_apply_attempts ADD COLUMN sanitized_error TEXT",
        ),
        (
            "pre_apply_evidence_json",
            "ALTER TABLE patch_apply_attempts ADD COLUMN pre_apply_evidence_json TEXT",
        ),
        (
            "post_apply_evidence_json",
            "ALTER TABLE patch_apply_attempts ADD COLUMN post_apply_evidence_json TEXT",
        ),
        (
            "post_apply_verification_json",
            "ALTER TABLE patch_apply_attempts ADD COLUMN post_apply_verification_json TEXT",
        ),
        (
            "acknowledged_at",
            "ALTER TABLE patch_apply_attempts ADD COLUMN acknowledged_at TEXT",
        ),
        (
            "acknowledged_from_status",
            "ALTER TABLE patch_apply_attempts ADD COLUMN acknowledged_from_status TEXT",
        ),
        // Distinct from `backup_id`, which stays the pre-apply backup a rollback
        // restores *from* and which reconciliation reads with apply semantics.
        // The bytes rollback destroyed get their own column and their own table.
        (
            "rollback_backup_id",
            "ALTER TABLE patch_apply_attempts ADD COLUMN rollback_backup_id TEXT",
        ),
        (
            "post_rollback_verification_json",
            "ALTER TABLE patch_apply_attempts ADD COLUMN post_rollback_verification_json TEXT",
        ),
    ] {
        if !table_columns.iter().any(|existing| existing == column) {
            sqlx::query(statement).execute(pool).await.map_err(|_| {
                apply_patch_error(
                    "storage_unavailable",
                    "Native apply audit storage could not be upgraded safely.",
                )
            })?;
        }
    }
    sqlx::query(
        "UPDATE patch_apply_attempts SET status = 'failed', sanitized_error = COALESCE(sanitized_error, 'Patch application failed before completion.') WHERE status = 'apply_failed'",
    )
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Legacy apply attempt state could not be normalized safely.",
        )
    })?;
    Ok(())
}

fn apply_lock_directory(app_handle: &tauri::AppHandle) -> Result<PathBuf, ApplyPatchError> {
    app_handle
        .path()
        .app_local_data_dir()
        .map(|path| path.join("apply-locks"))
        .map_err(|_| {
            apply_patch_error(
                "apply_lock_unavailable",
                "The app-local apply lock directory is unavailable. The patch was not applied.",
            )
        })
}

fn try_repository_file_lock(
    lock_directory: &Path,
    repository_id: &str,
) -> Result<Option<RepositoryApplyLock>, ApplyPatchError> {
    fs::create_dir_all(lock_directory).map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The app-local apply lock directory could not be prepared. The patch was not applied.",
        )
    })?;
    let repository_digest = sha256_hex(repository_id.as_bytes());
    let lock_path = lock_directory.join(format!("{repository_digest}.lock"));
    let file = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(lock_path)
        .map_err(|_| {
            apply_patch_error(
                "apply_lock_unavailable",
                "The repository apply lock could not be opened. The patch was not applied.",
            )
        })?;

    match file.try_lock() {
        Ok(()) => Ok(Some(RepositoryApplyLock {
            file,
            lock_id: None,
        })),
        Err(fs::TryLockError::WouldBlock) => Ok(None),
        Err(_) => Err(apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock could not be verified. The patch was not applied.",
        )),
    }
}

async fn mark_abandoned_apply_locks_stale(
    pool: &SqlitePool,
    repository_id: &str,
) -> Result<(), ApplyPatchError> {
    sqlx::query(
        "UPDATE patch_apply_locks SET status = 'stale', completed_at = ? WHERE repository_id = ? AND status = 'active'",
    )
    .bind(now_unix_seconds())
    .bind(repository_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "An abandoned apply lock could not be marked stale safely.",
        )
    })?;
    Ok(())
}

async fn release_repository_apply_lock(
    pool: &SqlitePool,
    lock: &RepositoryApplyLock,
) -> Result<(), ApplyPatchError> {
    let Some(lock_id) = lock.lock_id.as_deref() else {
        return Ok(());
    };
    sqlx::query(
        "UPDATE patch_apply_locks SET status = 'released', completed_at = ? WHERE id = ? AND status = 'active'",
    )
    .bind(now_unix_seconds())
    .bind(lock_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The durable apply lock could not be released cleanly.",
        )
    })?;
    Ok(())
}

/// Acquires the repository-scoped lock for a destructive operation.
///
/// `operation` is an audit record: it names which of the two destructive
/// operations held the lock. Hardcoding `apply_patch` here once rollback exists
/// would misreport a rollback as an apply in the durable lock trail.
///
/// The unresolved-attempt gate runs here, which is why rollback calls this
/// *before* inserting its own `rolling_back` row — the gate cannot see a row that
/// does not exist yet, so rollback cannot block itself. Once inserted, an
/// abandoned `rolling_back` row does block every later apply or rollback until a
/// human clears it with `INSPECTED`. Both behaviours are intended.
async fn acquire_repository_apply_lock(
    pool: &SqlitePool,
    lock_directory: &Path,
    repository_id: &str,
    patch_artifact_id: &str,
    operation: &str,
) -> Result<RepositoryApplyLock, ApplyPatchError> {
    let mut lock = try_repository_file_lock(lock_directory, repository_id)?.ok_or_else(|| {
        apply_patch_error(
            "apply_locked",
            "Another patch operation is already active for this repository. No patch was applied.",
        )
    })?;

    mark_abandoned_apply_locks_stale(pool, repository_id).await?;
    let unresolved_attempt = sqlx::query(
        "SELECT id FROM patch_apply_attempts WHERE repository_id = ? AND status IN ('pending', 'applying', 'rolling_back', 'interrupted', 'needs_inspection', 'quarantine_required') LIMIT 1",
    )
    .bind(repository_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Existing apply attempts could not be inspected safely.",
        )
    })?;
    if unresolved_attempt.is_some() {
        return Err(apply_patch_error(
            "unresolved_apply_attempt",
            "An unresolved patch attempt requires inspection before another patch can be applied.",
        ));
    }

    let started_at = now_unix_seconds();
    let started_at_seconds = unix_seconds();
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let lock_id = format!(
        "apply-lock-{}-{unique_suffix}",
        &sha256_hex(repository_id.as_bytes())[..12]
    );
    let stale_after = started_at_seconds.saturating_add(APPLY_LOCK_STALE_AFTER_SECONDS);
    let process_id = std::process::id();
    let metadata = json!({
        "lockId": &lock_id,
        "repositoryId": repository_id,
        "processId": process_id,
        "startedAt": &started_at,
        "operation": operation,
        "patchArtifactId": patch_artifact_id,
        "staleAfter": stale_after,
    });
    let metadata_bytes = serde_json::to_vec(&metadata).map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock metadata could not be prepared.",
        )
    })?;
    lock.file.set_len(0).map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock metadata could not be reset.",
        )
    })?;
    lock.file.seek(SeekFrom::Start(0)).map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock metadata could not be written.",
        )
    })?;
    lock.file.write_all(&metadata_bytes).map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock metadata could not be written.",
        )
    })?;
    lock.file.sync_data().map_err(|_| {
        apply_patch_error(
            "apply_lock_unavailable",
            "The repository apply lock metadata could not be persisted.",
        )
    })?;

    sqlx::query(
        "INSERT INTO patch_apply_locks (id, repository_id, process_id, operation, patch_artifact_id, status, started_at, stale_after) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
    )
    .bind(&lock_id)
    .bind(repository_id)
    .bind(i64::from(process_id))
    .bind(operation)
    .bind(patch_artifact_id)
    .bind(&started_at)
    .bind(stale_after as i64)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The durable repository apply lock could not be recorded.",
        )
    })?;
    lock.lock_id = Some(lock_id);
    Ok(lock)
}

fn create_apply_backup(
    repository_root: &Path,
    file_path: &str,
    operation: &str,
    expected_fingerprint: &TargetFileFingerprint,
) -> Result<ApplyPatchBackupFile, ApplyPatchError> {
    if expected_fingerprint.path != file_path
        || !matches!(expected_fingerprint.status.as_str(), "captured" | "missing")
    {
        return Err(apply_patch_error(
            "backup_unavailable",
            "A complete target-file backup cannot be created. The patch was not applied.",
        ));
    }

    if expected_fingerprint.status == "missing" {
        if operation != "create" && operation != "unknown" {
            return Err(apply_patch_error(
                "backup_unavailable",
                "The target file is missing for the proposed operation. The patch was not applied.",
            ));
        }
        return Ok(ApplyPatchBackupFile {
            path: file_path.to_string(),
            existed_before_apply: false,
            content_sha256: None,
            content: None,
        });
    }

    if operation == "create" {
        return Err(apply_patch_error(
            "backup_unavailable",
            "The create target already exists. The patch was not applied.",
        ));
    }

    let target_path = repository_root.join(file_path);
    let metadata = fs::symlink_metadata(&target_path).map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "Target-file metadata is unavailable. The patch was not applied.",
        )
    })?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_FINGERPRINT_BYTES
    {
        return Err(apply_patch_error(
            "backup_unavailable",
            "The target file cannot be safely backed up. The patch was not applied.",
        ));
    }
    let canonical_target = fs::canonicalize(&target_path).map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "The target file cannot be safely resolved. The patch was not applied.",
        )
    })?;
    if !canonical_target.starts_with(repository_root) {
        return Err(apply_patch_error(
            "outside_repository",
            "The target file resolves outside the selected repository.",
        ));
    }
    let content_bytes = fs::read(canonical_target).map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "The target file cannot be read for backup. The patch was not applied.",
        )
    })?;
    let content_hash = sha256_hex(&content_bytes);
    if expected_fingerprint.content_sha256.as_deref() != Some(content_hash.as_str()) {
        return Err(apply_patch_error(
            "stale_target",
            "The target file changed after validation. Re-run validation before applying.",
        ));
    }
    let content = String::from_utf8(content_bytes).map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "Binary target files are outside the safe apply boundary.",
        )
    })?;

    Ok(ApplyPatchBackupFile {
        path: file_path.to_string(),
        existed_before_apply: true,
        content_sha256: Some(content_hash),
        content: Some(content),
    })
}

/// Reads and hashes the bytes rollback is about to destroy.
///
/// Called immediately before the write, so its hash is both the drift evidence
/// and the pre-rollback backup content — one read, one hash, no chance of
/// storing different bytes than were checked.
///
/// Every non-capturable state refuses explicitly rather than being skipped or
/// truncated. By the time this runs the drift check has already established that
/// the target is `captured`, within bounds, and valid UTF-8, so the oversized and
/// binary arms are unreachable by construction — but unreachable-by-construction
/// is an argument, and a refusal is a guarantee.
fn capture_rollback_target(
    repository_root: &Path,
    file_path: &str,
) -> Result<RollbackTargetCapture, ApplyPatchError> {
    let backup_unavailable = || {
        apply_patch_error(
            "rollback_backup_unavailable",
            "The current file cannot be backed up, so it will not be overwritten. Nothing was rolled back.",
        )
    };

    let target_path = repository_root.join(file_path);
    let metadata = fs::symlink_metadata(&target_path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            apply_patch_error(
                "target_missing",
                "The target file no longer exists. Rollback will not resurrect a file that was deleted after the patch was applied.",
            )
        } else {
            backup_unavailable()
        }
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(backup_unavailable());
    }
    if metadata.len() > MAX_FINGERPRINT_BYTES {
        return Err(backup_unavailable());
    }
    let canonical_target = fs::canonicalize(&target_path).map_err(|_| backup_unavailable())?;
    if !canonical_target.starts_with(repository_root) {
        return Err(apply_patch_error(
            "outside_repository",
            "The target file resolves outside the selected repository. Nothing was rolled back.",
        ));
    }
    let content_bytes = fs::read(&canonical_target).map_err(|_| backup_unavailable())?;
    if content_bytes.contains(&0) {
        return Err(backup_unavailable());
    }
    let content_sha256 = sha256_hex(&content_bytes);
    let content = String::from_utf8(content_bytes).map_err(|_| backup_unavailable())?;

    Ok(RollbackTargetCapture {
        content,
        content_sha256,
    })
}

/// Collects the safe changed-path and staged-path sets from a Git status read.
///
/// Returns `None` if any observed path is unrepresentable, which fails closed:
/// an unsafe path we cannot compare is not a path we may ignore.
fn rollback_status_path_sets(
    status: &GitStatusSummary,
) -> Option<(BTreeSet<String>, BTreeSet<String>)> {
    let mut changed_paths = BTreeSet::new();
    let mut staged_paths = BTreeSet::new();
    for file in &status.files {
        for path in [Some(file.path.as_str()), file.old_path.as_deref()]
            .into_iter()
            .flatten()
        {
            if !is_safe_relative_git_path(path) {
                return None;
            }
            changed_paths.insert(path.to_string());
            if file.stage == "staged" || file.stage == "both" {
                staged_paths.insert(path.to_string());
            }
        }
    }

    Some((changed_paths, staged_paths))
}

/// Proves what the restore actually did, as a delta against the pre-restore tree.
///
/// The expectation is deliberately **not** "the tree is clean" and **not**
/// "nothing is staged". Apply required a clean tree, so restoring the pre-apply
/// content returns the target to HEAD's content and it simply leaves `git status`
/// — but the user may have dirtied or staged *unrelated* files since the apply,
/// and over-refusing on those would quarantine a repository where nothing went
/// wrong. A false quarantine is a false account, which is the failure class the
/// porcelain-parser fix was landed to remove.
///
/// So both sets are compared as deltas: the target leaves the changed set, and
/// the staged set is untouched. The target is guaranteed absent from
/// `pre_restore_staged_paths` by the `target_staged` precondition, so requiring
/// the staged set to be *unchanged* still proves the target did not become
/// staged.
#[allow(clippy::too_many_arguments)]
fn verify_post_rollback_state(
    file_path: &str,
    operation: &str,
    repository_root: &Path,
    restored_content_sha256: Option<&str>,
    pre_restore_changed_paths: &BTreeSet<String>,
    pre_restore_staged_paths: &BTreeSet<String>,
    pre_restore_head_sha: Option<&str>,
    post_rollback_git_status: &GitStatusSummary,
) -> PostRollbackVerification {
    let mut expected_changed_paths = pre_restore_changed_paths.clone();
    expected_changed_paths.remove(file_path);

    let observed = rollback_status_path_sets(post_rollback_git_status);
    let (observed_changed_paths, observed_staged_paths) = observed
        .clone()
        .unwrap_or_else(|| (BTreeSet::new(), BTreeSet::new()));

    let unexpected_paths = observed_changed_paths
        .difference(&expected_changed_paths)
        .cloned()
        .collect::<Vec<_>>();
    let missing_expected_paths = expected_changed_paths
        .difference(&observed_changed_paths)
        .cloned()
        .collect::<Vec<_>>();

    // The filesystem is checked directly rather than inferred from Git status:
    // status says a path is unmodified, the hash says the bytes are the exact
    // pre-apply bytes we stored.
    let target_path = repository_root.join(file_path);
    let filesystem_matches = match operation {
        "create" => !target_path.exists(),
        _ => match (restored_content_sha256, fs::read(&target_path)) {
            (Some(expected_hash), Ok(bytes)) => sha256_hex(&bytes) == expected_hash,
            _ => false,
        },
    };

    let head_unchanged = post_rollback_git_status.head_sha.as_deref() == pre_restore_head_sha;
    let status_is_consistent = post_rollback_git_status.is_git_repository
        && post_rollback_git_status.changed_file_count == post_rollback_git_status.files.len();
    let verified = observed.is_some()
        && filesystem_matches
        && head_unchanged
        && status_is_consistent
        && unexpected_paths.is_empty()
        && missing_expected_paths.is_empty()
        && observed_staged_paths == *pre_restore_staged_paths;

    let message = if verified {
        "Post-restore verification confirmed the target returned to its pre-apply contents and that no other path changed. Nothing was staged, committed, or removed from Git history."
    } else {
        "Post-restore verification could not prove that the rollback restored only the target path. The outcome is quarantined for manual inspection."
    };

    PostRollbackVerification {
        status: if verified {
            "rolled_back".to_string()
        } else {
            "quarantine_required".to_string()
        },
        target_path: file_path.to_string(),
        expected_changed_paths: expected_changed_paths.into_iter().collect(),
        observed_changed_paths: observed_changed_paths.into_iter().collect(),
        unexpected_paths,
        missing_expected_paths,
        expected_staged_paths: pre_restore_staged_paths.iter().cloned().collect(),
        observed_staged_paths: observed_staged_paths.into_iter().collect(),
        verified_at: now_unix_seconds(),
        message: message.to_string(),
    }
}

fn validate_apply_target_boundary(
    repository_root: &Path,
    file_path: &str,
) -> Result<(), ApplyPatchError> {
    if !is_safe_relative_git_path(file_path) || is_forbidden_fingerprint_path(file_path) {
        return Err(apply_patch_error(
            "forbidden_path",
            "The patch targets a protected or unsafe repository path.",
        ));
    }

    let relative_path = Path::new(file_path);
    let mut current_parent = repository_root.to_path_buf();
    if let Some(parent) = relative_path.parent() {
        for component in parent.components() {
            let Component::Normal(segment) = component else {
                return Err(apply_patch_error(
                    "forbidden_path",
                    "The patch target path is not repository-relative.",
                ));
            };
            current_parent.push(segment);
            let metadata = fs::symlink_metadata(&current_parent).map_err(|_| {
                apply_patch_error(
                    "parent_unavailable",
                    "Every target parent directory must already exist inside the repository.",
                )
            })?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(apply_patch_error(
                    "outside_repository",
                    "The patch target cannot traverse a symlink or non-directory parent.",
                ));
            }
            let canonical_parent = fs::canonicalize(&current_parent).map_err(|_| {
                apply_patch_error(
                    "parent_unavailable",
                    "The patch target parent could not be resolved safely.",
                )
            })?;
            if !canonical_parent.starts_with(repository_root) {
                return Err(apply_patch_error(
                    "outside_repository",
                    "The patch target resolves outside the selected repository.",
                ));
            }
        }
    }

    let target_path = repository_root.join(relative_path);
    if fs::symlink_metadata(target_path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(apply_patch_error(
            "outside_repository",
            "Symlink targets are outside the safe apply boundary.",
        ));
    }

    Ok(())
}

fn openai_model() -> Result<String, String> {
    let Some(model) = env::var("OPENAI_MODEL")
        .ok()
        .map(|model| model.trim().to_string())
        .filter(|model| !model.is_empty())
    else {
        return Ok(DEFAULT_OPENAI_MODEL.to_string());
    };

    if is_safe_openai_model_id(&model) {
        Ok(model)
    } else {
        Err("invalid_configuration".to_string())
    }
}

fn is_safe_openai_model_id(model: &str) -> bool {
    !model.is_empty()
        && model.len() <= 120
        && model.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':')
        })
}

fn openai_model_url(model: &str) -> Result<reqwest::Url, String> {
    if !is_safe_openai_model_id(model) {
        return Err("invalid_model".to_string());
    }

    let mut url =
        reqwest::Url::parse(OPENAI_MODELS_URL).map_err(|_| "invalid_model".to_string())?;
    url.path_segments_mut()
        .map_err(|_| "invalid_model".to_string())?
        .push(model);
    Ok(url)
}

fn openai_connection_status(status: reqwest::StatusCode) -> (&'static str, &'static str) {
    match status.as_u16() {
        200..=299 => (
            "connected",
            "OpenAI credentials and configured model access were verified.",
        ),
        401 | 403 => (
            "authentication_failed",
            "OpenAI authentication or model access was denied.",
        ),
        404 => (
            "model_unavailable",
            "The configured OpenAI model is not available to this credential.",
        ),
        408 | 504 => ("timeout", "The OpenAI connection test timed out."),
        429 => (
            "rate_limited",
            "OpenAI rate limited the connection test. Try again later.",
        ),
        _ => (
            "unavailable",
            "OpenAI could not be reached for a connection test.",
        ),
    }
}

fn is_sensitive_provider_path(file_path: &str) -> bool {
    let normalized = file_path.to_ascii_lowercase();
    let file_name = Path::new(&normalized)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    file_name == ".env"
        || file_name.starts_with(".env.")
        || matches!(file_name, "id_rsa" | "id_ed25519" | "credentials.json")
        || file_name.starts_with("secrets.")
        || [".pem", ".key", ".p12", ".pfx"]
            .iter()
            .any(|extension| file_name.ends_with(extension))
}

fn validate_openai_plan_input(input: &OpenAiPlanInput) -> Result<(), String> {
    let title = input.task_title.trim();
    let prompt = input.task_prompt.trim();

    if title.is_empty() || title.len() > 160 {
        return Err("invalid_input".to_string());
    }

    if prompt.is_empty() || prompt.len() > MAX_PROVIDER_TASK_BYTES {
        return Err("invalid_input".to_string());
    }

    if input.context.branch.trim().is_empty() || input.context.branch.len() > 200 {
        return Err("invalid_input".to_string());
    }

    if input.context.indexed_file_count > MAX_INDEXED_FILES
        || input.context.key_files.len() > MAX_PROVIDER_KEY_FILES
        || input.context.project_folders.len() > MAX_PROVIDER_FOLDERS
        || input.context.top_extensions.len() > MAX_PROVIDER_EXTENSIONS
    {
        return Err("invalid_input".to_string());
    }

    if input.context.key_files.iter().any(|path| {
        path.len() > 320 || !is_safe_relative_path(path) || is_sensitive_provider_path(path)
    }) {
        return Err("invalid_input".to_string());
    }

    if input.context.project_folders.iter().any(|folder| {
        folder.len() > 120
            || !is_safe_relative_path(folder)
            || folder.contains('/')
            || folder.contains('\\')
            || is_sensitive_provider_path(folder)
    }) {
        return Err("invalid_input".to_string());
    }

    if input.context.top_extensions.iter().any(|extension| {
        extension.extension.trim().is_empty()
            || extension.extension.len() > 24
            || extension.count > MAX_INDEXED_FILES
    }) {
        return Err("invalid_input".to_string());
    }

    Ok(())
}

fn openai_plan_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": [
            "summary",
            "steps",
            "affectedFiles",
            "risks",
            "validation",
            "patchArtifacts",
            "approvalRequired"
        ],
        "properties": {
            "summary": { "type": "string" },
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["title", "description"],
                    "properties": {
                        "title": { "type": "string" },
                        "description": { "type": "string" }
                    }
                }
            },
            "affectedFiles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["path", "reason", "operation", "riskLevel"],
                    "properties": {
                        "path": { "type": "string" },
                        "reason": { "type": "string" },
                        "operation": {
                            "type": "string",
                            "enum": ["create", "modify", "delete", "rename", "unknown"]
                        },
                        "riskLevel": {
                            "type": "string",
                            "enum": ["low", "medium", "high"]
                        }
                    }
                }
            },
            "risks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["level", "title", "description"],
                    "properties": {
                        "level": { "type": "string", "enum": ["low", "medium", "high"] },
                        "title": { "type": "string" },
                        "description": { "type": "string" }
                    }
                }
            },
            "validation": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["label"],
                    "properties": {
                        "label": { "type": "string" }
                    }
                }
            },
            "patchArtifacts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["filePath", "status", "isBinary", "rawDiff"],
                    "properties": {
                        "filePath": { "type": "string" },
                        "status": {
                            "type": "string",
                            "enum": ["generated", "failed", "unavailable"]
                        },
                        "isBinary": { "type": "boolean" },
                        "rawDiff": { "type": "string" }
                    }
                }
            },
            "approvalRequired": { "type": "boolean" }
        }
    })
}

fn build_openai_plan_request(input: &OpenAiPlanInput, model: &str) -> Value {
    let bounded_prompt = json!({
        "taskTitle": input.task_title.trim(),
        "taskPrompt": input.task_prompt.trim(),
        "repositoryName": input.repository_name,
        "branch": input.context.branch,
        "indexedFileCount": input.context.indexed_file_count,
        "keyFiles": input.context.key_files,
        "projectFolders": input.context.project_folders,
        "topExtensions": input.context.top_extensions,
        "git": input.context.git
    });

    json!({
        "model": model,
        "store": false,
        "instructions": "Create a reviewable implementation plan and optional proposed patch artifacts using only the supplied repository summary. Patch artifacts are review-only data: never apply them, invoke tools, run commands, or claim they reflect current repository contents. Return one artifact at most for each affected file. Use generated only for a single-file unified diff you can produce without guessing existing content (normally a create operation); otherwise use unavailable or failed with an empty rawDiff. Binary artifacts must use an empty rawDiff. Every result requires human approval.",
        "input": [{
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": bounded_prompt.to_string()
            }]
        }],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "agent_plan",
                "strict": true,
                "schema": openai_plan_schema()
            }
        },
        "max_output_tokens": 4000
    })
}

fn extract_openai_output_text(response: &Value) -> Option<&str> {
    response
        .get("output")?
        .as_array()?
        .iter()
        .flat_map(|item| {
            item.get("content")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .find(|content| content.get("type").and_then(Value::as_str) == Some("output_text"))
        .and_then(|content| content.get("text"))
        .and_then(Value::as_str)
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

/// Decodes git's C-style quoting from a porcelain path.
///
/// git quotes any path containing a space, a non-ASCII byte, a quote, or a
/// backslash, escaping bytes as `\NNN` octal plus the usual C escapes. An
/// unquoted path is returned unchanged, which is also what `core.quotepath=false`
/// produces -- that setting is not a fix, because git still quotes the space
/// case.
///
/// Escapes are byte-level and a repository path need not be valid UTF-8, so the
/// decoded bytes are converted strictly. A lossy conversion would substitute
/// U+FFFD and yield a path that silently fails to match the approved one, which
/// is precisely the defect this function exists to remove. Returning `None`
/// rejects the line; the caller's raw line count is what keeps that rejection
/// fail-closed rather than fail-open.
fn unquote_porcelain_path(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();

    if bytes.len() < 2 || bytes[0] != b'"' || bytes[bytes.len() - 1] != b'"' {
        return Some(raw.to_string());
    }

    let inner = &bytes[1..bytes.len() - 1];
    let mut decoded: Vec<u8> = Vec::with_capacity(inner.len());
    let mut index = 0;

    while index < inner.len() {
        if inner[index] != b'\\' {
            decoded.push(inner[index]);
            index += 1;
            continue;
        }

        index += 1;
        let escape = *inner.get(index)?;

        match escape {
            b'a' => decoded.push(0x07),
            b'b' => decoded.push(0x08),
            b't' => decoded.push(b'\t'),
            b'n' => decoded.push(b'\n'),
            b'v' => decoded.push(0x0b),
            b'f' => decoded.push(0x0c),
            b'r' => decoded.push(b'\r'),
            b'"' => decoded.push(b'"'),
            b'\\' => decoded.push(b'\\'),
            b'0'..=b'7' => {
                let digits = inner.get(index..index + 3)?;
                if !digits.iter().all(|digit| (b'0'..=b'7').contains(digit)) {
                    return None;
                }
                let value = digits
                    .iter()
                    .fold(0u32, |total, digit| total * 8 + u32::from(digit - b'0'));
                decoded.push(u8::try_from(value).ok()?);
                index += 2;
            }
            _ => return None,
        }

        index += 1;
    }

    String::from_utf8(decoded).ok()
}

/// Parses porcelain v1 output into changed files, and reports how many status
/// lines git actually emitted.
///
/// The two numbers can differ: a line whose path cannot be represented safely is
/// rejected and dropped. The raw count is what makes that drop visible --
/// counting `files` instead would compare the result to itself and let an
/// unrepresentable changed path pass verification unnoticed.
fn parse_git_status_lines(status_output: &str) -> (Vec<GitChangedFile>, usize) {
    let lines: Vec<&str> = status_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    let files: Vec<GitChangedFile> = lines
        .iter()
        .copied()
        .filter_map(parse_porcelain_line)
        .collect();

    (files, lines.len())
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

    let (raw_old_path, raw_new_path) = if index_status == 'R' || index_status == 'C' {
        match raw_path.split_once(" -> ") {
            Some((old_path, new_path)) => (Some(old_path), new_path),
            None => (None, raw_path),
        }
    } else {
        (None, raw_path)
    };
    let path = unquote_porcelain_path(raw_new_path)?;
    let old_path = match raw_old_path {
        Some(old_path) => Some(unquote_porcelain_path(old_path)?),
        None => None,
    };

    if !is_safe_relative_path(&path) {
        return None;
    }

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

    let head_sha = git_output(
        &canonical_repository_path,
        &["rev-parse", "--short", "HEAD"],
    );
    let branch = git_output(&canonical_repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| head_sha.as_ref().map(|commit| format!("detached {commit}")));
    let status_output =
        git_output(&canonical_repository_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let (files, status_line_count) = parse_git_status_lines(&status_output);
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
        head_sha,
        is_git_repository,
        is_clean: status_line_count == 0,
        // Counted from git's own output, not from `files`: a rejected line is
        // dropped from `files`, and counting `files` would compare the result to
        // itself and hide it.
        changed_file_count: status_line_count,
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

async fn apply_approved_patch_artifact_with_pool(
    pool: &SqlitePool,
    lock_directory: &Path,
    input: ApplyApprovedPatchArtifactInput,
) -> Result<ApplyApprovedPatchArtifactResult, ApplyPatchError> {
    #[cfg(test)]
    let _apply_guard = PATCH_APPLY_LOCK.lock().await;
    #[cfg(not(test))]
    let _apply_guard = PATCH_APPLY_LOCK.try_lock().map_err(|_| {
        apply_patch_error(
            "apply_locked",
            "Another patch operation is already active in this app process. No patch was applied.",
        )
    })?;

    if input.confirmation_phrase != APPLY_CONFIRMATION_PHRASE {
        return Err(apply_patch_error(
            "confirmation_required",
            "Type APPLY PATCH exactly to confirm this working-tree modification.",
        ));
    }
    if [
        &input.repository_id,
        &input.proposed_change_id,
        &input.approval_request_id,
        &input.patch_artifact_id,
    ]
    .iter()
    .any(|id| id.trim().is_empty() || id.len() > 240 || id.contains('\0'))
    {
        return Err(apply_patch_error(
            "invalid_identifier",
            "A durable application identifier is invalid.",
        ));
    }

    ensure_patch_apply_tables(pool).await?;
    let lock = acquire_repository_apply_lock(
        pool,
        lock_directory,
        &input.repository_id,
        &input.patch_artifact_id,
        "apply_patch",
    )
    .await?;
    let result = apply_approved_patch_artifact_under_lock(pool, input).await;
    let _ = release_repository_apply_lock(pool, &lock).await;
    result
}

/// Records that a human inspected an unresolved apply attempt.
///
/// Without this, `quarantine_required`, `needs_inspection`, and `interrupted`
/// are permanent: they block every future apply for the repository and no
/// command transitions out of them, so the only exit is editing SQLite by hand.
///
/// Acknowledgement is deliberately narrow. It records the inspection and clears
/// the repository-wide block. It never applies, retries, restores, or reads the
/// repository, and it never re-enables the artifact whose outcome was unproven:
/// that artifact stays permanently blocked by its own apply state. The original
/// classification is preserved in `acknowledged_from_status` for audit.
async fn acknowledge_patch_apply_attempt_with_pool(
    pool: &SqlitePool,
    input: AcknowledgeApplyAttemptInput,
) -> Result<AcknowledgeApplyAttemptResult, ApplyPatchError> {
    if input.confirmation_phrase != ACKNOWLEDGE_CONFIRMATION_PHRASE {
        return Err(apply_patch_error(
            "confirmation_required",
            "Type INSPECTED exactly to record that this attempt was reviewed manually.",
        ));
    }
    if input.apply_attempt_id.trim().is_empty()
        || input.apply_attempt_id.len() > 240
        || input.apply_attempt_id.contains('\0')
    {
        return Err(apply_patch_error(
            "invalid_identifier",
            "The apply attempt identifier is invalid.",
        ));
    }

    ensure_patch_apply_tables(pool).await?;
    let attempt_row = sqlx::query("SELECT status FROM patch_apply_attempts WHERE id = ? LIMIT 1")
        .bind(&input.apply_attempt_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The apply attempt could not be verified.",
            )
        })?
        .ok_or_else(|| {
            apply_patch_error("attempt_not_found", "The apply attempt is unavailable.")
        })?;
    let current_status: String = attempt_row.try_get("status").unwrap_or_default();

    // `pending` and `applying` may still be live or reconcilable. Only a
    // terminal, already-reconciled classification can be acknowledged.
    if !matches!(
        current_status.as_str(),
        "interrupted" | "needs_inspection" | "quarantine_required"
    ) {
        return Err(apply_patch_error(
            "attempt_not_inspectable",
            "Only a reconciled interrupted, quarantined, or ambiguous attempt can be acknowledged.",
        ));
    }

    let acknowledged_at = now_unix_seconds();
    let update = sqlx::query(
        "UPDATE patch_apply_attempts SET status = 'inspected', acknowledged_at = ?, acknowledged_from_status = status WHERE id = ? AND status IN ('interrupted', 'needs_inspection', 'quarantine_required')",
    )
    .bind(&acknowledged_at)
    .bind(&input.apply_attempt_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The inspection acknowledgement could not be recorded.",
        )
    })?;
    if update.rows_affected() != 1 {
        return Err(apply_patch_error(
            "attempt_not_inspectable",
            "The apply attempt changed while it was being acknowledged.",
        ));
    }

    Ok(AcknowledgeApplyAttemptResult {
        apply_attempt_id: input.apply_attempt_id,
        status: "inspected".to_string(),
        acknowledged_from_status: current_status,
        acknowledged_at,
        message: "The attempt was recorded as manually inspected. Its artifact remains permanently ineligible for application, and no patch was retried or rolled back.".to_string(),
    })
}

async fn apply_approved_patch_artifact_under_lock(
    pool: &SqlitePool,
    input: ApplyApprovedPatchArtifactInput,
) -> Result<ApplyApprovedPatchArtifactResult, ApplyPatchError> {
    let repository_row =
        sqlx::query("SELECT path, is_git_repository FROM repositories WHERE id = ? LIMIT 1")
            .bind(&input.repository_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| {
                apply_patch_error(
                    "storage_unavailable",
                    "The saved repository record could not be verified.",
                )
            })?
            .ok_or_else(|| {
                apply_patch_error(
                    "repository_not_found",
                    "The selected saved repository is unavailable.",
                )
            })?;
    let repository_path: String = repository_row.try_get("path").map_err(|_| {
        apply_patch_error(
            "repository_not_found",
            "The selected saved repository is unavailable.",
        )
    })?;
    let is_git_repository: i64 = repository_row.try_get("is_git_repository").unwrap_or(0);
    if is_git_repository != 1 {
        return Err(apply_patch_error(
            "not_git_repository",
            "Patch application requires a saved Git repository.",
        ));
    }
    let (repository_root, canonical_repository_path) =
        canonical_selected_git_root(&repository_path).map_err(|_| {
            apply_patch_error(
                "repository_unavailable",
                "The saved repository root could not be verified.",
            )
        })?;

    let proposal_row = sqlx::query(
        "SELECT run_id, approval_request_id, repository_id, status, files_json, patch_artifacts_json FROM proposed_changes WHERE id = ? LIMIT 1",
    )
    .bind(&input.proposed_change_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The persisted proposed change could not be verified.",
        )
    })?
    .ok_or_else(|| {
        apply_patch_error(
            "proposal_not_found",
            "The persisted proposed change is unavailable.",
        )
    })?;
    let proposal_run_id: String = proposal_row.try_get("run_id").unwrap_or_default();
    let linked_approval_id: Option<String> =
        proposal_row.try_get("approval_request_id").unwrap_or(None);
    let proposal_repository_id: String = proposal_row.try_get("repository_id").unwrap_or_default();
    let proposal_status: String = proposal_row.try_get("status").unwrap_or_default();
    let files_json: String = proposal_row.try_get("files_json").unwrap_or_default();
    let patch_artifacts_json: String = proposal_row
        .try_get("patch_artifacts_json")
        .unwrap_or_default();

    if proposal_repository_id != input.repository_id
        || linked_approval_id.as_deref() != Some(input.approval_request_id.as_str())
    {
        return Err(apply_patch_error(
            "link_mismatch",
            "The repository, proposal, and approval records are not durably linked.",
        ));
    }
    if proposal_status != "approved" {
        return Err(apply_patch_error(
            "proposal_not_approved",
            "The proposed change is not approved for application.",
        ));
    }

    let approval_row =
        sqlx::query("SELECT status, agent_run_id FROM approval_requests WHERE id = ? LIMIT 1")
            .bind(&input.approval_request_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| {
                apply_patch_error(
                    "storage_unavailable",
                    "The persisted approval request could not be verified.",
                )
            })?
            .ok_or_else(|| {
                apply_patch_error(
                    "approval_not_found",
                    "The linked approval request is unavailable.",
                )
            })?;
    let approval_status: String = approval_row.try_get("status").unwrap_or_default();
    let approval_run_id: String = approval_row.try_get("agent_run_id").unwrap_or_default();
    if approval_status != "approved" || approval_run_id != proposal_run_id {
        return Err(apply_patch_error(
            "approval_required",
            "The linked human approval has not been granted.",
        ));
    }

    let files: Value = serde_json::from_str(&files_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The proposed file records are invalid.",
        )
    })?;
    let mut artifacts: Value = serde_json::from_str(&patch_artifacts_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The persisted patch artifact records are invalid.",
        )
    })?;
    let artifact = artifacts
        .as_array()
        .and_then(|items| {
            items.iter().find(|item| {
                item.get("id").and_then(Value::as_str) == Some(input.patch_artifact_id.as_str())
            })
        })
        .cloned()
        .ok_or_else(|| {
            apply_patch_error(
                "artifact_not_found",
                "The persisted patch artifact is unavailable.",
            )
        })?;
    if artifact.get("proposedChangeId").and_then(Value::as_str)
        != Some(input.proposed_change_id.as_str())
    {
        return Err(apply_patch_error(
            "link_mismatch",
            "The patch artifact is not linked to the proposed change.",
        ));
    }
    // Eligibility is an allow-list, and the default is refusal.
    //
    // This guard used to enumerate the statuses that block, which made its
    // default *apply*: a status no arm named fell through every check and reached
    // the write. That was not hypothetical. `rolled_back` did exactly that --
    // re-applied the patch, wrote the file, and returned `applied_verified` --
    // and `interrupted`/`needs_inspection` did the same before #1. Both were
    // fixed by adding an arm, which resolves the instance and leaves the shape.
    //
    // Only two states may proceed:
    //
    //   * no `applyStatus` at all -- the artifact has never been applied.
    //   * `apply_failed` -- a previous attempt was rejected by git without
    //     changing the working tree. Retry is re-gated rather than replayed:
    //     structure validation, a fresh `git apply --check`, and the full
    //     snapshot comparison all re-run below in this same request.
    //
    // Everything else refuses, including any status added later, and including
    // `ready_to_apply` -- which nothing writes. Allow-listing an unreachable
    // status because its name reads well would be the enumerate mistake in
    // reverse: permission granted speculatively, so a future path that writes it
    // would apply silently with nobody re-reviewing the decision.
    //
    // The `matches!` below chooses a specific message for each known status. It
    // decides nothing; the condition above already did.
    let apply_state = artifact.get("applyStatus").and_then(Value::as_str);
    if !matches!(apply_state, None | Some("apply_failed")) {
        return Err(match apply_state {
            // Acknowledging an unresolved attempt clears the repository-wide
            // block, so this artifact-level guard is the only thing preventing
            // that acknowledgement from re-enabling a patch whose outcome was
            // never proven.
            Some("interrupted" | "needs_inspection" | "quarantine_required") => apply_patch_error(
                "unresolved_apply_attempt",
                "This patch artifact has an unresolved application attempt and requires manual inspection. It is not eligible for application.",
            ),
            // Rollback is terminal, not a return to eligibility. Re-applying
            // would reintroduce the replay every gate here exists to prevent.
            Some("rolled_back") => apply_patch_error(
                "already_rolled_back",
                "This patch artifact was rolled back and is permanently ineligible for application. Generate and validate a fresh proposal instead.",
            ),
            Some("rolling_back") => apply_patch_error(
                "rollback_in_progress",
                "A rollback of this patch artifact is in progress. It is not eligible for application.",
            ),
            Some("applying" | "applied" | "applied_verified") => apply_patch_error(
                "already_applied",
                "This patch artifact is already applying or has been applied.",
            ),
            _ => apply_patch_error(
                "apply_state_not_eligible",
                "This patch artifact is not in a state from which it can be applied. Only a generated artifact that has never been applied, or one whose previous attempt failed without changing the working tree, is eligible.",
            ),
        });
    }
    if artifact.get("status").and_then(Value::as_str) != Some("generated") {
        return Err(apply_patch_error(
            "artifact_not_generated",
            "Only generated patch artifacts can be applied.",
        ));
    }
    if artifact
        .get("isBinary")
        .and_then(Value::as_bool)
        .unwrap_or(true)
    {
        return Err(apply_patch_error(
            "binary_artifact",
            "Binary patch artifacts are outside the safe apply boundary.",
        ));
    }
    if artifact
        .get("isTooLarge")
        .and_then(Value::as_bool)
        .unwrap_or(true)
    {
        return Err(apply_patch_error(
            "artifact_too_large",
            "The patch artifact exceeds the safe apply size limit.",
        ));
    }
    if artifact.get("validationStatus").and_then(Value::as_str) != Some("dry_run_passed")
        || artifact
            .get("validatedAt")
            .and_then(Value::as_str)
            .is_none()
        || artifact.get("dryRunAt").and_then(Value::as_str).is_none()
    {
        return Err(apply_patch_error(
            "dry_run_required",
            "A current successful validation and dry-run are required.",
        ));
    }

    let file_path = artifact
        .get("filePath")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            apply_patch_error(
                "invalid_persisted_record",
                "The persisted artifact path is unavailable.",
            )
        })?
        .to_string();
    validate_apply_target_boundary(&repository_root, &file_path)?;
    let proposed_file = files
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("path").and_then(Value::as_str) == Some(file_path.as_str()))
        })
        .ok_or_else(|| {
            apply_patch_error(
                "file_link_missing",
                "The patch artifact is not linked to a proposed file.",
            )
        })?;
    let operation = proposed_file
        .get("operation")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let proposed_file_path = proposed_file
        .get("path")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let relevant_file_paths: Vec<String> = files
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|file| file.get("path").and_then(Value::as_str))
        .map(str::to_string)
        .collect();
    if relevant_file_paths.is_empty()
        || relevant_file_paths
            .iter()
            .any(|path| !is_safe_relative_git_path(path) || is_forbidden_fingerprint_path(path))
    {
        return Err(apply_patch_error(
            "forbidden_path",
            "A proposed file targets a protected or unsafe repository path.",
        ));
    }

    let raw_diff = artifact
        .get("rawDiff")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            apply_patch_error(
                "patch_content_unavailable",
                "The persisted generated patch content is unavailable.",
            )
        })?;
    let patch_for_git = normalized_patch_text(raw_diff);
    let computed_artifact_digest = sha256_hex(patch_for_git.as_bytes());
    let artifact_digest = artifact.get("artifactDigest").and_then(Value::as_str);
    let validated_artifact_digest = artifact
        .get("validatedArtifactDigest")
        .and_then(Value::as_str);
    if artifact_digest != Some(computed_artifact_digest.as_str())
        || validated_artifact_digest != Some(computed_artifact_digest.as_str())
    {
        return Err(apply_patch_error(
            "stale_artifact",
            "The patch artifact changed after validation. Re-run validation before applying.",
        ));
    }
    let validation_snapshot: RepositoryValidationSnapshot = serde_json::from_value(
        artifact
            .get("validationRepositorySnapshot")
            .cloned()
            .ok_or_else(|| {
                apply_patch_error(
                    "validation_evidence_missing",
                    "Authoritative validation evidence is unavailable.",
                )
            })?,
    )
    .map_err(|_| {
        apply_patch_error(
            "validation_evidence_missing",
            "Authoritative validation evidence is invalid or incomplete.",
        )
    })?;
    if validation_snapshot.repository_id != input.repository_id
        || validation_snapshot.artifact_digest.as_deref() != Some(computed_artifact_digest.as_str())
        || validation_snapshot.repository_snapshot_digest.is_none()
    {
        return Err(apply_patch_error(
            "validation_evidence_mismatch",
            "The persisted validation evidence does not match this artifact.",
        ));
    }

    let validation_input = PatchValidationInput {
        repository_id: input.repository_id.clone(),
        repository_path: canonical_repository_path.clone(),
        file_path: file_path.clone(),
        operation: operation.clone(),
        is_binary: false,
        raw_diff: Some(raw_diff.to_string()),
        artifact_digest: Some(computed_artifact_digest.clone()),
        relevant_file_paths: relevant_file_paths.clone(),
    };
    validate_generated_patch_structure(&validation_input).map_err(|_| {
        apply_patch_error(
            "structure_validation_failed",
            "The persisted patch no longer passes native structure validation.",
        )
    })?;
    let parsed_patch_paths = parsed_unified_diff_paths(raw_diff);

    let current_snapshot = capture_repository_validation_snapshot(
        &input.repository_id,
        &repository_root,
        &canonical_repository_path,
        &computed_artifact_digest,
        &relevant_file_paths,
    )
    .map_err(|_| {
        apply_patch_error(
            "repository_snapshot_unavailable",
            "The repository snapshot could not be refreshed safely.",
        )
    })?;
    if current_snapshot.head_sha.is_none()
        || current_snapshot
            .branch
            .as_deref()
            .is_none_or(|branch| branch.is_empty() || branch.starts_with("detached "))
    {
        return Err(apply_patch_error(
            "branch_unavailable",
            "Safe Patch Application v1 requires a named branch with a current HEAD.",
        ));
    }
    if !current_snapshot.is_clean {
        return Err(apply_patch_error(
            "working_tree_dirty",
            "A clean working tree is required for Safe Patch Application v1.",
        ));
    }
    if current_snapshot.repository_snapshot_digest != validation_snapshot.repository_snapshot_digest
        || current_snapshot.target_file_fingerprints != validation_snapshot.target_file_fingerprints
    {
        return Err(apply_patch_error(
            "stale_repository",
            "Repository state changed after validation. Re-run validation before applying.",
        ));
    }
    let expected_target_fingerprint = current_snapshot
        .target_file_fingerprints
        .iter()
        .find(|fingerprint| fingerprint.path == file_path)
        .ok_or_else(|| {
            apply_patch_error(
                "backup_unavailable",
                "The target-file fingerprint is unavailable. The patch was not applied.",
            )
        })?;
    let expected_target_fingerprint_path = expected_target_fingerprint.path.clone();

    match run_fixed_git_apply(&canonical_repository_path, &patch_for_git, true) {
        FixedGitApplyOutcome::Succeeded => {}
        FixedGitApplyOutcome::Rejected => {
            return Err(apply_patch_error(
                "dry_run_failed",
                "The final native dry-run failed. The patch was not applied.",
            ));
        }
        FixedGitApplyOutcome::TimedOut => {
            return Err(apply_patch_error(
                "dry_run_timeout",
                "The final native dry-run exceeded 15 seconds and was terminated. The patch was not applied.",
            ));
        }
        FixedGitApplyOutcome::Unavailable | FixedGitApplyOutcome::Interrupted => {
            return Err(apply_patch_error(
                "git_unavailable",
                "The final native dry-run could not complete safely. The patch was not applied.",
            ));
        }
    }

    let backup_file = create_apply_backup(
        &repository_root,
        &file_path,
        &operation,
        expected_target_fingerprint,
    )?;
    let backup_path = backup_file.path.clone();
    let final_snapshot = capture_repository_validation_snapshot(
        &input.repository_id,
        &repository_root,
        &canonical_repository_path,
        &computed_artifact_digest,
        &relevant_file_paths,
    )
    .map_err(|_| {
        apply_patch_error(
            "repository_snapshot_unavailable",
            "The final repository snapshot could not be verified.",
        )
    })?;
    if final_snapshot.repository_snapshot_digest != validation_snapshot.repository_snapshot_digest
        || final_snapshot.target_file_fingerprints != validation_snapshot.target_file_fingerprints
    {
        return Err(apply_patch_error(
            "stale_repository",
            "Repository state changed during apply preparation. Re-run validation before applying.",
        ));
    }
    let pre_apply_git_status = load_git_status_summary(
        input.repository_id.clone(),
        canonical_repository_path.clone(),
    );
    let pre_apply_evidence = patch_apply_evidence(
        &computed_artifact_digest,
        Some(final_snapshot.clone()),
        Some(&pre_apply_git_status),
    );
    let pre_apply_evidence_json = serde_json::to_string(&pre_apply_evidence).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Pre-apply safety evidence could not be serialized. The patch was not applied.",
        )
    })?;

    let started_at = now_unix_seconds();
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let backup_id = format!("backup-{}-{unique_suffix}", input.patch_artifact_id);
    let attempt_id = format!("apply-{}-{unique_suffix}", input.patch_artifact_id);
    let backup_files_json = serde_json::to_string(&vec![backup_file]).map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "The target-file backup could not be serialized. The patch was not applied.",
        )
    })?;
    sqlx::query(
        "INSERT INTO patch_apply_backups (id, proposed_change_id, patch_artifact_id, repository_id, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&backup_id)
    .bind(&input.proposed_change_id)
    .bind(&input.patch_artifact_id)
    .bind(&input.repository_id)
    .bind(backup_files_json)
    .bind(&started_at)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "backup_unavailable",
            "The target-file backup could not be persisted. The patch was not applied.",
        )
    })?;
    sqlx::query(
        "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, backup_id, started_at, pre_apply_evidence_json) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
    )
    .bind(&attempt_id)
    .bind(&input.proposed_change_id)
    .bind(&input.patch_artifact_id)
    .bind(&input.approval_request_id)
    .bind(&input.repository_id)
    .bind(&backup_id)
    .bind(&started_at)
    .bind(pre_apply_evidence_json)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The native apply attempt could not be recorded. The patch was not applied.",
        )
    })?;
    set_artifact_apply_metadata(
        &mut artifacts,
        &input.patch_artifact_id,
        "applying",
        Some(&backup_id),
        None,
        None,
        None,
    )?;
    let applying_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The apply state could not be persisted. The patch was not applied.",
        )
    })?;
    let applying_update = sqlx::query(
        "UPDATE proposed_changes SET patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(applying_artifacts_json)
    .bind(&started_at)
    .bind(&input.proposed_change_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The apply state could not be persisted. The patch was not applied.",
        )
    })?;
    if applying_update.rows_affected() != 1 {
        return Err(apply_patch_error(
            "storage_unavailable",
            "The apply state could not be persisted. The patch was not applied.",
        ));
    }
    let attempt_update = sqlx::query(
        "UPDATE patch_apply_attempts SET status = 'applying' WHERE id = ? AND status = 'pending'",
    )
    .bind(&attempt_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The native apply attempt could not be started safely. The patch was not applied.",
        )
    })?;
    if attempt_update.rows_affected() != 1 {
        return Err(apply_patch_error(
            "storage_unavailable",
            "The native apply attempt could not be started safely. The patch was not applied.",
        ));
    }

    let apply_outcome = run_fixed_git_apply(&canonical_repository_path, &patch_for_git, false);
    let apply_failure = apply_failure_details(apply_outcome);
    if let Some((attempt_status, artifact_status, error_code, failure_message)) = apply_failure {
        let completed_at = now_unix_seconds();
        let failed_git_status = load_git_status_summary(
            input.repository_id.clone(),
            canonical_repository_path.clone(),
        );
        let failed_snapshot = capture_repository_validation_snapshot(
            &input.repository_id,
            &repository_root,
            &canonical_repository_path,
            &computed_artifact_digest,
            &relevant_file_paths,
        )
        .ok();
        let failed_evidence = patch_apply_evidence(
            &computed_artifact_digest,
            failed_snapshot,
            Some(&failed_git_status),
        );
        let _ = set_artifact_apply_metadata(
            &mut artifacts,
            &input.patch_artifact_id,
            artifact_status,
            Some(&backup_id),
            None,
            Some(failure_message),
            Some(&failed_git_status),
        );
        if let Ok(failed_artifacts_json) = serde_json::to_string(&artifacts) {
            let _ = sqlx::query(
                "UPDATE proposed_changes SET patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
            )
            .bind(failed_artifacts_json)
            .bind(&completed_at)
            .bind(&input.proposed_change_id)
            .execute(pool)
            .await;
        }
        let post_apply_evidence_json = serde_json::to_string(&failed_evidence).ok();
        let post_apply_status_json =
            serde_json::to_string(&git_status_summary_json(&failed_git_status)).ok();
        let _ = sqlx::query(
            "UPDATE patch_apply_attempts SET status = ?, error_code = ?, sanitized_error = ?, completed_at = ?, post_apply_evidence_json = ?, post_apply_git_status_json = ? WHERE id = ?",
        )
        .bind(attempt_status)
        .bind(error_code)
        .bind(failure_message)
        .bind(&completed_at)
        .bind(post_apply_evidence_json)
        .bind(post_apply_status_json)
        .bind(&attempt_id)
        .execute(pool)
        .await;
        return Err(apply_patch_error(error_code, failure_message));
    }

    let applied_at = now_unix_seconds();
    let post_apply_git_status = load_git_status_summary(
        input.repository_id.clone(),
        canonical_repository_path.clone(),
    );
    let post_apply_verification = verify_post_apply_changed_paths(
        &file_path,
        &proposed_file_path,
        &parsed_patch_paths,
        &backup_path,
        &expected_target_fingerprint_path,
        &post_apply_git_status,
    );
    let is_verified = post_apply_verification.status == "applied_verified";
    let artifact_apply_status = if is_verified {
        "applied_verified"
    } else {
        "quarantine_required"
    };
    let proposal_status = if is_verified {
        "applied"
    } else {
        "quarantine_required"
    };
    let verification_error = (!is_verified).then_some(post_apply_verification.message.as_str());
    set_artifact_apply_metadata(
        &mut artifacts,
        &input.patch_artifact_id,
        artifact_apply_status,
        Some(&backup_id),
        Some(&applied_at),
        verification_error,
        Some(&post_apply_git_status),
    )?;
    set_artifact_post_apply_verification(
        &mut artifacts,
        &input.patch_artifact_id,
        &post_apply_verification,
    )?;
    let applied_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "apply_state_persistence_failed",
            "The patch was applied, but its final local state could not be serialized. Review Changes immediately.",
        )
    })?;
    let persisted_result = sqlx::query(
        "UPDATE proposed_changes SET status = ?, patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(proposal_status)
    .bind(applied_artifacts_json)
    .bind(&applied_at)
    .bind(&input.proposed_change_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "apply_state_persistence_failed",
            "The patch was applied, but its final local state could not be saved. Review Changes immediately.",
        )
    })?;
    if persisted_result.rows_affected() != 1 {
        return Err(apply_patch_error(
            "apply_state_persistence_failed",
            "The patch was applied, but its final local state could not be saved. Review Changes immediately.",
        ));
    }
    let post_apply_status_json =
        serde_json::to_string(&git_status_summary_json(&post_apply_git_status)).ok();
    let post_apply_snapshot = capture_repository_validation_snapshot(
        &input.repository_id,
        &repository_root,
        &canonical_repository_path,
        &computed_artifact_digest,
        &relevant_file_paths,
    )
    .ok();
    let post_apply_evidence = patch_apply_evidence(
        &computed_artifact_digest,
        post_apply_snapshot,
        Some(&post_apply_git_status),
    );
    let post_apply_evidence_json = serde_json::to_string(&post_apply_evidence).ok();
    let post_apply_verification_json = serde_json::to_string(&post_apply_verification).ok();
    let attempt_error_code = (!is_verified).then_some("unexpected_post_apply_paths");
    let _ = sqlx::query(
        "UPDATE patch_apply_attempts SET status = ?, error_code = ?, sanitized_error = ?, completed_at = ?, post_apply_evidence_json = ?, post_apply_git_status_json = ?, post_apply_verification_json = ? WHERE id = ?",
    )
    .bind(artifact_apply_status)
    .bind(attempt_error_code)
    .bind(verification_error)
    .bind(&applied_at)
    .bind(post_apply_evidence_json)
    .bind(post_apply_status_json)
    .bind(post_apply_verification_json)
    .bind(&attempt_id)
    .execute(pool)
    .await;

    Ok(ApplyApprovedPatchArtifactResult {
        status: artifact_apply_status.to_string(),
        apply_attempt_id: attempt_id,
        proposed_change_id: input.proposed_change_id,
        patch_artifact_id: input.patch_artifact_id,
        backup_id,
        applied_at,
        post_apply_git_status,
        post_apply_verification: post_apply_verification.clone(),
        message: post_apply_verification.message,
    })
}

/// User-initiated restore of one `applied_verified` patch from its app-local
/// pre-apply backup.
///
/// Restores **only** from the app-local backup. Never Git: no `reset`,
/// `checkout`, `clean`, `add`, or `commit` appears anywhere in this path.
async fn rollback_applied_patch_artifact_with_pool(
    pool: &SqlitePool,
    lock_directory: &Path,
    input: RollbackAppliedPatchArtifactInput,
) -> Result<RollbackAppliedPatchArtifactResult, ApplyPatchError> {
    #[cfg(test)]
    let _rollback_guard = PATCH_APPLY_LOCK.lock().await;
    #[cfg(not(test))]
    let _rollback_guard = PATCH_APPLY_LOCK.try_lock().map_err(|_| {
        apply_patch_error(
            "apply_locked",
            "Another patch operation is already active in this app process. Nothing was rolled back.",
        )
    })?;

    if input.confirmation_phrase != ROLLBACK_CONFIRMATION_PHRASE {
        return Err(apply_patch_error(
            "confirmation_required",
            "Type ROLL BACK exactly to confirm this working-tree modification.",
        ));
    }
    if [
        &input.repository_id,
        &input.proposed_change_id,
        &input.patch_artifact_id,
    ]
    .iter()
    .any(|id| id.trim().is_empty() || id.len() > 240 || id.contains('\0'))
    {
        return Err(apply_patch_error(
            "invalid_identifier",
            "A durable rollback identifier is invalid.",
        ));
    }

    ensure_patch_apply_tables(pool).await?;
    // Acquired before the `rolling_back` row is inserted: the unresolved-attempt
    // gate lives inside this call, and rollback must not block itself.
    let lock = acquire_repository_apply_lock(
        pool,
        lock_directory,
        &input.repository_id,
        &input.patch_artifact_id,
        "rollback_patch",
    )
    .await?;
    let result = rollback_applied_patch_artifact_under_lock(pool, input).await;
    let _ = release_repository_apply_lock(pool, &lock).await;
    result
}

async fn rollback_applied_patch_artifact_under_lock(
    pool: &SqlitePool,
    input: RollbackAppliedPatchArtifactInput,
) -> Result<RollbackAppliedPatchArtifactResult, ApplyPatchError> {
    let repository_row =
        sqlx::query("SELECT path, is_git_repository FROM repositories WHERE id = ? LIMIT 1")
            .bind(&input.repository_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| {
                apply_patch_error(
                    "storage_unavailable",
                    "The saved repository record could not be verified.",
                )
            })?
            .ok_or_else(|| {
                apply_patch_error(
                    "repository_unavailable",
                    "The selected saved repository is unavailable.",
                )
            })?;
    let repository_path: String = repository_row.try_get("path").map_err(|_| {
        apply_patch_error(
            "repository_unavailable",
            "The selected saved repository is unavailable.",
        )
    })?;
    if repository_row
        .try_get::<i64, _>("is_git_repository")
        .unwrap_or(0)
        != 1
    {
        return Err(apply_patch_error(
            "repository_unavailable",
            "Rollback requires a saved Git repository.",
        ));
    }
    let (repository_root, canonical_repository_path) =
        canonical_selected_git_root(&repository_path).map_err(|_| {
            apply_patch_error(
                "repository_unavailable",
                "The saved repository root could not be verified.",
            )
        })?;

    let proposal_row = sqlx::query(
        "SELECT approval_request_id, repository_id, files_json, patch_artifacts_json FROM proposed_changes WHERE id = ? LIMIT 1",
    )
    .bind(&input.proposed_change_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The persisted proposed change could not be verified.",
        )
    })?
    .ok_or_else(|| {
        apply_patch_error(
            "proposal_not_found",
            "The persisted proposed change is unavailable.",
        )
    })?;
    let linked_approval_id: Option<String> =
        proposal_row.try_get("approval_request_id").unwrap_or(None);
    let proposal_repository_id: String = proposal_row.try_get("repository_id").unwrap_or_default();
    let files_json: String = proposal_row.try_get("files_json").unwrap_or_default();
    let patch_artifacts_json: String = proposal_row
        .try_get("patch_artifacts_json")
        .unwrap_or_default();
    if proposal_repository_id != input.repository_id {
        return Err(apply_patch_error(
            "link_mismatch",
            "The repository and proposal records are not durably linked.",
        ));
    }

    let files: Value = serde_json::from_str(&files_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The proposed file records are invalid.",
        )
    })?;
    let mut artifacts: Value = serde_json::from_str(&patch_artifacts_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The persisted patch artifact records are invalid.",
        )
    })?;
    let artifact = artifacts
        .as_array()
        .and_then(|items| {
            items.iter().find(|item| {
                item.get("id").and_then(Value::as_str) == Some(input.patch_artifact_id.as_str())
            })
        })
        .cloned()
        .ok_or_else(|| {
            apply_patch_error(
                "artifact_not_found",
                "The persisted patch artifact is unavailable.",
            )
        })?;
    if artifact.get("proposedChangeId").and_then(Value::as_str)
        != Some(input.proposed_change_id.as_str())
    {
        return Err(apply_patch_error(
            "link_mismatch",
            "The patch artifact is not linked to the proposed change.",
        ));
    }

    // `applied_verified` is the only state where expected == observed and exactly
    // one path is known to have changed. Everything else is refused, including
    // `quarantine_required`: a quarantined apply wrote paths we cannot account
    // for and have no backup for, so restoring the declared target would undo the
    // accountable half and leave the rest — a partial undo reported as a rollback
    // is the false account this product exists to prevent. `rolled_back` is
    // refused here too, which is the first of two independent bars on a second
    // rollback.
    let apply_status = artifact
        .get("applyStatus")
        .and_then(Value::as_str)
        .unwrap_or("not_applied");
    if apply_status != "applied_verified" {
        return Err(apply_patch_error(
            "not_applied_verified",
            "Only a patch whose application was verified against its exact approved path can be rolled back.",
        ));
    }

    let file_path = artifact
        .get("filePath")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            apply_patch_error(
                "invalid_persisted_record",
                "The persisted artifact path is unavailable.",
            )
        })?
        .to_string();
    validate_apply_target_boundary(&repository_root, &file_path)?;
    let artifact_digest = artifact
        .get("artifactDigest")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let operation = files
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("path").and_then(Value::as_str) == Some(file_path.as_str()))
        })
        .and_then(|file| file.get("operation").and_then(Value::as_str))
        .ok_or_else(|| {
            apply_patch_error(
                "file_link_missing",
                "The patch artifact is not linked to a proposed file.",
            )
        })?
        .to_string();

    // The baseline: what the target looked like immediately after apply.
    //
    // Apply captures this best-effort — the snapshot is `.ok()` and the persist
    // is fire-and-forget — so an artifact can be `applied_verified` with no
    // baseline at all. That is not an edge case to paper over: with no record of
    // what apply left behind, no drift check is possible, and rollback's entire
    // safety rule is "do not overwrite user edits made after apply". Refuse.
    let attempt_rows = sqlx::query(
        "SELECT id, backup_id, post_apply_evidence_json FROM patch_apply_attempts WHERE repository_id = ? AND proposed_change_id = ? AND patch_artifact_id = ? AND status = 'applied_verified'",
    )
    .bind(&input.repository_id)
    .bind(&input.proposed_change_id)
    .bind(&input.patch_artifact_id)
    .fetch_all(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The verified apply attempt could not be loaded.",
        )
    })?;
    if attempt_rows.len() != 1 {
        return Err(apply_patch_error(
            "baseline_unavailable",
            "Exactly one verified application attempt is required to roll back, and it is unavailable. This patch cannot be rolled back.",
        ));
    }
    let apply_attempt_row = &attempt_rows[0];
    let apply_backup_id: String = apply_attempt_row
        .try_get::<Option<String>, _>("backup_id")
        .unwrap_or(None)
        .ok_or_else(|| {
            apply_patch_error(
                "backup_unavailable",
                "The pre-apply backup reference is unavailable. This patch cannot be rolled back.",
            )
        })?;
    let baseline_snapshot = apply_attempt_row
        .try_get::<Option<String>, _>("post_apply_evidence_json")
        .unwrap_or(None)
        .and_then(|value| serde_json::from_str::<PatchApplyEvidence>(&value).ok())
        .and_then(|evidence| evidence.repository_snapshot)
        .ok_or_else(|| {
            apply_patch_error(
                "baseline_unavailable",
                "No post-apply baseline was recorded for this patch, so drift since the apply cannot be ruled out. This patch cannot be rolled back.",
            )
        })?;
    let baseline_branch = baseline_snapshot
        .branch
        .as_deref()
        .filter(|branch| !branch.is_empty())
        .ok_or_else(|| {
            apply_patch_error(
                "baseline_unavailable",
                "The post-apply baseline has no recorded branch. This patch cannot be rolled back.",
            )
        })?
        .to_string();
    let baseline_head_sha = baseline_snapshot
        .head_sha
        .as_deref()
        .filter(|head| !head.is_empty())
        .ok_or_else(|| {
            apply_patch_error(
                "baseline_unavailable",
                "The post-apply baseline has no recorded HEAD. This patch cannot be rolled back.",
            )
        })?
        .to_string();
    // Only a `captured` fingerprint carries a content hash. A target that was
    // already oversized or non-UTF-8 when apply finished has no baseline hash,
    // which resolves here rather than at the backup: no baseline, no rollback.
    let baseline_target_sha256 = baseline_snapshot
        .target_file_fingerprints
        .iter()
        .find(|fingerprint| fingerprint.path == file_path)
        .filter(|fingerprint| fingerprint.status == "captured")
        .and_then(|fingerprint| fingerprint.content_sha256.clone())
        .ok_or_else(|| {
            apply_patch_error(
                "baseline_unavailable",
                "The post-apply baseline has no content hash for the target file, so drift since the apply cannot be ruled out. This patch cannot be rolled back.",
            )
        })?;

    // The pre-apply backup: the bytes rollback restores *from*. Verified, not
    // trusted — a corrupt backup must never be written over a real file.
    let backup_row = sqlx::query("SELECT files_json FROM patch_apply_backups WHERE id = ? LIMIT 1")
        .bind(&apply_backup_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The pre-apply backup could not be loaded.",
            )
        })?
        .ok_or_else(|| {
            apply_patch_error(
                "backup_unavailable",
                "The pre-apply backup record is unavailable. This patch cannot be rolled back.",
            )
        })?;
    let backup_files: Vec<ApplyPatchBackupFile> = serde_json::from_str(
        &backup_row
            .try_get::<String, _>("files_json")
            .unwrap_or_default(),
    )
    .map_err(|_| {
        apply_patch_error(
            "backup_corrupt",
            "The pre-apply backup record is unreadable. This patch cannot be rolled back.",
        )
    })?;
    let backup_file = backup_files
        .into_iter()
        .find(|file| file.path == file_path)
        .ok_or_else(|| {
            apply_patch_error(
                "backup_unavailable",
                "The pre-apply backup does not cover the target file. This patch cannot be rolled back.",
            )
        })?;
    let expected_existed_before_apply = operation != "create";
    if backup_file.existed_before_apply != expected_existed_before_apply {
        return Err(apply_patch_error(
            "backup_corrupt",
            "The pre-apply backup disagrees with the recorded operation. This patch cannot be rolled back.",
        ));
    }
    let restored_content_sha256 = if backup_file.existed_before_apply {
        let content = backup_file.content.as_deref().ok_or_else(|| {
            apply_patch_error(
                "backup_corrupt",
                "The pre-apply backup stored no content for an existing file. This patch cannot be rolled back.",
            )
        })?;
        let stored_hash = backup_file.content_sha256.as_deref().ok_or_else(|| {
            apply_patch_error(
                "backup_corrupt",
                "The pre-apply backup stored no content hash. This patch cannot be rolled back.",
            )
        })?;
        if sha256_hex(content.as_bytes()) != stored_hash {
            return Err(apply_patch_error(
                "backup_corrupt",
                "The pre-apply backup failed its integrity check. It will not be written over the current file.",
            ));
        }
        Some(stored_hash.to_string())
    } else {
        if backup_file.content.is_some() || backup_file.content_sha256.is_some() {
            return Err(apply_patch_error(
                "backup_corrupt",
                "The pre-apply backup records content for a file that did not exist. This patch cannot be rolled back.",
            ));
        }
        None
    };

    let pre_restore_git_status = load_git_status_summary(
        input.repository_id.clone(),
        canonical_repository_path.clone(),
    );
    if !pre_restore_git_status.is_git_repository {
        return Err(apply_patch_error(
            "repository_unavailable",
            "The repository Git state could not be read. Nothing was rolled back.",
        ));
    }
    // A dropped status line means the observed path set is incomplete, and an
    // incomplete set cannot prove anything after the write either.
    if pre_restore_git_status.changed_file_count != pre_restore_git_status.files.len() {
        return Err(apply_patch_error(
            "repository_state_unverifiable",
            "The current Git status could not be read as a complete set of paths. Nothing was rolled back.",
        ));
    }
    let Some((pre_restore_changed_paths, pre_restore_staged_paths)) =
        rollback_status_path_sets(&pre_restore_git_status)
    else {
        return Err(apply_patch_error(
            "repository_state_unverifiable",
            "The current Git status contains a path that cannot be safely compared. Nothing was rolled back.",
        ));
    };

    // If the user committed the applied change, the apply is now history and
    // writing pre-apply bytes is not an undo — it is a new modification, and the
    // post-restore expectation collapses: the restored file would differ from the
    // new HEAD rather than match it.
    if pre_restore_git_status.head_sha.as_deref() != Some(baseline_head_sha.as_str()) {
        return Err(apply_patch_error(
            "head_changed",
            "The repository HEAD moved after this patch was applied. Rollback would be a new modification rather than an undo.",
        ));
    }
    if pre_restore_git_status.branch.as_deref() != Some(baseline_branch.as_str()) {
        return Err(apply_patch_error(
            "branch_changed",
            "The branch changed after this patch was applied. Nothing was rolled back.",
        ));
    }
    // Staging does not alter content, so the drift check would pass — but we never
    // touch the index, and restoring under a staged entry would leave the index
    // and working tree disagreeing. This falls out of the existing rule rather
    // than being a new policy.
    if pre_restore_git_status.files.iter().any(|file| {
        (file.path == file_path || file.old_path.as_deref() == Some(file_path.as_str()))
            && (file.stage == "staged" || file.stage == "both")
    }) {
        return Err(apply_patch_error(
            "target_staged",
            "The target file is staged. Unstage it before rolling back; rollback never touches the Git index.",
        ));
    }

    // Drift. This read is also the pre-rollback backup's content, and it happens
    // immediately before the write to narrow — not close — the window recorded
    // under roadmap #12.
    //
    // A target deleted since the apply needs no branch of its own: the capture
    // refuses `target_missing`, and refusing is right on the merits. A deletion
    // *is* a user edit, restoring resurrects a file they deliberately removed,
    // and we cannot distinguish "the user deleted it" from "something else did".
    let target_capture = capture_rollback_target(&repository_root, &file_path)?;
    if target_capture.content_sha256 != baseline_target_sha256 {
        return Err(apply_patch_error(
            "target_drifted",
            "The target file changed after this patch was applied. Rollback will not overwrite work done since the apply.",
        ));
    }

    let started_at = now_unix_seconds();
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let rollback_attempt_id = format!("rollback-{}-{unique_suffix}", input.patch_artifact_id);
    let rollback_backup_id = format!(
        "rollback-backup-{}-{unique_suffix}",
        input.patch_artifact_id
    );
    let pre_restore_evidence = patch_apply_evidence(
        &artifact_digest,
        Some(baseline_snapshot.clone()),
        Some(&pre_restore_git_status),
    );
    let pre_restore_evidence_json = serde_json::to_string(&pre_restore_evidence).ok();
    let approval_request_id = linked_approval_id.unwrap_or_default();

    // Write ordering INVERTS apply's, deliberately.
    //
    //   apply:    backup insert -> attempt row -> write
    //   rollback: attempt row (rolling_back) -> backup insert -> write
    //
    // Apply can insert its backup first because that backup is the pre-image it
    // restores from: an orphaned apply-backup row is inert. Rollback's backup
    // records the bytes it is about to *destroy*, so the "we started" marker must
    // land first. Were the backup inserted first and the process died, there
    // would be a backup row with no attempt — invisible to reconciliation, with a
    // write about to begin and no durable record that it started.
    //
    // Accepted consequence: a kill between these two inserts reconciles to
    // `quarantine_required` even though nothing was written. Over-quarantining
    // there is correct; the alternative is a write with no record that it began.
    //
    // This reads as an inconsistency with apply. It is not. Do not "fix" it.
    sqlx::query(
        "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, backup_id, rollback_backup_id, started_at, pre_apply_evidence_json) VALUES (?, ?, ?, ?, ?, 'rolling_back', ?, ?, ?, ?)",
    )
    .bind(&rollback_attempt_id)
    .bind(&input.proposed_change_id)
    .bind(&input.patch_artifact_id)
    .bind(&approval_request_id)
    .bind(&input.repository_id)
    .bind(&apply_backup_id)
    .bind(&rollback_backup_id)
    .bind(&started_at)
    .bind(pre_restore_evidence_json)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The native rollback attempt could not be recorded. Nothing was rolled back.",
        )
    })?;
    set_artifact_rollback_metadata(
        &mut artifacts,
        &input.patch_artifact_id,
        "rolling_back",
        Some(&rollback_backup_id),
        None,
        None,
        None,
        None,
    )?;
    let rolling_back_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The rollback state could not be persisted. Nothing was rolled back.",
        )
    })?;
    sqlx::query(
        "UPDATE proposed_changes SET patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(rolling_back_artifacts_json)
    .bind(&started_at)
    .bind(&input.proposed_change_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The rollback state could not be persisted. Nothing was rolled back.",
        )
    })?;

    let rollback_backup_files_json = serde_json::to_string(&vec![ApplyPatchBackupFile {
        path: file_path.clone(),
        existed_before_apply: true,
        content_sha256: Some(target_capture.content_sha256.clone()),
        content: Some(target_capture.content.clone()),
    }])
    .map_err(|_| {
        apply_patch_error(
            "rollback_backup_unavailable",
            "The pre-rollback backup could not be serialized. Nothing was rolled back.",
        )
    })?;
    sqlx::query(
        "INSERT INTO patch_rollback_backups (id, rollback_attempt_id, proposed_change_id, patch_artifact_id, repository_id, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&rollback_backup_id)
    .bind(&rollback_attempt_id)
    .bind(&input.proposed_change_id)
    .bind(&input.patch_artifact_id)
    .bind(&input.repository_id)
    .bind(rollback_backup_files_json)
    .bind(&started_at)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "rollback_backup_unavailable",
            "The pre-rollback backup could not be persisted. Nothing was rolled back.",
        )
    })?;

    // The write. Its result is deliberately not branched on: verification below is
    // authoritative, because the rule is "verify what was restored, do not trust
    // that the copy succeeded". A failed write and a silently-wrong write must
    // reach the same place.
    let target_path = repository_root.join(&file_path);
    let _write_outcome = if operation == "create" {
        fs::remove_file(&target_path)
    } else {
        fs::write(
            &target_path,
            backup_file.content.as_deref().unwrap_or_default(),
        )
    };

    let rolled_back_at = now_unix_seconds();
    let post_rollback_git_status = load_git_status_summary(
        input.repository_id.clone(),
        canonical_repository_path.clone(),
    );
    let verification = verify_post_rollback_state(
        &file_path,
        &operation,
        &repository_root,
        restored_content_sha256.as_deref(),
        &pre_restore_changed_paths,
        &pre_restore_staged_paths,
        Some(baseline_head_sha.as_str()),
        &post_rollback_git_status,
    );
    let is_rolled_back = verification.status == "rolled_back";
    let final_status = if is_rolled_back {
        "rolled_back"
    } else {
        "quarantine_required"
    };
    let rollback_error = (!is_rolled_back).then_some(verification.message.as_str());

    set_artifact_rollback_metadata(
        &mut artifacts,
        &input.patch_artifact_id,
        final_status,
        Some(&rollback_backup_id),
        Some(&rolled_back_at),
        rollback_error,
        Some(&verification),
        Some(&post_rollback_git_status),
    )?;
    let final_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "rollback_state_persistence_failed",
            "The rollback ran, but its final local state could not be serialized. Review Changes immediately.",
        )
    })?;
    // The proposal moves too. Leaving it `applied` after its only artifact was
    // rolled back would render a lie on the product's most honest surface.
    let persisted = sqlx::query(
        "UPDATE proposed_changes SET status = ?, patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(final_status)
    .bind(final_artifacts_json)
    .bind(&rolled_back_at)
    .bind(&input.proposed_change_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "rollback_state_persistence_failed",
            "The rollback ran, but its final local state could not be saved. Review Changes immediately.",
        )
    })?;
    if persisted.rows_affected() != 1 {
        return Err(apply_patch_error(
            "rollback_state_persistence_failed",
            "The rollback ran, but its final local state could not be saved. Review Changes immediately.",
        ));
    }
    let post_rollback_status_json =
        serde_json::to_string(&git_status_summary_json(&post_rollback_git_status)).ok();
    let post_rollback_evidence_json = serde_json::to_string(&patch_apply_evidence(
        &artifact_digest,
        None,
        Some(&post_rollback_git_status),
    ))
    .ok();
    let verification_json = serde_json::to_string(&verification).ok();
    let _ = sqlx::query(
        "UPDATE patch_apply_attempts SET status = ?, error_code = ?, sanitized_error = ?, completed_at = ?, post_apply_evidence_json = ?, post_apply_git_status_json = ?, post_rollback_verification_json = ? WHERE id = ?",
    )
    .bind(final_status)
    .bind((!is_rolled_back).then_some("unexpected_post_rollback_state"))
    .bind(rollback_error)
    .bind(&rolled_back_at)
    .bind(post_rollback_evidence_json)
    .bind(post_rollback_status_json)
    .bind(verification_json)
    .bind(&rollback_attempt_id)
    .execute(pool)
    .await;

    Ok(RollbackAppliedPatchArtifactResult {
        status: final_status.to_string(),
        rollback_attempt_id,
        proposed_change_id: input.proposed_change_id,
        patch_artifact_id: input.patch_artifact_id,
        rollback_backup_id,
        rolled_back_at,
        post_rollback_git_status,
        message: verification.message.clone(),
        post_rollback_verification: verification,
    })
}

fn apply_attempt_message(status: &str) -> String {
    match status {
        "applied" => "Reconciliation found clear evidence that the expected patch was applied. No patch was re-applied.".to_string(),
        "applied_verified" => "Authoritative post-apply verification confirmed that only the approved artifact path changed.".to_string(),
        "rolling_back" => "A rollback of this patch is in progress. No further patch operation can run for this repository until it resolves.".to_string(),
        "rolled_back" => "The applied patch was rolled back from its app-local pre-apply backup, and post-restore verification confirmed the result. Git history was not touched.".to_string(),
        "quarantine_required" => "Post-apply verification found unexpected, missing, or inconsistent changed-path evidence. Manual inspection is required.".to_string(),
        "failed" => "The interrupted attempt did not change the working tree and was not retried.".to_string(),
        "interrupted" => "The apply process stopped before complete recovery evidence was available. Manual inspection is required.".to_string(),
        "needs_inspection" => "Repository evidence is ambiguous after an interrupted apply. Manual inspection is required.".to_string(),
        "inspected" => "A human recorded that this attempt was inspected manually. Its artifact remains ineligible for application, and no patch was retried or rolled back.".to_string(),
        "pending" => "The patch apply attempt was recorded but has not started writing files.".to_string(),
        "applying" => "The patch apply attempt has not recorded a terminal result.".to_string(),
        _ => "The patch apply attempt has a recorded terminal state.".to_string(),
    }
}

async fn persist_reconciled_attempt(
    pool: &SqlitePool,
    attempt_id: &str,
    status: &str,
    sanitized_error: Option<&str>,
    post_apply_evidence: Option<&PatchApplyEvidence>,
    post_apply_git_status: Option<&GitStatusSummary>,
) -> Result<(), ApplyPatchError> {
    let completed_at = now_unix_seconds();
    let post_evidence_json =
        post_apply_evidence.and_then(|evidence| serde_json::to_string(evidence).ok());
    let post_status_json = post_apply_git_status
        .and_then(|summary| serde_json::to_string(&git_status_summary_json(summary)).ok());
    sqlx::query(
        "UPDATE patch_apply_attempts SET status = ?, error_code = ?, sanitized_error = ?, completed_at = ?, post_apply_evidence_json = ?, post_apply_git_status_json = ? WHERE id = ?",
    )
    .bind(status)
    .bind(if sanitized_error.is_some() {
        Some(status)
    } else {
        None
    })
    .bind(sanitized_error)
    .bind(completed_at)
    .bind(post_evidence_json)
    .bind(post_status_json)
    .bind(attempt_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Interrupted apply state could not be reconciled safely.",
        )
    })?;
    Ok(())
}

async fn persist_reconciled_artifact(
    pool: &SqlitePool,
    proposal_id: &str,
    artifact_id: &str,
    status: &str,
    backup_id: Option<&str>,
    message: Option<&str>,
    post_apply_git_status: Option<&GitStatusSummary>,
) -> Result<(), ApplyPatchError> {
    let row = sqlx::query("SELECT patch_artifacts_json FROM proposed_changes WHERE id = ? LIMIT 1")
        .bind(proposal_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The interrupted proposal state could not be loaded.",
            )
        })?
        .ok_or_else(|| {
            apply_patch_error(
                "proposal_not_found",
                "The interrupted proposal record is unavailable.",
            )
        })?;
    let artifacts_json: String = row.try_get("patch_artifacts_json").unwrap_or_default();
    let mut artifacts: Value = serde_json::from_str(&artifacts_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The interrupted patch artifact record is invalid.",
        )
    })?;
    let completed_at = now_unix_seconds();
    set_artifact_apply_metadata(
        &mut artifacts,
        artifact_id,
        status,
        backup_id,
        matches!(
            status,
            "applied" | "applied_verified" | "quarantine_required"
        )
        .then_some(completed_at.as_str()),
        message,
        post_apply_git_status,
    )?;
    let next_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The reconciled patch artifact state could not be serialized.",
        )
    })?;
    let proposal_status = match status {
        "applied" | "applied_verified" => Some("applied"),
        "quarantine_required" => Some("quarantine_required"),
        _ => None,
    };
    if let Some(proposal_status) = proposal_status {
        sqlx::query(
            "UPDATE proposed_changes SET status = ?, patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
        )
        .bind(proposal_status)
        .bind(next_artifacts_json)
        .bind(&completed_at)
        .bind(proposal_id)
        .execute(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The reconciled applied state could not be persisted.",
            )
        })?;
    } else {
        sqlx::query(
            "UPDATE proposed_changes SET patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
        )
        .bind(next_artifacts_json)
        .bind(&completed_at)
        .bind(proposal_id)
        .execute(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The reconciled interrupted state could not be persisted.",
            )
        })?;
    }
    Ok(())
}

async fn persist_reconciled_post_apply_verification(
    pool: &SqlitePool,
    proposal_id: &str,
    artifact_id: &str,
    attempt_id: &str,
    verification: &PostApplyPathVerification,
) -> Result<(), ApplyPatchError> {
    let row = sqlx::query("SELECT patch_artifacts_json FROM proposed_changes WHERE id = ? LIMIT 1")
        .bind(proposal_id)
        .fetch_one(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The reconciled post-apply verification could not be loaded.",
            )
        })?;
    let artifacts_json: String = row.try_get("patch_artifacts_json").unwrap_or_default();
    let mut artifacts: Value = serde_json::from_str(&artifacts_json).map_err(|_| {
        apply_patch_error(
            "invalid_persisted_record",
            "The reconciled patch artifact record is invalid.",
        )
    })?;
    set_artifact_post_apply_verification(&mut artifacts, artifact_id, verification)?;
    let next_artifacts_json = serde_json::to_string(&artifacts).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The reconciled post-apply verification could not be serialized.",
        )
    })?;
    let verification_json = serde_json::to_string(verification).map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The reconciled post-apply verification could not be serialized.",
        )
    })?;
    sqlx::query(
        "UPDATE proposed_changes SET patch_artifacts_json = ?, updated_at = ? WHERE id = ?",
    )
    .bind(next_artifacts_json)
    .bind(&verification.verified_at)
    .bind(proposal_id)
    .execute(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The reconciled post-apply verification could not be persisted.",
        )
    })?;
    sqlx::query("UPDATE patch_apply_attempts SET post_apply_verification_json = ? WHERE id = ?")
        .bind(verification_json)
        .bind(attempt_id)
        .execute(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The reconciled attempt verification could not be persisted.",
            )
        })?;
    Ok(())
}

async fn classify_unfinished_apply_attempt(
    pool: &SqlitePool,
    row: &sqlx::sqlite::SqliteRow,
) -> Result<(), ApplyPatchError> {
    let attempt_id: String = row.try_get("id").unwrap_or_default();
    let proposal_id: String = row.try_get("proposed_change_id").unwrap_or_default();
    let artifact_id: String = row.try_get("patch_artifact_id").unwrap_or_default();
    let repository_id: String = row.try_get("repository_id").unwrap_or_default();
    let backup_id: Option<String> = row.try_get("backup_id").unwrap_or(None);
    let pre_evidence_json: Option<String> = row.try_get("pre_apply_evidence_json").unwrap_or(None);
    let attempt_status: String = row.try_get("status").unwrap_or_default();

    // An interrupted rollback is undeterminable by definition, so it reconciles
    // straight to quarantine with no probe, no retry, and no re-restore.
    //
    // The probes below cannot help here: forward and reverse `git apply --check`
    // speak about the patch, and say nothing about whether a *file restore*
    // completed. Nothing distinguishes "backup written, restore not started" from
    // "restore half-written". Rather than invent a probe whose evidence cannot be
    // justified, this fails closed.
    //
    // The exit already exists: `INSPECTED` clears the repository-wide block while
    // the artifact stays permanently ineligible.
    if attempt_status == "rolling_back" {
        let message = "A rollback stopped before it could prove what it wrote. The target file's contents cannot be determined from the available evidence. Manual inspection is required; nothing was retried or restored.";
        persist_reconciled_attempt(
            pool,
            &attempt_id,
            "quarantine_required",
            Some(message),
            None,
            None,
        )
        .await?;
        persist_reconciled_artifact(
            pool,
            &proposal_id,
            &artifact_id,
            "quarantine_required",
            backup_id.as_deref(),
            Some(message),
            None,
        )
        .await?;
        return Ok(());
    }

    let proposal_row = sqlx::query(
        "SELECT files_json, patch_artifacts_json FROM proposed_changes WHERE id = ? LIMIT 1",
    )
    .bind(&proposal_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "The interrupted proposal could not be inspected.",
        )
    })?;
    let Some(proposal_row) = proposal_row else {
        let message = apply_attempt_message("interrupted");
        return persist_reconciled_attempt(
            pool,
            &attempt_id,
            "interrupted",
            Some(&message),
            None,
            None,
        )
        .await;
    };
    let files_json: String = proposal_row.try_get("files_json").unwrap_or_default();
    let artifacts_json: String = proposal_row
        .try_get("patch_artifacts_json")
        .unwrap_or_default();
    let files: Value = match serde_json::from_str(&files_json) {
        Ok(files) => files,
        Err(_) => {
            let message = apply_attempt_message("needs_inspection");
            return persist_reconciled_attempt(
                pool,
                &attempt_id,
                "needs_inspection",
                Some(&message),
                None,
                None,
            )
            .await;
        }
    };
    let artifacts: Value = match serde_json::from_str(&artifacts_json) {
        Ok(artifacts) => artifacts,
        Err(_) => {
            let message = apply_attempt_message("needs_inspection");
            return persist_reconciled_attempt(
                pool,
                &attempt_id,
                "needs_inspection",
                Some(&message),
                None,
                None,
            )
            .await;
        }
    };
    let Some(artifact) = artifacts.as_array().and_then(|items| {
        items
            .iter()
            .find(|item| item.get("id").and_then(Value::as_str) == Some(artifact_id.as_str()))
    }) else {
        let message = apply_attempt_message("interrupted");
        return persist_reconciled_attempt(
            pool,
            &attempt_id,
            "interrupted",
            Some(&message),
            None,
            None,
        )
        .await;
    };
    let file_path = artifact
        .get("filePath")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let raw_diff = artifact
        .get("rawDiff")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let operation = files
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|file| file.get("path").and_then(Value::as_str) == Some(file_path))
        })
        .and_then(|file| file.get("operation"))
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let artifact_digest = sha256_hex(normalized_patch_text(raw_diff).as_bytes());

    let repository_row = sqlx::query("SELECT path FROM repositories WHERE id = ? LIMIT 1")
        .bind(&repository_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "The interrupted repository could not be inspected.",
            )
        })?;
    let pre_evidence = pre_evidence_json
        .as_deref()
        .and_then(|value| serde_json::from_str::<PatchApplyEvidence>(value).ok());
    let backup_path = if let Some(backup_id) = backup_id.as_deref() {
        sqlx::query(
            "SELECT files_json FROM patch_apply_backups WHERE id = ? AND proposed_change_id = ? AND patch_artifact_id = ? AND repository_id = ? LIMIT 1",
        )
        .bind(backup_id)
        .bind(&proposal_id)
        .bind(&artifact_id)
        .bind(&repository_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            apply_patch_error(
                "storage_unavailable",
                "Interrupted apply backup evidence could not be inspected.",
            )
        })?
        .and_then(|row| row.try_get::<String, _>("files_json").ok())
        .and_then(|files_json| serde_json::from_str::<Value>(&files_json).ok())
        .and_then(|files| {
            files
                .as_array()
                .and_then(|items| items.first())
                .and_then(|file| file.get("path"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
    } else {
        None
    };

    let (pre_evidence, repository_row, backup_path) =
        match (pre_evidence, repository_row, backup_path) {
            (Some(pre_evidence), Some(repository_row), Some(backup_path)) => {
                (pre_evidence, repository_row, backup_path)
            }
            _ => {
                let message = apply_attempt_message("interrupted");
                persist_reconciled_artifact(
                    pool,
                    &proposal_id,
                    &artifact_id,
                    "interrupted",
                    backup_id.as_deref(),
                    Some(&message),
                    None,
                )
                .await?;
                return persist_reconciled_attempt(
                    pool,
                    &attempt_id,
                    "interrupted",
                    Some(&message),
                    None,
                    None,
                )
                .await;
            }
        };
    if raw_diff.is_empty()
        || !is_safe_relative_git_path(file_path)
        || is_forbidden_fingerprint_path(file_path)
        || pre_evidence.artifact_digest != artifact_digest
    {
        let message = apply_attempt_message("needs_inspection");
        persist_reconciled_artifact(
            pool,
            &proposal_id,
            &artifact_id,
            "needs_inspection",
            backup_id.as_deref(),
            Some(&message),
            None,
        )
        .await?;
        return persist_reconciled_attempt(
            pool,
            &attempt_id,
            "needs_inspection",
            Some(&message),
            None,
            None,
        )
        .await;
    }

    let Some(pre_snapshot) = pre_evidence.repository_snapshot.as_ref() else {
        let message = apply_attempt_message("interrupted");
        persist_reconciled_artifact(
            pool,
            &proposal_id,
            &artifact_id,
            "interrupted",
            backup_id.as_deref(),
            Some(&message),
            None,
        )
        .await?;
        return persist_reconciled_attempt(
            pool,
            &attempt_id,
            "interrupted",
            Some(&message),
            None,
            None,
        )
        .await;
    };
    let repository_path: String = repository_row.try_get("path").unwrap_or_default();
    let (repository_root, canonical_repository_path) =
        match canonical_selected_git_root(&repository_path) {
            Ok(repository) => repository,
            Err(_) => {
                let message = apply_attempt_message("needs_inspection");
                persist_reconciled_artifact(
                    pool,
                    &proposal_id,
                    &artifact_id,
                    "needs_inspection",
                    backup_id.as_deref(),
                    Some(&message),
                    None,
                )
                .await?;
                return persist_reconciled_attempt(
                    pool,
                    &attempt_id,
                    "needs_inspection",
                    Some(&message),
                    None,
                    None,
                )
                .await;
            }
        };
    let current_status =
        load_git_status_summary(repository_id.clone(), canonical_repository_path.clone());
    let relevant_paths = pre_snapshot.relevant_file_paths.clone();
    let current_snapshot = capture_repository_validation_snapshot(
        &repository_id,
        &repository_root,
        &canonical_repository_path,
        &artifact_digest,
        &relevant_paths,
    )
    .ok();
    let post_evidence = patch_apply_evidence(
        &artifact_digest,
        current_snapshot.clone(),
        Some(&current_status),
    );
    let reconciliation_validation_input = PatchValidationInput {
        repository_id: repository_id.clone(),
        repository_path: canonical_repository_path.clone(),
        file_path: file_path.to_string(),
        operation: operation.to_string(),
        is_binary: false,
        raw_diff: Some(raw_diff.to_string()),
        artifact_digest: Some(artifact_digest.clone()),
        relevant_file_paths: relevant_paths.clone(),
    };
    if validate_generated_patch_structure(&reconciliation_validation_input).is_err() {
        let message = apply_attempt_message("needs_inspection");
        persist_reconciled_artifact(
            pool,
            &proposal_id,
            &artifact_id,
            "needs_inspection",
            backup_id.as_deref(),
            Some(&message),
            None,
        )
        .await?;
        return persist_reconciled_attempt(
            pool,
            &attempt_id,
            "needs_inspection",
            Some(&message),
            Some(&post_evidence),
            Some(&current_status),
        )
        .await;
    }
    let fingerprints_match = current_snapshot.as_ref().is_some_and(|snapshot| {
        snapshot.target_file_fingerprints == pre_snapshot.target_file_fingerprints
    });
    let git_status_changed = git_status_changed_from_evidence(&pre_evidence, &current_status);
    let patch_for_git = normalized_patch_text(raw_diff);
    let forward_check = match run_fixed_git_apply(&canonical_repository_path, &patch_for_git, true)
    {
        FixedGitApplyOutcome::Succeeded => Some(true),
        FixedGitApplyOutcome::Rejected => Some(false),
        FixedGitApplyOutcome::TimedOut
        | FixedGitApplyOutcome::Unavailable
        | FixedGitApplyOutcome::Interrupted => None,
    };
    let reverse_check =
        match run_fixed_git_reverse_check(&canonical_repository_path, &patch_for_git) {
            FixedGitApplyOutcome::Succeeded => Some(true),
            FixedGitApplyOutcome::Rejected => Some(false),
            FixedGitApplyOutcome::TimedOut
            | FixedGitApplyOutcome::Unavailable
            | FixedGitApplyOutcome::Interrupted => None,
        };
    let target_changed = current_status
        .files
        .iter()
        .any(|file| file.path == file_path || file.old_path.as_deref() == Some(file_path));
    let target_fingerprint_path = pre_snapshot
        .target_file_fingerprints
        .iter()
        .find(|fingerprint| fingerprint.path == file_path)
        .map(|fingerprint| fingerprint.path.as_str());
    let parsed_patch_paths = parsed_unified_diff_paths(raw_diff);
    let post_apply_verification = if !fingerprints_match
        && target_changed
        && reverse_check == Some(true)
        && forward_check == Some(false)
    {
        Some(match target_fingerprint_path {
            Some(fingerprint_path) => verify_post_apply_changed_paths(
                file_path,
                file_path,
                &parsed_patch_paths,
                &backup_path,
                fingerprint_path,
                &current_status,
            ),
            None => PostApplyPathVerification {
                status: "quarantine_required".to_string(),
                expected_paths: vec![file_path.to_string()],
                observed_changed_paths: current_status
                    .files
                    .iter()
                    .map(|file| file.path.clone())
                    .collect(),
                unexpected_paths: Vec::new(),
                missing_expected_paths: vec![file_path.to_string()],
                verified_at: now_unix_seconds(),
                message: "Post-apply verification could not match the approved path to its validation fingerprint. The outcome is quarantined for manual inspection."
                    .to_string(),
            },
        })
    } else {
        None
    };
    let (status, artifact_status, message) =
        if fingerprints_match && git_status_changed == Some(false) && forward_check == Some(true) {
            ("failed", "apply_failed", apply_attempt_message("failed"))
        } else if let Some(verification) = post_apply_verification.as_ref() {
            (
                verification.status.as_str(),
                verification.status.as_str(),
                verification.message.clone(),
            )
        } else {
            (
                "needs_inspection",
                "needs_inspection",
                apply_attempt_message("needs_inspection"),
            )
        };
    let artifact_message = (status != "applied_verified").then_some(message.as_str());
    persist_reconciled_artifact(
        pool,
        &proposal_id,
        &artifact_id,
        artifact_status,
        backup_id.as_deref(),
        artifact_message,
        matches!(status, "applied_verified" | "quarantine_required").then_some(&current_status),
    )
    .await?;
    persist_reconciled_attempt(
        pool,
        &attempt_id,
        status,
        artifact_message,
        Some(&post_evidence),
        Some(&current_status),
    )
    .await?;
    if let Some(verification) = post_apply_verification.as_ref() {
        persist_reconciled_post_apply_verification(
            pool,
            &proposal_id,
            &artifact_id,
            &attempt_id,
            verification,
        )
        .await?;
    }
    Ok(())
}

async fn load_patch_apply_attempt_records(
    pool: &SqlitePool,
) -> Result<Vec<PatchApplyAttemptRecord>, ApplyPatchError> {
    let rows = sqlx::query(
        "SELECT id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, sanitized_error, backup_id, rollback_backup_id, started_at, completed_at, pre_apply_evidence_json, post_apply_evidence_json, post_apply_verification_json, post_rollback_verification_json FROM patch_apply_attempts ORDER BY started_at DESC LIMIT 100",
    )
    .fetch_all(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Apply attempt history could not be loaded safely.",
        )
    })?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let status: String = row.try_get("status").unwrap_or_default();
            let pre_apply_evidence: Option<PatchApplyEvidence> = row
                .try_get::<Option<String>, _>("pre_apply_evidence_json")
                .unwrap_or(None)
                .and_then(|value| serde_json::from_str(&value).ok());
            let post_apply_evidence: Option<PatchApplyEvidence> = row
                .try_get::<Option<String>, _>("post_apply_evidence_json")
                .unwrap_or(None)
                .and_then(|value| serde_json::from_str(&value).ok());
            let post_apply_verification: Option<PostApplyPathVerification> = row
                .try_get::<Option<String>, _>("post_apply_verification_json")
                .unwrap_or(None)
                .and_then(|value| serde_json::from_str(&value).ok());
            let post_rollback_verification: Option<PostRollbackVerification> = row
                .try_get::<Option<String>, _>("post_rollback_verification_json")
                .unwrap_or(None)
                .and_then(|value| serde_json::from_str(&value).ok());
            let current_git_status_changed = match (&pre_apply_evidence, &post_apply_evidence) {
                (Some(pre), Some(post)) => post.git_status.as_ref().and_then(|current| {
                    pre.git_status
                        .as_ref()
                        .map(|previous| git_status_evidence_changed(previous, current))
                }),
                _ => None,
            };
            PatchApplyAttemptRecord {
                apply_attempt_id: row.try_get("id").unwrap_or_default(),
                repository_id: row.try_get("repository_id").unwrap_or_default(),
                proposed_change_id: row.try_get("proposed_change_id").unwrap_or_default(),
                approval_request_id: row.try_get("approval_request_id").unwrap_or_default(),
                patch_artifact_id: row.try_get("patch_artifact_id").unwrap_or_default(),
                backup_id: row.try_get("backup_id").unwrap_or(None),
                rollback_backup_id: row.try_get("rollback_backup_id").unwrap_or(None),
                status: status.clone(),
                started_at: row.try_get("started_at").unwrap_or_default(),
                completed_at: row.try_get("completed_at").unwrap_or(None),
                sanitized_error: row.try_get("sanitized_error").unwrap_or(None),
                pre_apply_evidence,
                post_apply_evidence,
                post_apply_verification,
                post_rollback_verification,
                current_git_status_changed,
                message: apply_attempt_message(&status),
            }
        })
        .collect())
}

async fn reconcile_interrupted_patch_apply_attempts_with_pool(
    pool: &SqlitePool,
    lock_directory: &Path,
) -> Result<Vec<PatchApplyAttemptRecord>, ApplyPatchError> {
    let _apply_guard = PATCH_APPLY_LOCK.lock().await;
    ensure_patch_apply_tables(pool).await?;
    let active_lock_rows =
        sqlx::query("SELECT DISTINCT repository_id FROM patch_apply_locks WHERE status = 'active'")
            .fetch_all(pool)
            .await
            .map_err(|_| {
                apply_patch_error(
                    "storage_unavailable",
                    "Active apply locks could not be inspected safely.",
                )
            })?;
    for row in active_lock_rows {
        let repository_id: String = row.try_get("repository_id").unwrap_or_default();
        let Some(_repository_lock) = try_repository_file_lock(lock_directory, &repository_id)?
        else {
            continue;
        };
        mark_abandoned_apply_locks_stale(pool, &repository_id).await?;
    }
    // `rolling_back` joins this list because a state the reconciler cannot see is
    // strictly worse than a state with no exit: it would be an attempt stuck
    // mid-write, the target in an unknown state, and the repository still
    // accepting applies as though nothing were pending.
    let unfinished_rows = sqlx::query(
        "SELECT id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, backup_id, pre_apply_evidence_json FROM patch_apply_attempts WHERE status IN ('pending', 'applying', 'rolling_back') ORDER BY started_at ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|_| {
        apply_patch_error(
            "storage_unavailable",
            "Unfinished apply attempts could not be inspected safely.",
        )
    })?;
    for row in &unfinished_rows {
        let repository_id: String = row.try_get("repository_id").unwrap_or_default();
        let Some(_repository_lock) = try_repository_file_lock(lock_directory, &repository_id)?
        else {
            continue;
        };
        mark_abandoned_apply_locks_stale(pool, &repository_id).await?;
        classify_unfinished_apply_attempt(pool, row).await?;
    }
    load_patch_apply_attempt_records(pool).await
}

#[tauri::command]
async fn apply_approved_patch_artifact(
    app_handle: tauri::AppHandle,
    database_instances: tauri::State<'_, DbInstances>,
    input: ApplyApprovedPatchArtifactInput,
) -> Result<ApplyApprovedPatchArtifactResult, ApplyPatchError> {
    let instances = database_instances.0.read().await;
    let pool = match instances.get(WORKSPACE_DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err(apply_patch_error(
                "storage_unavailable",
                "Native workspace storage is unavailable. The patch was not applied.",
            ));
        }
    };
    drop(instances);

    let lock_directory = apply_lock_directory(&app_handle)?;
    apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input).await
}

#[tauri::command]
async fn rollback_applied_patch_artifact(
    app_handle: tauri::AppHandle,
    database_instances: tauri::State<'_, DbInstances>,
    input: RollbackAppliedPatchArtifactInput,
) -> Result<RollbackAppliedPatchArtifactResult, ApplyPatchError> {
    let instances = database_instances.0.read().await;
    let pool = match instances.get(WORKSPACE_DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err(apply_patch_error(
                "storage_unavailable",
                "Native workspace storage is unavailable. Nothing was rolled back.",
            ));
        }
    };
    drop(instances);

    let lock_directory = apply_lock_directory(&app_handle)?;
    rollback_applied_patch_artifact_with_pool(&pool, &lock_directory, input).await
}

#[tauri::command]
async fn acknowledge_patch_apply_attempt(
    database_instances: tauri::State<'_, DbInstances>,
    input: AcknowledgeApplyAttemptInput,
) -> Result<AcknowledgeApplyAttemptResult, ApplyPatchError> {
    let instances = database_instances.0.read().await;
    let pool = match instances.get(WORKSPACE_DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err(apply_patch_error(
                "storage_unavailable",
                "Native workspace storage is unavailable. No attempt was acknowledged.",
            ));
        }
    };
    drop(instances);

    acknowledge_patch_apply_attempt_with_pool(&pool, input).await
}

#[tauri::command]
async fn reconcile_interrupted_patch_apply_attempts(
    app_handle: tauri::AppHandle,
    database_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<PatchApplyAttemptRecord>, ApplyPatchError> {
    let instances = database_instances.0.read().await;
    let pool = match instances.get(WORKSPACE_DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => {
            return Err(apply_patch_error(
                "storage_unavailable",
                "Native workspace storage is unavailable for apply reconciliation.",
            ));
        }
    };
    drop(instances);

    let lock_directory = apply_lock_directory(&app_handle)?;
    reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory).await
}

#[tauri::command]
fn load_repository_validation_snapshot(
    input: RepositorySnapshotInput,
) -> Result<RepositoryValidationSnapshot, String> {
    let (repository_root, canonical_repository_path) =
        canonical_selected_git_root(&input.repository_path)
            .map_err(|_| "Selected Git repository is unavailable.".to_string())?;

    capture_repository_validation_snapshot(
        &input.repository_id,
        &repository_root,
        &canonical_repository_path,
        &input.artifact_digest,
        &input.relevant_file_paths,
    )
    .map_err(|_| "Repository fingerprint evidence is unavailable.".to_string())
}

#[tauri::command]
fn validate_generated_patch(input: PatchValidationInput) -> PatchValidationResult {
    if let Err(reason) = validate_generated_patch_structure(&input) {
        return match reason.as_str() {
            "binary_unavailable" => patch_validation_result(
                &input,
                "unavailable",
                "Binary patch artifacts cannot use the text dry-run boundary.",
            ),
            "rename_unavailable" => patch_validation_result(
                &input,
                "unavailable",
                "Rename dry-runs are unavailable until old-path validation is supported.",
            ),
            "content_unavailable" => patch_validation_result(
                &input,
                "unavailable",
                "No generated patch content is available to validate.",
            ),
            _ => patch_validation_result(&input, "invalid_structure", &reason),
        };
    }

    let (repository_root, canonical_repository_path) = match canonical_selected_git_root(
        &input.repository_path,
    ) {
        Ok(root) => root,
        Err(_) => {
            return patch_validation_result(
                &input,
                "valid_structure",
                "Patch structure is valid, but the selected Git repository is unavailable for dry-run.",
            );
        }
    };
    let Some(artifact_digest) = input.artifact_digest.as_deref() else {
        return patch_validation_result(
            &input,
            "valid_structure",
            "Patch structure is valid, but its artifact digest is unavailable.",
        );
    };
    let relevant_paths = if input.relevant_file_paths.is_empty() {
        vec![input.file_path.clone()]
    } else {
        input.relevant_file_paths.clone()
    };
    let repository_snapshot = match capture_repository_validation_snapshot(
        &input.repository_id,
        &repository_root,
        &canonical_repository_path,
        artifact_digest,
        &relevant_paths,
    ) {
        Ok(snapshot) => snapshot,
        Err(_) => {
            return patch_validation_result(
                &input,
                "valid_structure",
                "Patch structure is valid, but native fingerprint evidence is unavailable.",
            );
        }
    };

    let raw_diff = input.raw_diff.as_deref().unwrap_or_default();
    let patch_for_git = normalized_patch_text(raw_diff);
    match run_fixed_git_apply(&canonical_repository_path, &patch_for_git, true) {
        FixedGitApplyOutcome::Succeeded => patch_validation_result_with_snapshot(
            &input,
            "dry_run_passed",
            "Git reports that the patch can apply to the current working tree without writing it.",
            repository_snapshot,
            true,
        ),
        FixedGitApplyOutcome::Rejected => patch_validation_result_with_snapshot(
            &input,
            "dry_run_failed",
            "Git reports that the patch does not apply cleanly to the current working tree.",
            repository_snapshot,
            true,
        ),
        FixedGitApplyOutcome::TimedOut => patch_validation_result_with_snapshot(
            &input,
            "dry_run_failed",
            "The native Git dry-run exceeded 15 seconds and was terminated without writing files.",
            repository_snapshot,
            true,
        ),
        FixedGitApplyOutcome::Unavailable | FixedGitApplyOutcome::Interrupted => {
            patch_validation_result_with_snapshot(
                &input,
                "valid_structure",
                "Patch structure is valid, but the native Git dry-run could not complete safely.",
                repository_snapshot,
                false,
            )
        }
    }
}

#[tauri::command]
fn get_openai_provider_configuration() -> OpenAiProviderConfiguration {
    let has_api_key = env::var("OPENAI_API_KEY")
        .ok()
        .is_some_and(|key| !key.trim().is_empty());
    let model_configuration = openai_model();
    let configured = has_api_key && model_configuration.is_ok();
    let reason = if !has_api_key {
        Some(
            "Set OPENAI_API_KEY in the native app environment to enable OpenAI planning."
                .to_string(),
        )
    } else if model_configuration.is_err() {
        Some("OPENAI_MODEL contains unsupported characters or exceeds the safe length.".to_string())
    } else {
        None
    };

    OpenAiProviderConfiguration {
        configured,
        model: model_configuration.unwrap_or_else(|_| DEFAULT_OPENAI_MODEL.to_string()),
        reason,
    }
}

#[tauri::command]
async fn test_openai_connection() -> OpenAiConnectionDiagnostic {
    let model_configuration = openai_model();
    let display_model = model_configuration
        .as_ref()
        .cloned()
        .unwrap_or_else(|_| DEFAULT_OPENAI_MODEL.to_string());
    let checked_at = now_unix_seconds();
    let Some(api_key) = env::var("OPENAI_API_KEY")
        .ok()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
    else {
        return OpenAiConnectionDiagnostic {
            status: "not_configured".to_string(),
            configured: false,
            model: display_model,
            checked_at,
            latency_ms: None,
            message: "OpenAI is not configured in the native environment.".to_string(),
        };
    };
    let Ok(model) = model_configuration else {
        return OpenAiConnectionDiagnostic {
            status: "invalid_configuration".to_string(),
            configured: false,
            model: display_model,
            checked_at,
            latency_ms: None,
            message: "The configured OpenAI model identifier is invalid.".to_string(),
        };
    };
    let Ok(url) = openai_model_url(&model) else {
        return OpenAiConnectionDiagnostic {
            status: "invalid_configuration".to_string(),
            configured: true,
            model,
            checked_at,
            latency_ms: None,
            message: "The configured OpenAI model identifier is invalid.".to_string(),
        };
    };
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
    else {
        return OpenAiConnectionDiagnostic {
            status: "unavailable".to_string(),
            configured: true,
            model,
            checked_at,
            latency_ms: None,
            message: "The native HTTP client could not start the connection test.".to_string(),
        };
    };
    let started_at = Instant::now();
    let response = client.get(url).bearer_auth(api_key).send().await;
    let latency_ms = Some(started_at.elapsed().as_millis().min(u64::MAX as u128) as u64);

    match response {
        Ok(response) => {
            let (status, message) = openai_connection_status(response.status());

            OpenAiConnectionDiagnostic {
                status: status.to_string(),
                configured: true,
                model,
                checked_at,
                latency_ms,
                message: message.to_string(),
            }
        }
        Err(error) => OpenAiConnectionDiagnostic {
            status: if error.is_timeout() {
                "timeout".to_string()
            } else {
                "unavailable".to_string()
            },
            configured: true,
            model,
            checked_at,
            latency_ms,
            message: if error.is_timeout() {
                "The OpenAI connection test timed out.".to_string()
            } else {
                "OpenAI could not be reached for a connection test.".to_string()
            },
        },
    }
}

#[tauri::command]
async fn create_openai_plan(input: OpenAiPlanInput) -> Result<Value, String> {
    validate_openai_plan_input(&input)?;

    let api_key = env::var("OPENAI_API_KEY")
        .ok()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
        .ok_or_else(|| "provider_not_configured".to_string())?;
    let model = openai_model()?;
    let request_body = build_openai_plan_request(&input, &model);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "request_failed".to_string())?;
    let response = client
        .post(OPENAI_RESPONSES_URL)
        .bearer_auth(api_key)
        .json(&request_body)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "timeout".to_string()
            } else {
                "request_failed".to_string()
            }
        })?;
    let status = response.status();

    if !status.is_success() {
        return Err(match status.as_u16() {
            401 | 403 => "authentication_error",
            408 | 504 => "timeout",
            429 => "rate_limit",
            _ => "provider_unavailable",
        }
        .to_string());
    }

    let response_body = response
        .json::<Value>()
        .await
        .map_err(|_| "invalid_output".to_string())?;

    if response_body.get("status").and_then(Value::as_str) != Some("completed") {
        return Err("invalid_output".to_string());
    }

    let output_text =
        extract_openai_output_text(&response_body).ok_or_else(|| "invalid_output".to_string())?;

    serde_json::from_str::<Value>(output_text).map_err(|_| "invalid_output".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
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

    fn test_apply_lock_directory(repository_path: &Path) -> PathBuf {
        repository_path.with_file_name(format!(
            "{}-app-locks",
            repository_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("repository")
        ))
    }

    fn remove_temp_dir(path: &Path) {
        let _ = fs::remove_dir_all(path);
        let _ = fs::remove_dir_all(test_apply_lock_directory(path));
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

    fn test_openai_plan_input() -> OpenAiPlanInput {
        OpenAiPlanInput {
            run_id: "run-private-id".to_string(),
            repository_id: "repository-private-id".to_string(),
            repository_name: Some("AI Developer Workspace".to_string()),
            task_title: "Add a provider adapter".to_string(),
            task_prompt: "Create a bounded implementation plan for an OpenAI adapter.".to_string(),
            context: OpenAiPlanContext {
                branch: "main".to_string(),
                indexed_file_count: 42,
                key_files: vec!["package.json".to_string(), "src/App.tsx".to_string()],
                project_folders: vec!["src".to_string(), "docs".to_string()],
                top_extensions: vec![OpenAiPlanExtensionSummary {
                    extension: "ts".to_string(),
                    count: 12,
                }],
                git: OpenAiPlanGitContext {
                    is_git_repository: true,
                    is_clean: false,
                    changed_file_count: 2,
                },
            },
        }
    }

    fn test_patch_validation_input(
        repository_path: &Path,
        file_path: &str,
        operation: &str,
        raw_diff: &str,
    ) -> PatchValidationInput {
        PatchValidationInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            file_path: file_path.to_string(),
            operation: operation.to_string(),
            is_binary: false,
            raw_diff: Some(raw_diff.to_string()),
            artifact_digest: Some("a".repeat(64)),
            relevant_file_paths: vec![file_path.to_string()],
        }
    }

    fn commit_test_file(repository_path: &Path, file_path: &str, content: &str) {
        fs::write(repository_path.join(file_path), content).expect("write committed test file");
        let add = Command::new("git")
            .args(["add", "--", file_path])
            .current_dir(repository_path)
            .output()
            .expect("stage test fixture");
        assert!(add.status.success());
        let commit = Command::new("git")
            .args([
                "-c",
                "user.name=AI Workspace Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "-m",
                "test fixture",
            ])
            .current_dir(repository_path)
            .output()
            .expect("commit test fixture");
        assert!(
            commit.status.success(),
            "git commit failed: {}",
            String::from_utf8_lossy(&commit.stderr)
        );
    }

    async fn create_apply_test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("create apply test database");
        sqlx::query(
            "CREATE TABLE repositories (id TEXT PRIMARY KEY, path TEXT NOT NULL, is_git_repository INTEGER NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("create repositories table");
        sqlx::query(
            "CREATE TABLE proposed_changes (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, approval_request_id TEXT, repository_id TEXT NOT NULL, status TEXT NOT NULL, files_json TEXT NOT NULL, patch_artifacts_json TEXT NOT NULL, updated_at TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("create proposed changes table");
        sqlx::query(
            "CREATE TABLE approval_requests (id TEXT PRIMARY KEY, status TEXT NOT NULL, agent_run_id TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .expect("create approvals table");
        pool
    }

    async fn seed_apply_test_records(
        pool: &SqlitePool,
        repository_path: &Path,
        approval_status: &str,
    ) -> ApplyApprovedPatchArtifactInput {
        seed_apply_test_records_for(
            pool,
            repository_path,
            approval_status,
            "generated.txt",
            "create",
            "diff --git a/generated.txt b/generated.txt\nnew file mode 100644\n--- /dev/null\n+++ b/generated.txt\n@@ -0,0 +1 @@\n+safe generated content\n",
        )
        .await
    }

    async fn seed_apply_test_records_for(
        pool: &SqlitePool,
        repository_path: &Path,
        approval_status: &str,
        file_path: &str,
        operation: &str,
        raw_diff: &str,
    ) -> ApplyApprovedPatchArtifactInput {
        let repository_id = "repo-apply";
        let proposal_id = "proposal-apply";
        let approval_id = "approval-apply";
        let artifact_id = "artifact-apply";
        let run_id = "run-apply";
        let normalized_patch = normalized_patch_text(raw_diff);
        let artifact_digest = sha256_hex(normalized_patch.as_bytes());
        let (repository_root, canonical_repository_path) =
            canonical_selected_git_root(repository_path.to_str().expect("repository path"))
                .expect("canonical test repository");
        let snapshot = capture_repository_validation_snapshot(
            repository_id,
            &repository_root,
            &canonical_repository_path,
            &artifact_digest,
            &[file_path.to_string()],
        )
        .expect("capture validation snapshot");
        let files = json!([{
            "id": "file-apply",
            "path": file_path,
            "operation": operation,
            "reason": "Native safe apply test fixture.",
            "riskLevel": "low",
            "patchArtifactStatus": "generated"
        }]);
        let artifacts = json!([{
            "id": artifact_id,
            "proposedChangeId": proposal_id,
            "filePath": file_path,
            "status": "generated",
            "isBinary": false,
            "isTooLarge": false,
            "rawDiff": raw_diff,
            "artifactDigest": artifact_digest,
            "validationStatus": "dry_run_passed",
            "validatedArtifactDigest": artifact_digest,
            "validationRepositorySnapshot": snapshot,
            "validatedAt": "1783532400",
            "dryRunAt": "1783532400"
        }]);

        sqlx::query("INSERT INTO repositories (id, path, is_git_repository) VALUES (?, ?, 1)")
            .bind(repository_id)
            .bind(repository_path.to_string_lossy().to_string())
            .execute(pool)
            .await
            .expect("insert repository");
        sqlx::query("INSERT INTO approval_requests (id, status, agent_run_id) VALUES (?, ?, ?)")
            .bind(approval_id)
            .bind(approval_status)
            .bind(run_id)
            .execute(pool)
            .await
            .expect("insert approval");
        sqlx::query(
            "INSERT INTO proposed_changes (id, run_id, approval_request_id, repository_id, status, files_json, patch_artifacts_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(proposal_id)
        .bind(run_id)
        .bind(approval_id)
        .bind(repository_id)
        .bind(if approval_status == "approved" {
            "approved"
        } else {
            "ready_for_review"
        })
        .bind(files.to_string())
        .bind(artifacts.to_string())
        .bind("1783532400")
        .execute(pool)
        .await
        .expect("insert proposal");

        ApplyApprovedPatchArtifactInput {
            repository_id: repository_id.to_string(),
            proposed_change_id: proposal_id.to_string(),
            approval_request_id: approval_id.to_string(),
            patch_artifact_id: artifact_id.to_string(),
            confirmation_phrase: APPLY_CONFIRMATION_PHRASE.to_string(),
        }
    }

    // A spaced filename throughout: git quotes it in `status --porcelain=v1`
    // output, so every rollback path that reads status depends on the porcelain
    // parser landed in #3. An unquoted spaced path in the diff headers is what
    // `git apply` accepts and what `parsed_unified_diff_paths` strips `a/` from.
    const ROLLBACK_TARGET: &str = "My Notes.md";
    const ROLLBACK_PRE_APPLY_CONTENT: &str = "original line\n";
    const ROLLBACK_POST_APPLY_CONTENT: &str = "patched line\n";
    const ROLLBACK_MODIFY_DIFF: &str = "diff --git a/My Notes.md b/My Notes.md\n--- a/My Notes.md\n+++ b/My Notes.md\n@@ -1 +1 @@\n-original line\n+patched line\n";

    fn test_rollback_input(confirmation_phrase: &str) -> RollbackAppliedPatchArtifactInput {
        RollbackAppliedPatchArtifactInput {
            repository_id: "repo-apply".to_string(),
            proposed_change_id: "proposal-apply".to_string(),
            patch_artifact_id: "artifact-apply".to_string(),
            confirmation_phrase: confirmation_phrase.to_string(),
        }
    }

    fn git_in(repository_path: &Path, args: &[&str]) {
        let output = Command::new("git")
            .args(args)
            .current_dir(repository_path)
            .output()
            .expect("run git fixture command");
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    /// Applies a real modify patch and returns its verified result.
    ///
    /// Rollback's preconditions are derived from records only apply writes, so
    /// the fixture applies for real rather than hand-forging `applied_verified`.
    async fn seed_and_apply_modify(
        pool: &SqlitePool,
        repository_path: &Path,
    ) -> ApplyApprovedPatchArtifactResult {
        commit_test_file(repository_path, ROLLBACK_TARGET, ROLLBACK_PRE_APPLY_CONTENT);
        let input = seed_apply_test_records_for(
            pool,
            repository_path,
            "approved",
            ROLLBACK_TARGET,
            "modify",
            ROLLBACK_MODIFY_DIFF,
        )
        .await;
        let lock_directory = test_apply_lock_directory(repository_path);
        let result = apply_approved_patch_artifact_with_pool(pool, &lock_directory, input)
            .await
            .expect("apply the modify fixture");
        assert_eq!(result.status, "applied_verified");
        result
    }

    async fn seed_and_apply_create(
        pool: &SqlitePool,
        repository_path: &Path,
    ) -> ApplyApprovedPatchArtifactResult {
        commit_test_file(repository_path, "README.md", "fixture\n");
        let input = seed_apply_test_records(pool, repository_path, "approved").await;
        let lock_directory = test_apply_lock_directory(repository_path);
        let result = apply_approved_patch_artifact_with_pool(pool, &lock_directory, input)
            .await
            .expect("apply the create fixture");
        assert_eq!(result.status, "applied_verified");
        result
    }

    async fn artifact_apply_status(pool: &SqlitePool) -> String {
        let row = sqlx::query(
            "SELECT patch_artifacts_json FROM proposed_changes WHERE id = 'proposal-apply'",
        )
        .fetch_one(pool)
        .await
        .expect("load artifact state");
        let artifacts: Value =
            serde_json::from_str(&row.try_get::<String, _>("patch_artifacts_json").unwrap())
                .unwrap();
        artifacts[0]["applyStatus"]
            .as_str()
            .unwrap_or("")
            .to_string()
    }

    async fn proposal_status(pool: &SqlitePool) -> String {
        let row = sqlx::query("SELECT status FROM proposed_changes WHERE id = 'proposal-apply'")
            .fetch_one(pool)
            .await
            .expect("load proposal status");
        row.try_get::<String, _>("status").unwrap()
    }

    async fn mutate_apply_artifact(pool: &SqlitePool, mutation: impl FnOnce(&mut Value)) {
        let row = sqlx::query(
            "SELECT patch_artifacts_json FROM proposed_changes WHERE id = 'proposal-apply'",
        )
        .fetch_one(pool)
        .await
        .expect("load artifact fixture");
        let artifacts_json: String = row.try_get("patch_artifacts_json").unwrap();
        let mut artifacts: Value = serde_json::from_str(&artifacts_json).unwrap();
        mutation(&mut artifacts);
        sqlx::query(
            "UPDATE proposed_changes SET patch_artifacts_json = ? WHERE id = 'proposal-apply'",
        )
        .bind(artifacts.to_string())
        .execute(pool)
        .await
        .expect("update artifact fixture");
    }

    async fn reset_successful_apply_to_unfinished(
        pool: &SqlitePool,
        result: &ApplyApprovedPatchArtifactResult,
        remove_pre_evidence: bool,
        remove_backup: bool,
    ) {
        mutate_apply_artifact(pool, |artifacts| {
            let artifact = artifacts[0].as_object_mut().unwrap();
            artifact.insert("applyStatus".to_string(), json!("applying"));
            artifact.remove("appliedAt");
            artifact.remove("appliedBy");
            artifact.remove("applyError");
            artifact.remove("postApplyGitStatus");
        })
        .await;
        sqlx::query("UPDATE proposed_changes SET status = 'approved'")
            .execute(pool)
            .await
            .expect("reset proposal status");
        sqlx::query(
            "UPDATE patch_apply_attempts SET status = 'applying', completed_at = NULL, sanitized_error = NULL, post_apply_evidence_json = NULL, post_apply_git_status_json = NULL WHERE id = ?",
        )
        .bind(&result.apply_attempt_id)
        .execute(pool)
        .await
        .expect("reset attempt status");
        if remove_pre_evidence {
            sqlx::query(
                "UPDATE patch_apply_attempts SET pre_apply_evidence_json = NULL WHERE id = ?",
            )
            .bind(&result.apply_attempt_id)
            .execute(pool)
            .await
            .expect("remove pre-apply evidence");
        }
        if remove_backup {
            sqlx::query("DELETE FROM patch_apply_backups WHERE id = ?")
                .bind(&result.backup_id)
                .execute(pool)
                .await
                .expect("remove backup fixture");
        }
    }

    #[test]
    fn openai_plan_input_accepts_bounded_repository_summary() {
        assert_eq!(
            validate_openai_plan_input(&test_openai_plan_input()),
            Ok(())
        );
    }

    #[test]
    fn openai_model_url_accepts_bounded_ids_and_rejects_path_injection() {
        let url = openai_model_url("gpt-5.6-luna").expect("valid model URL");

        assert_eq!(
            url.as_str(),
            "https://api.openai.com/v1/models/gpt-5.6-luna"
        );
        assert_eq!(
            openai_model_url("../models"),
            Err("invalid_model".to_string())
        );
        assert_eq!(
            openai_model_url("model/other"),
            Err("invalid_model".to_string())
        );
    }

    #[test]
    fn openai_connection_http_statuses_map_to_sanitized_diagnostics() {
        assert_eq!(
            openai_connection_status(reqwest::StatusCode::OK),
            (
                "connected",
                "OpenAI credentials and configured model access were verified."
            )
        );
        assert_eq!(
            openai_connection_status(reqwest::StatusCode::UNAUTHORIZED).0,
            "authentication_failed"
        );
        assert_eq!(
            openai_connection_status(reqwest::StatusCode::NOT_FOUND).0,
            "model_unavailable"
        );
        assert_eq!(
            openai_connection_status(reqwest::StatusCode::TOO_MANY_REQUESTS).0,
            "rate_limited"
        );
        assert_eq!(
            openai_connection_status(reqwest::StatusCode::INTERNAL_SERVER_ERROR).0,
            "unavailable"
        );
    }

    #[test]
    fn openai_connection_diagnostic_serializes_without_credentials_or_response_body() {
        let diagnostic = OpenAiConnectionDiagnostic {
            status: "connected".to_string(),
            configured: true,
            model: "test-model".to_string(),
            checked_at: "123".to_string(),
            latency_ms: Some(20),
            message: "Connection verified.".to_string(),
        };
        let value = serde_json::to_value(diagnostic).expect("serialize diagnostic");

        assert_eq!(value["status"], "connected");
        assert_eq!(value["checkedAt"], "123");
        assert_eq!(value["latencyMs"], 20);
        assert!(value.get("apiKey").is_none());
        assert!(value.get("responseBody").is_none());
        assert!(value.get("headers").is_none());
    }

    #[test]
    fn openai_plan_input_rejects_sensitive_traversal_and_oversized_context() {
        let mut sensitive = test_openai_plan_input();
        sensitive.context.key_files = vec![".env.production".to_string()];
        assert_eq!(
            validate_openai_plan_input(&sensitive),
            Err("invalid_input".to_string())
        );

        let mut traversal = test_openai_plan_input();
        traversal.context.key_files = vec!["../outside.txt".to_string()];
        assert_eq!(
            validate_openai_plan_input(&traversal),
            Err("invalid_input".to_string())
        );

        let mut oversized = test_openai_plan_input();
        oversized.context.key_files = (0..=MAX_PROVIDER_KEY_FILES)
            .map(|index| format!("src/file-{index}.ts"))
            .collect();
        assert_eq!(
            validate_openai_plan_input(&oversized),
            Err("invalid_input".to_string())
        );
    }

    #[test]
    fn openai_request_contains_only_bounded_context_and_strict_plan_schema() {
        let input = test_openai_plan_input();
        let request = build_openai_plan_request(&input, "test-model");
        let prompt = request["input"][0]["content"][0]["text"]
            .as_str()
            .expect("bounded prompt text");

        assert!(prompt.contains("AI Developer Workspace"));
        assert!(prompt.contains("indexedFileCount"));
        assert!(!prompt.contains("run-private-id"));
        assert!(!prompt.contains("repository-private-id"));
        assert_eq!(request["store"], false);
        assert_eq!(request["text"]["format"]["type"], "json_schema");
        assert_eq!(request["text"]["format"]["strict"], true);
        assert_eq!(
            request["text"]["format"]["schema"]["additionalProperties"],
            false
        );
        assert!(request.get("tools").is_none());
        assert!(request["text"]["format"]["schema"]["required"]
            .as_array()
            .expect("required fields")
            .contains(&json!("patchArtifacts")));
        assert!(request["instructions"]
            .as_str()
            .expect("instructions")
            .contains("never apply them"));
    }

    #[test]
    fn extracts_only_completed_output_text_content() {
        let response = json!({
            "status": "completed",
            "output": [{
                "type": "message",
                "content": [
                    { "type": "refusal", "refusal": "not used" },
                    { "type": "output_text", "text": "{\"summary\":\"Ready\"}" }
                ]
            }]
        });

        assert_eq!(
            extract_openai_output_text(&response),
            Some("{\"summary\":\"Ready\"}")
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
    fn generated_patch_structure_rejects_unsafe_mismatched_and_binary_content() {
        let repository_path = Path::new("/tmp/repository");
        let valid_diff = "diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-old\n+new";
        let traversal =
            test_patch_validation_input(repository_path, "../outside.txt", "modify", valid_diff);
        let absolute =
            test_patch_validation_input(repository_path, "/tmp/outside.txt", "modify", valid_diff);
        let operation_mismatch =
            test_patch_validation_input(repository_path, "src/App.tsx", "create", valid_diff);
        let multiple_files = test_patch_validation_input(
            repository_path,
            "src/App.tsx",
            "modify",
            &format!("{valid_diff}\ndiff --git a/src/Other.tsx b/src/Other.tsx"),
        );
        let binary_payload = test_patch_validation_input(
            repository_path,
            "src/App.tsx",
            "modify",
            &format!("{valid_diff}\nGIT binary patch"),
        );
        let oversized = test_patch_validation_input(
            repository_path,
            "src/App.tsx",
            "modify",
            &format!("{valid_diff}\n+{}", "x".repeat(MAX_GENERATED_PATCH_BYTES)),
        );
        let too_many_lines = test_patch_validation_input(
            repository_path,
            "src/App.tsx",
            "modify",
            &format!(
                "{valid_diff}\n{}",
                " context\n".repeat(MAX_GENERATED_PATCH_LINES)
            ),
        );

        assert!(validate_generated_patch_structure(&traversal).is_err());
        assert!(validate_generated_patch_structure(&absolute).is_err());
        assert!(validate_generated_patch_structure(&operation_mismatch).is_err());
        assert!(validate_generated_patch_structure(&multiple_files).is_err());
        assert!(validate_generated_patch_structure(&binary_payload).is_err());
        assert!(validate_generated_patch_structure(&oversized).is_err());
        assert!(validate_generated_patch_structure(&too_many_lines).is_err());
    }

    #[test]
    fn safe_apply_rejects_an_artifact_left_in_an_unresolved_attempt_state() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-unresolved-artifact");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("interrupted");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("an unresolved artifact must never be applied again");

            assert_eq!(error.code, "unresolved_apply_attempt");
            assert!(!repository_path.join("generated.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn safe_apply_stays_blocked_for_its_artifact_after_the_attempt_is_acknowledged() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-acknowledged-artifact");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            ensure_patch_apply_tables(&pool)
                .await
                .expect("apply tables");
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("quarantine_required");
            })
            .await;
            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('attempt-ack', 'proposal-apply', 'artifact-apply', 'approval-apply', 'repo-apply', 'quarantine_required', '1783532400')",
            )
            .execute(&pool)
            .await
            .expect("seed quarantined attempt");

            // Acknowledging clears the repository-wide unresolved-attempt block,
            // which is what isolates the artifact-level guard as the only thing
            // still standing between this artifact and a second write.
            acknowledge_patch_apply_attempt_with_pool(
                &pool,
                AcknowledgeApplyAttemptInput {
                    apply_attempt_id: "attempt-ack".to_string(),
                    confirmation_phrase: ACKNOWLEDGE_CONFIRMATION_PHRASE.to_string(),
                },
            )
            .await
            .expect("acknowledge the quarantined attempt");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("an acknowledged artifact must never become appliable again");

            assert_eq!(error.code, "unresolved_apply_attempt");
            assert!(!repository_path.join("generated.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn acknowledging_an_inspected_attempt_unblocks_the_repository_without_retrying() {
        tauri::async_runtime::block_on(async {
            let pool = create_apply_test_pool().await;
            ensure_patch_apply_tables(&pool)
                .await
                .expect("apply tables");
            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('attempt-quarantined', 'proposal-apply', 'artifact-apply', 'approval-apply', 'repo-ack', 'quarantine_required', '1783532400')",
            )
            .execute(&pool)
            .await
            .expect("seed quarantined attempt");

            let wrong_phrase = acknowledge_patch_apply_attempt_with_pool(
                &pool,
                AcknowledgeApplyAttemptInput {
                    apply_attempt_id: "attempt-quarantined".to_string(),
                    confirmation_phrase: "inspected".to_string(),
                },
            )
            .await
            .expect_err("acknowledgement requires the exact phrase");
            assert_eq!(wrong_phrase.code, "confirmation_required");

            let result = acknowledge_patch_apply_attempt_with_pool(
                &pool,
                AcknowledgeApplyAttemptInput {
                    apply_attempt_id: "attempt-quarantined".to_string(),
                    confirmation_phrase: ACKNOWLEDGE_CONFIRMATION_PHRASE.to_string(),
                },
            )
            .await
            .expect("acknowledge an inspected attempt");

            assert_eq!(result.status, "inspected");
            // The audit trail must survive acknowledgement.
            let row = sqlx::query(
                "SELECT status, acknowledged_from_status FROM patch_apply_attempts WHERE id = 'attempt-quarantined'",
            )
            .fetch_one(&pool)
            .await
            .expect("load acknowledged attempt");
            assert_eq!(row.try_get::<String, _>("status").unwrap(), "inspected");
            assert_eq!(
                row.try_get::<String, _>("acknowledged_from_status")
                    .unwrap(),
                "quarantine_required"
            );
        });
    }

    #[test]
    fn acknowledgement_refuses_an_attempt_that_has_not_been_reconciled() {
        tauri::async_runtime::block_on(async {
            let pool = create_apply_test_pool().await;
            ensure_patch_apply_tables(&pool)
                .await
                .expect("apply tables");
            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('attempt-applying', 'proposal-apply', 'artifact-apply', 'approval-apply', 'repo-ack', 'applying', '1783532400')",
            )
            .execute(&pool)
            .await
            .expect("seed in-flight attempt");

            let error = acknowledge_patch_apply_attempt_with_pool(
                &pool,
                AcknowledgeApplyAttemptInput {
                    apply_attempt_id: "attempt-applying".to_string(),
                    confirmation_phrase: ACKNOWLEDGE_CONFIRMATION_PHRASE.to_string(),
                },
            )
            .await
            .expect_err("an in-flight attempt must reconcile before acknowledgement");

            assert_eq!(error.code, "attempt_not_inspectable");
        });
    }

    #[test]
    fn repository_snapshot_refuses_to_call_an_unknown_git_status_clean() {
        let repository_path = create_temp_dir("snapshot-status-unavailable");
        fs::write(repository_path.join("safe.txt"), "content\n").expect("write fixture");

        // Not a Git repository, so `git status` exits non-zero exactly as it
        // would if the index were locked by a concurrent process. An
        // undeterminable working tree must never resolve to "clean".
        let result = capture_repository_validation_snapshot(
            "repo-snapshot",
            &repository_path,
            repository_path.to_str().expect("repository path"),
            &"a".repeat(64),
            &["safe.txt".to_string()],
        );

        assert!(result.is_err());
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn generated_patch_structure_rejects_a_second_file_section_after_the_first_hunk() {
        let repository_path = Path::new("/tmp/repository");
        // A traditional patch section needs no `diff --git` line, so a second
        // file smuggled after the first hunk is invisible to header counting
        // that stops at the first `@@ `. Git applies both sections.
        let smuggled = test_patch_validation_input(
            repository_path,
            "safe.txt",
            "modify",
            "diff --git a/safe.txt b/safe.txt\n--- a/safe.txt\n+++ b/safe.txt\n@@ -1 +1 @@\n-old\n+new\n--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-SECRET=real\n+STOLEN=1\n",
        );

        assert!(validate_generated_patch_structure(&smuggled).is_err());
    }

    #[test]
    fn parsed_unified_diff_paths_sees_every_section_of_a_multi_file_patch() {
        let paths = parsed_unified_diff_paths(
            "diff --git a/safe.txt b/safe.txt\n--- a/safe.txt\n+++ b/safe.txt\n@@ -1 +1 @@\n-old\n+new\n--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-SECRET=real\n+STOLEN=1\n",
        );

        assert!(paths.contains("safe.txt"));
        assert!(paths.contains(".env"));
    }

    #[test]
    fn generated_patch_structure_accepts_hunk_content_that_looks_like_diff_metadata() {
        let repository_path = Path::new("/tmp/repository");
        // Removing a line whose text begins with "-- " produces a "--- " body
        // line, and adding one beginning with "++ " produces "+++ ". These are
        // hunk content, not headers, and must not be rejected.
        let content_like_headers = test_patch_validation_input(
            repository_path,
            "notes.md",
            "modify",
            "diff --git a/notes.md b/notes.md\n--- a/notes.md\n+++ b/notes.md\n@@ -1 +1 @@\n--- signature line\n+++ replacement line\n",
        );

        assert!(validate_generated_patch_structure(&content_like_headers).is_ok());
    }

    #[test]
    fn git_status_summary_preserves_the_path_of_an_unstaged_modification() {
        let repository_path = create_temp_dir("git-status-modify-path");
        init_git_repo(&repository_path);
        commit_test_file(&repository_path, "safe.txt", "old\n");
        fs::write(repository_path.join("safe.txt"), "new\n").expect("modify committed file");

        let summary = load_git_status_summary(
            "repo-status".to_string(),
            repository_path.to_string_lossy().to_string(),
        );

        assert_eq!(summary.files.len(), 1);
        // Porcelain v1 reports an unstaged modification as " M safe.txt" with a
        // leading space. Trimming it shifts the path slice by one byte.
        assert_eq!(summary.files[0].path, "safe.txt");
        assert_eq!(summary.files[0].stage, "unstaged");
        assert_eq!(summary.staged_count, 0);
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn generated_patch_dry_run_passes_without_writing_the_working_tree() {
        let repository_path = create_temp_dir("patch-dry-run-pass");
        init_git_repo(&repository_path);
        let raw_diff = "diff --git a/new-file.txt b/new-file.txt\nnew file mode 100644\n--- /dev/null\n+++ b/new-file.txt\n@@ -0,0 +1 @@\n+review only";
        let input =
            test_patch_validation_input(&repository_path, "new-file.txt", "create", raw_diff);
        let status_before = git_output(
            repository_path.to_str().expect("repository path"),
            &["status", "--porcelain=v1"],
        );

        let result = validate_generated_patch(input);
        let status_after = git_output(
            repository_path.to_str().expect("repository path"),
            &["status", "--porcelain=v1"],
        );

        assert_eq!(result.status, "dry_run_passed");
        assert_eq!(
            result.artifact_digest.as_deref(),
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert!(result.dry_run_at.is_some());
        let snapshot = result
            .repository_snapshot
            .expect("validation should capture a repository snapshot");
        assert_eq!(snapshot.repository_id, "repo-test");
        assert!(snapshot.is_clean);
        assert_eq!(snapshot.changed_file_count, 0);
        assert_eq!(snapshot.relevant_file_paths, vec!["new-file.txt"]);
        assert_eq!(snapshot.target_file_fingerprints.len(), 1);
        assert_eq!(snapshot.target_file_fingerprints[0].status, "missing");
        assert!(snapshot.repository_snapshot_digest.is_some());
        assert!(!repository_path.join("new-file.txt").exists());
        assert_eq!(status_before, status_after);
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn bounded_child_wait_terminates_a_stuck_process() {
        let mut child = Command::new("/bin/sleep")
            .arg("2")
            .spawn()
            .expect("start bounded child fixture");
        let started_at = Instant::now();

        let outcome = wait_for_child_with_timeout(&mut child, Duration::from_millis(25));

        assert_eq!(outcome, FixedGitApplyOutcome::TimedOut);
        assert!(started_at.elapsed() < Duration::from_secs(1));
        assert!(child
            .try_wait()
            .expect("inspect terminated child")
            .is_some());
    }

    fn post_apply_status(paths: &[(&str, &str)], staged_count: usize) -> GitStatusSummary {
        GitStatusSummary {
            repository_id: "repo-test".to_string(),
            repository_path: "/safe/repository".to_string(),
            branch: Some("main".to_string()),
            head_sha: Some("abc1234".to_string()),
            is_git_repository: true,
            is_clean: paths.is_empty(),
            changed_file_count: paths.len(),
            staged_count,
            unstaged_count: paths.len().saturating_sub(staged_count),
            untracked_count: 0,
            conflicted_count: 0,
            files: paths
                .iter()
                .map(|(path, status_code)| GitChangedFile {
                    path: (*path).to_string(),
                    old_path: None,
                    kind: "modified".to_string(),
                    stage: if staged_count > 0 {
                        "staged".to_string()
                    } else {
                        "unstaged".to_string()
                    },
                    status_code: (*status_code).to_string(),
                })
                .collect(),
            refreshed_at: now_unix_seconds(),
        }
    }

    #[test]
    fn post_apply_verification_accepts_only_the_exact_approved_path() {
        let expected_path = "src/App.tsx";
        let parsed_paths = BTreeSet::from([expected_path.to_string()]);
        let status = post_apply_status(&[(expected_path, " M")], 0);

        let verification = verify_post_apply_changed_paths(
            expected_path,
            expected_path,
            &parsed_paths,
            expected_path,
            expected_path,
            &status,
        );

        assert_eq!(verification.status, "applied_verified");
        assert_eq!(verification.expected_paths, vec![expected_path]);
        assert_eq!(verification.observed_changed_paths, vec![expected_path]);
        assert!(verification.unexpected_paths.is_empty());
        assert!(verification.missing_expected_paths.is_empty());
    }

    #[test]
    fn post_apply_verification_quarantines_unexpected_or_staged_paths() {
        let expected_path = "src/App.tsx";
        let parsed_paths = BTreeSet::from([expected_path.to_string()]);
        let unexpected_status =
            post_apply_status(&[(expected_path, " M"), ("src/other.ts", " M")], 0);
        let staged_status = post_apply_status(&[(expected_path, "M ")], 1);

        let unexpected = verify_post_apply_changed_paths(
            expected_path,
            expected_path,
            &parsed_paths,
            expected_path,
            expected_path,
            &unexpected_status,
        );
        let staged = verify_post_apply_changed_paths(
            expected_path,
            expected_path,
            &parsed_paths,
            expected_path,
            expected_path,
            &staged_status,
        );

        assert_eq!(unexpected.status, "quarantine_required");
        assert_eq!(unexpected.unexpected_paths, vec!["src/other.ts"]);
        assert_eq!(staged.status, "quarantine_required");
    }

    #[test]
    fn post_apply_verification_quarantines_mismatched_evidence() {
        let expected_path = "src/App.tsx";
        let status = post_apply_status(&[(expected_path, " M")], 0);
        let parsed_paths = BTreeSet::from([expected_path.to_string()]);

        let verification = verify_post_apply_changed_paths(
            expected_path,
            "src/wrong.ts",
            &parsed_paths,
            expected_path,
            expected_path,
            &status,
        );

        assert_eq!(verification.status, "quarantine_required");
        assert!(verification.unexpected_paths.is_empty());
        assert!(verification.message.contains("quarantined"));
    }

    #[test]
    fn apply_timeout_requires_manual_inspection_and_preserves_recovery_boundary() {
        let (attempt_status, artifact_status, error_code, message) =
            apply_failure_details(FixedGitApplyOutcome::TimedOut)
                .expect("timeout should have a durable failure classification");

        assert_eq!(attempt_status, "interrupted");
        assert_eq!(artifact_status, "interrupted");
        assert_eq!(error_code, "git_apply_timeout");
        assert!(message.contains("backup was preserved"));
        assert!(message.contains("manual inspection is required"));
    }

    #[test]
    fn repository_apply_lock_blocks_concurrent_holder_and_releases_durably() {
        tauri::async_runtime::block_on(async {
            let lock_directory = create_temp_dir("cross-process-lock");
            let pool = create_apply_test_pool().await;
            ensure_patch_apply_tables(&pool).await.unwrap();

            let first = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-lock-test",
                "artifact-first",
                "apply_patch",
            )
            .await
            .expect("acquire first repository lock");
            let blocked = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-lock-test",
                "artifact-second",
                "apply_patch",
            )
            .await
            .unwrap_err();
            assert_eq!(blocked.code, "apply_locked");

            release_repository_apply_lock(&pool, &first)
                .await
                .expect("release first repository lock");
            drop(first);
            let second = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-lock-test",
                "artifact-second",
                "apply_patch",
            )
            .await
            .expect("acquire repository lock after release");
            release_repository_apply_lock(&pool, &second)
                .await
                .expect("release second repository lock");
            drop(second);

            let active_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM patch_apply_locks WHERE repository_id = 'repo-lock-test' AND status = 'active'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            let released_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM patch_apply_locks WHERE repository_id = 'repo-lock-test' AND status = 'released'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(active_count, 0);
            assert_eq!(released_count, 2);
            remove_temp_dir(&lock_directory);
        });
    }

    #[test]
    fn repository_apply_lock_marks_abandoned_record_stale_and_blocks_unresolved_attempts() {
        tauri::async_runtime::block_on(async {
            let lock_directory = create_temp_dir("stale-cross-process-lock");
            let pool = create_apply_test_pool().await;
            ensure_patch_apply_tables(&pool).await.unwrap();
            sqlx::query(
                "INSERT INTO patch_apply_locks (id, repository_id, process_id, operation, patch_artifact_id, status, started_at, stale_after) VALUES ('stale-lock', 'repo-lock-test', 999999, 'apply_patch', 'artifact-old', 'active', '1', 2)",
            )
            .execute(&pool)
            .await
            .unwrap();

            reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                .await
                .expect("startup reconciliation should inspect abandoned locks");
            let stale_status: String =
                sqlx::query_scalar("SELECT status FROM patch_apply_locks WHERE id = 'stale-lock'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(stale_status, "stale");

            let recovered = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-lock-test",
                "artifact-new",
                "apply_patch",
            )
            .await
            .expect("recover abandoned durable lock");
            release_repository_apply_lock(&pool, &recovered)
                .await
                .unwrap();
            drop(recovered);

            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('unresolved-attempt', 'proposal', 'artifact', 'approval', 'repo-lock-test', 'needs_inspection', '3')",
            )
            .execute(&pool)
            .await
            .unwrap();
            let unresolved = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-lock-test",
                "artifact-next",
                "apply_patch",
            )
            .await
            .unwrap_err();
            assert_eq!(unresolved.code, "unresolved_apply_attempt");
            let active_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM patch_apply_locks WHERE repository_id = 'repo-lock-test' AND status = 'active'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(active_count, 0);
            remove_temp_dir(&lock_directory);
        });
    }

    #[test]
    fn safe_apply_requires_approved_durable_records_and_exact_confirmation() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-approval");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let mut input = seed_apply_test_records(&pool, &repository_path, "pending").await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let unapproved =
                apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input).await;
            assert_eq!(unapproved.unwrap_err().code, "proposal_not_approved");
            assert!(!repository_path.join("generated.txt").exists());

            sqlx::query("UPDATE proposed_changes SET status = 'approved'")
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("UPDATE approval_requests SET status = 'approved'")
                .execute(&pool)
                .await
                .unwrap();
            input = ApplyApprovedPatchArtifactInput {
                repository_id: "repo-apply".to_string(),
                proposed_change_id: "proposal-apply".to_string(),
                approval_request_id: "approval-apply".to_string(),
                patch_artifact_id: "artifact-apply".to_string(),
                confirmation_phrase: "apply patch".to_string(),
            };
            let wrong_confirmation =
                apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input).await;
            assert_eq!(
                wrong_confirmation.unwrap_err().code,
                "confirmation_required"
            );
            assert!(!repository_path.join("generated.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn safe_apply_rejects_stale_failed_and_unsafe_artifacts() {
        tauri::async_runtime::block_on(async {
            for (name, expected_code, mutation) in [
                ("stale", "stale_artifact", "stale"),
                ("failed-dry-run", "dry_run_required", "failed"),
                ("traversal", "forbidden_path", "traversal"),
                ("forbidden", "forbidden_path", "forbidden"),
            ] {
                let repository_path = create_temp_dir(&format!("safe-apply-{name}"));
                init_git_repo(&repository_path);
                commit_test_file(&repository_path, "README.md", "fixture\n");
                let pool = create_apply_test_pool().await;
                let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
                mutate_apply_artifact(&pool, |artifacts| {
                    let artifact = artifacts[0].as_object_mut().unwrap();
                    match mutation {
                        "stale" => {
                            artifact.insert(
                                "rawDiff".to_string(),
                                json!("diff --git a/generated.txt b/generated.txt\n--- /dev/null\n+++ b/generated.txt\n@@ -0,0 +1 @@\n+changed after validation\n"),
                            );
                        }
                        "failed" => {
                            artifact.insert(
                                "validationStatus".to_string(),
                                json!("dry_run_failed"),
                            );
                        }
                        "traversal" => {
                            artifact.insert("filePath".to_string(), json!("../outside.txt"));
                        }
                        "forbidden" => {
                            artifact.insert("filePath".to_string(), json!(".env"));
                        }
                        _ => unreachable!(),
                    }
                })
                .await;

                let lock_directory = test_apply_lock_directory(&repository_path);
                let result =
                    apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input).await;
                assert_eq!(result.unwrap_err().code, expected_code);
                assert!(!repository_path.join("generated.txt").exists());
                assert!(!repository_path
                    .parent()
                    .unwrap()
                    .join("outside.txt")
                    .exists());
                remove_temp_dir(&repository_path);
            }
        });
    }

    #[test]
    fn safe_apply_blocks_when_a_complete_backup_cannot_be_created() {
        let repository_path = create_temp_dir("safe-apply-backup-block");
        init_git_repo(&repository_path);
        fs::write(repository_path.join("large.txt"), vec![b'x'; 32]).unwrap();
        let fingerprint = TargetFileFingerprint {
            path: "large.txt".to_string(),
            exists: true,
            size_bytes: Some(32),
            modified_at: None,
            content_sha256: None,
            status: "too_large".to_string(),
            reason: Some("Outside backup policy.".to_string()),
        };

        let result = create_apply_backup(&repository_path, "large.txt", "modify", &fingerprint);

        assert_eq!(result.unwrap_err().code, "backup_unavailable");
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn safe_apply_backup_captures_bounded_text_and_content_hash() {
        let repository_path = create_temp_dir("safe-apply-backup-content");
        init_git_repo(&repository_path);
        fs::write(repository_path.join("safe.txt"), "before apply\n").unwrap();
        let canonical_repository_path = fs::canonicalize(&repository_path).unwrap();
        let fingerprint = fingerprint_target_file(&canonical_repository_path, "safe.txt");

        let backup = create_apply_backup(
            &canonical_repository_path,
            "safe.txt",
            "modify",
            &fingerprint,
        )
        .expect("capture bounded backup");

        assert!(backup.existed_before_apply);
        assert_eq!(backup.content.as_deref(), Some("before apply\n"));
        assert_eq!(backup.content_sha256, fingerprint.content_sha256);
        remove_temp_dir(&repository_path);
    }

    #[cfg(unix)]
    #[test]
    fn safe_apply_rejects_symlinked_and_missing_parent_directories() {
        use std::os::unix::fs::symlink;

        let repository_path = create_temp_dir("safe-apply-parent-boundary");
        let outside_path = create_temp_dir("safe-apply-parent-outside");
        init_git_repo(&repository_path);
        symlink(&outside_path, repository_path.join("linked")).unwrap();

        let symlink_result = validate_apply_target_boundary(&repository_path, "linked/new.txt");
        let missing_result = validate_apply_target_boundary(&repository_path, "missing/new.txt");

        assert_eq!(symlink_result.unwrap_err().code, "outside_repository");
        assert_eq!(missing_result.unwrap_err().code, "parent_unavailable");
        remove_temp_dir(&repository_path);
        remove_temp_dir(&outside_path);
    }

    fn assert_modify_apply_verifies_for_target(label: &str, file_path: &str) {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir(label);
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, file_path, "old\n");
            let head_before = git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]);
            let pool = create_apply_test_pool().await;
            let raw_diff = format!(
                "diff --git a/{file_path} b/{file_path}\n--- a/{file_path}\n+++ b/{file_path}\n@@ -1 +1 @@\n-old\n+new\n"
            );
            let input = seed_apply_test_records_for(
                &pool,
                &repository_path,
                "approved",
                file_path,
                "modify",
                &raw_diff,
            )
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .unwrap_or_else(|error| panic!("apply {file_path} failed: {}", error.code));

            assert_eq!(
                fs::read_to_string(repository_path.join(file_path)).unwrap(),
                "new\n"
            );
            // git quotes this path in porcelain output. Before the parser
            // unquoted it, the patch applied correctly and was then reported as
            // an unaccountable write.
            assert_eq!(result.status, "applied_verified");
            assert_eq!(result.post_apply_verification.status, "applied_verified");
            assert_eq!(
                result.post_apply_verification.observed_changed_paths,
                vec![file_path.to_string()]
            );
            assert!(result.post_apply_verification.unexpected_paths.is_empty());
            assert!(result
                .post_apply_verification
                .missing_expected_paths
                .is_empty());
            assert_eq!(result.post_apply_git_status.staged_count, 0);
            assert_eq!(
                git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]),
                head_before
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn safe_apply_verifies_a_modify_patch_with_a_spaced_target_filename() {
        assert_modify_apply_verifies_for_target("safe-apply-spaced", "My Notes.md");
    }

    #[test]
    fn safe_apply_verifies_a_modify_patch_with_a_non_ascii_target_filename() {
        assert_modify_apply_verifies_for_target("safe-apply-non-ascii", "café.txt");
    }

    #[test]
    fn safe_apply_verifies_a_modify_patch_against_a_tracked_file() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-modify");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "safe.txt", "old\n");
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let head_before = git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]);
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records_for(
                &pool,
                &repository_path,
                "approved",
                "safe.txt",
                "modify",
                "diff --git a/safe.txt b/safe.txt\n--- a/safe.txt\n+++ b/safe.txt\n@@ -1 +1 @@\n-old\n+new\n",
            )
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply approved modify patch");

            assert_eq!(
                fs::read_to_string(repository_path.join("safe.txt")).unwrap(),
                "new\n"
            );
            assert_eq!(
                fs::read_to_string(repository_path.join("README.md")).unwrap(),
                "fixture\n"
            );
            // An unstaged modification is the one status shape that carries a
            // leading space in porcelain v1, so the observed path must survive
            // parsing intact rather than arriving truncated.
            assert_eq!(result.status, "applied_verified");
            assert_eq!(result.post_apply_verification.status, "applied_verified");
            assert_eq!(
                result.post_apply_verification.observed_changed_paths,
                vec!["safe.txt"]
            );
            assert!(result.post_apply_verification.unexpected_paths.is_empty());
            assert!(result
                .post_apply_verification
                .missing_expected_paths
                .is_empty());
            assert_eq!(result.post_apply_git_status.staged_count, 0);
            assert_eq!(result.post_apply_git_status.unstaged_count, 1);
            assert_eq!(
                git_output(
                    repository_path.to_str().unwrap(),
                    &["diff", "--cached", "--name-only"],
                )
                .unwrap_or_default(),
                ""
            );
            assert_eq!(
                git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]),
                head_before
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn safe_apply_creates_backup_and_changes_only_the_expected_working_tree_file() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-success");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let head_before = git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]);
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply approved patch");

            assert_eq!(
                fs::read_to_string(repository_path.join("generated.txt")).unwrap(),
                "safe generated content\n"
            );
            assert_eq!(
                fs::read_to_string(repository_path.join("README.md")).unwrap(),
                "fixture\n"
            );
            assert_eq!(
                git_output(
                    repository_path.to_str().unwrap(),
                    &["diff", "--cached", "--name-only"],
                )
                .unwrap_or_default(),
                ""
            );
            assert_eq!(
                git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"],),
                head_before
            );
            assert_eq!(result.status, "applied_verified");
            assert_eq!(result.post_apply_verification.status, "applied_verified");
            assert_eq!(
                result.post_apply_verification.observed_changed_paths,
                vec!["generated.txt"]
            );
            assert_eq!(result.post_apply_git_status.changed_file_count, 1);
            assert_eq!(result.post_apply_git_status.untracked_count, 1);

            let backup_row = sqlx::query("SELECT files_json FROM patch_apply_backups WHERE id = ?")
                .bind(&result.backup_id)
                .fetch_one(&pool)
                .await
                .expect("persisted backup");
            let backup_json: String = backup_row.try_get("files_json").unwrap();
            assert!(backup_json.contains("\"existedBeforeApply\":false"));
            assert!(backup_json.contains("\"path\":\"generated.txt\""));

            let proposal_row = sqlx::query(
                "SELECT status, patch_artifacts_json FROM proposed_changes WHERE id = 'proposal-apply'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(
                proposal_row.try_get::<String, _>("status").unwrap(),
                "applied"
            );
            let artifacts_json: String = proposal_row.try_get("patch_artifacts_json").unwrap();
            assert!(artifacts_json.contains("\"applyStatus\":\"applied_verified\""));
            assert!(artifacts_json.contains("\"postApplyVerification\""));
            assert!(artifacts_json.contains("\"backupId\""));
            let attempt_row = sqlx::query(
                "SELECT status, post_apply_verification_json FROM patch_apply_attempts WHERE id = ?",
            )
            .bind(&result.apply_attempt_id)
            .fetch_one(&pool)
            .await
            .expect("persisted apply attempt verification");
            assert_eq!(
                attempt_row.try_get::<String, _>("status").unwrap(),
                "applied_verified"
            );
            let verification_json: String =
                attempt_row.try_get("post_apply_verification_json").unwrap();
            assert!(verification_json.contains("\"status\":\"applied_verified\""));
            assert!(verification_json.contains("\"expectedPaths\":[\"generated.txt\"]"));
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn post_apply_quarantine_persists_evidence_and_blocks_reapply() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("post-apply-quarantine");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply disposable fixture patch");
            let unexpected_status =
                post_apply_status(&[("generated.txt", "??"), ("unexpected.txt", "??")], 0);
            let parsed_paths = BTreeSet::from(["generated.txt".to_string()]);
            let verification = verify_post_apply_changed_paths(
                "generated.txt",
                "generated.txt",
                &parsed_paths,
                "generated.txt",
                "generated.txt",
                &unexpected_status,
            );
            assert_eq!(verification.status, "quarantine_required");

            persist_reconciled_artifact(
                &pool,
                "proposal-apply",
                "artifact-apply",
                "quarantine_required",
                Some(&result.backup_id),
                Some(&verification.message),
                Some(&unexpected_status),
            )
            .await
            .expect("persist quarantined artifact");
            persist_reconciled_attempt(
                &pool,
                &result.apply_attempt_id,
                "quarantine_required",
                Some(&verification.message),
                None,
                Some(&unexpected_status),
            )
            .await
            .expect("persist quarantined attempt");
            persist_reconciled_post_apply_verification(
                &pool,
                "proposal-apply",
                "artifact-apply",
                &result.apply_attempt_id,
                &verification,
            )
            .await
            .expect("persist quarantine path evidence");

            let attempt_status: String =
                sqlx::query_scalar("SELECT status FROM patch_apply_attempts WHERE id = ?")
                    .bind(&result.apply_attempt_id)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            let proposal_row = sqlx::query(
                "SELECT status, patch_artifacts_json FROM proposed_changes WHERE id = 'proposal-apply'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            let proposal_status: String = proposal_row.try_get("status").unwrap();
            let artifacts_json: String = proposal_row.try_get("patch_artifacts_json").unwrap();
            assert_eq!(attempt_status, "quarantine_required");
            assert_eq!(proposal_status, "quarantine_required");
            assert!(artifacts_json.contains("\"applyStatus\":\"quarantine_required\""));
            assert!(artifacts_json.contains("\"unexpectedPaths\":[\"unexpected.txt\"]"));

            let blocked = acquire_repository_apply_lock(
                &pool,
                &lock_directory,
                "repo-apply",
                "artifact-apply",
                "apply_patch",
            )
            .await
            .unwrap_err();
            assert_eq!(blocked.code, "unresolved_apply_attempt");
            assert!(repository_path.join("generated.txt").exists());
            assert!(!repository_path.join("unexpected.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn reconciliation_repairs_a_clearly_applied_attempt_with_a_spaced_target() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("reconcile-spaced-target");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "My Notes.md", "old\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records_for(
                &pool,
                &repository_path,
                "approved",
                "My Notes.md",
                "modify",
                "diff --git a/My Notes.md b/My Notes.md\n--- a/My Notes.md\n+++ b/My Notes.md\n@@ -1 +1 @@\n-old\n+new\n",
            )
            .await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply spaced-target patch");
            reset_successful_apply_to_unfinished(&pool, &result, false, false).await;

            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile applied attempt");
            let attempt = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == result.apply_attempt_id)
                .expect("reconciled attempt");

            // target_changed compares the observed status path with the artifact
            // path. While the observed path arrived quoted it never matched, so a
            // genuinely applied patch could not reach `applied` and stuck at
            // needs_inspection -- wrong in fact and permanently blocking.
            assert_eq!(attempt.status, "applied_verified");
            // The audit-evidence consumers (pre-apply and failure snapshots) feed
            // git_status_evidence_changed, which compares whole status JSON. Both
            // sides are produced by the same parser, so unquoting keeps them
            // comparing like with like: a spaced target still reads as changed.
            assert_eq!(attempt.current_git_status_changed, Some(true));
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn reconciliation_repairs_clearly_applied_disposable_repository_attempt() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("reconcile-clearly-applied");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let head_before = git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]);
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply fixture patch");
            reset_successful_apply_to_unfinished(&pool, &result, false, false).await;
            sqlx::query(
                "INSERT INTO patch_apply_locks (id, repository_id, process_id, operation, patch_artifact_id, status, started_at, stale_after) VALUES ('crashed-process-lock', 'repo-apply', 999999, 'apply_patch', 'artifact-apply', 'active', '1', 2)",
            )
            .execute(&pool)
            .await
            .expect("insert abandoned apply lock");

            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile applied attempt");
            let attempt = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == result.apply_attempt_id)
                .expect("reconciled attempt");

            assert_eq!(attempt.status, "applied_verified");
            assert_eq!(attempt.current_git_status_changed, Some(true));
            assert_eq!(
                attempt
                    .post_apply_verification
                    .as_ref()
                    .map(|verification| verification.status.as_str()),
                Some("applied_verified")
            );
            let stale_lock_status: String = sqlx::query_scalar(
                "SELECT status FROM patch_apply_locks WHERE id = 'crashed-process-lock'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(stale_lock_status, "stale");
            assert_eq!(
                fs::read_to_string(repository_path.join("generated.txt")).unwrap(),
                "safe generated content\n"
            );
            assert_eq!(
                git_output(
                    repository_path.to_str().unwrap(),
                    &["diff", "--cached", "--name-only"],
                )
                .unwrap_or_default(),
                ""
            );
            assert_eq!(
                git_output(repository_path.to_str().unwrap(), &["rev-parse", "HEAD"]),
                head_before
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn reconciliation_marks_untouched_disposable_repository_attempt_failed() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("reconcile-untouched");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply fixture patch");
            fs::remove_file(repository_path.join("generated.txt")).unwrap();
            reset_successful_apply_to_unfinished(&pool, &result, false, false).await;

            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile untouched attempt");
            let attempt = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == result.apply_attempt_id)
                .expect("reconciled attempt");

            assert_eq!(attempt.status, "failed");
            assert_eq!(attempt.current_git_status_changed, Some(false));
            assert!(!repository_path.join("generated.txt").exists());
            let proposal_row = sqlx::query(
                "SELECT patch_artifacts_json FROM proposed_changes WHERE id = 'proposal-apply'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            let artifacts_json: String = proposal_row.try_get("patch_artifacts_json").unwrap();
            assert!(artifacts_json.contains("\"applyStatus\":\"apply_failed\""));
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn reconciliation_marks_incomplete_evidence_interrupted_without_retry() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("reconcile-incomplete");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply fixture patch");
            fs::remove_file(repository_path.join("generated.txt")).unwrap();
            reset_successful_apply_to_unfinished(&pool, &result, true, true).await;

            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile incomplete attempt");
            let attempt = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == result.apply_attempt_id)
                .expect("reconciled attempt");

            assert_eq!(attempt.status, "interrupted");
            assert!(attempt.message.contains("Manual inspection"));
            assert!(!repository_path.join("generated.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn reconciliation_defaults_ambiguous_disposable_repository_to_manual_inspection() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("reconcile-ambiguous");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("apply fixture patch");
            fs::write(
                repository_path.join("generated.txt"),
                "ambiguous manual content\n",
            )
            .unwrap();
            reset_successful_apply_to_unfinished(&pool, &result, false, false).await;

            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile ambiguous attempt");
            let attempt = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == result.apply_attempt_id)
                .expect("reconciled attempt");

            assert_eq!(attempt.status, "needs_inspection");
            assert_eq!(attempt.current_git_status_changed, Some(true));
            assert_eq!(
                fs::read_to_string(repository_path.join("generated.txt")).unwrap(),
                "ambiguous manual content\n"
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn repository_snapshot_fingerprints_are_bounded_and_detect_target_changes() {
        let repository_path = create_temp_dir("repository-fingerprints");
        init_git_repo(&repository_path);
        fs::write(repository_path.join("safe.txt"), "hello\n").expect("write safe file");
        fs::write(repository_path.join("binary.bin"), [0_u8, 159, 146, 150])
            .expect("write binary file");
        fs::write(
            repository_path.join("large.txt"),
            vec![b'x'; MAX_FINGERPRINT_BYTES as usize + 1],
        )
        .expect("write large file");
        fs::write(repository_path.join(".env"), "SECRET=hidden").expect("write forbidden file");
        let input = RepositorySnapshotInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            artifact_digest: "b".repeat(64),
            relevant_file_paths: vec![
                "safe.txt".to_string(),
                "binary.bin".to_string(),
                "large.txt".to_string(),
                ".env".to_string(),
                "missing.txt".to_string(),
            ],
        };

        let first_snapshot =
            load_repository_validation_snapshot(input).expect("capture first repository snapshot");
        let fingerprint_status = |path: &str| {
            first_snapshot
                .target_file_fingerprints
                .iter()
                .find(|fingerprint| fingerprint.path == path)
                .map(|fingerprint| fingerprint.status.as_str())
        };

        assert_eq!(fingerprint_status("safe.txt"), Some("captured"));
        assert_eq!(fingerprint_status("binary.bin"), Some("binary"));
        assert_eq!(fingerprint_status("large.txt"), Some("too_large"));
        assert_eq!(fingerprint_status(".env"), Some("forbidden"));
        assert_eq!(fingerprint_status("missing.txt"), Some("missing"));
        let safe_fingerprint = first_snapshot
            .target_file_fingerprints
            .iter()
            .find(|fingerprint| fingerprint.path == "safe.txt")
            .expect("safe fingerprint");
        let forbidden_fingerprint = first_snapshot
            .target_file_fingerprints
            .iter()
            .find(|fingerprint| fingerprint.path == ".env")
            .expect("forbidden fingerprint");
        assert_eq!(
            safe_fingerprint.content_sha256.as_deref(),
            Some("5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
        );
        assert!(forbidden_fingerprint.content_sha256.is_none());
        let first_digest = first_snapshot
            .repository_snapshot_digest
            .expect("first snapshot digest");

        fs::write(repository_path.join("safe.txt"), "changed\n").expect("change safe file");
        let second_snapshot = load_repository_validation_snapshot(RepositorySnapshotInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            artifact_digest: "b".repeat(64),
            relevant_file_paths: vec![
                "safe.txt".to_string(),
                "binary.bin".to_string(),
                "large.txt".to_string(),
                ".env".to_string(),
                "missing.txt".to_string(),
            ],
        })
        .expect("capture second repository snapshot");

        assert_ne!(
            first_digest,
            second_snapshot
                .repository_snapshot_digest
                .expect("second snapshot digest")
        );
        let traversal_result = load_repository_validation_snapshot(RepositorySnapshotInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            artifact_digest: "b".repeat(64),
            relevant_file_paths: vec!["../outside.txt".to_string()],
        });
        let absolute_result = load_repository_validation_snapshot(RepositorySnapshotInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            artifact_digest: "b".repeat(64),
            relevant_file_paths: vec!["/tmp/outside.txt".to_string()],
        });

        assert!(traversal_result.is_err());
        assert!(absolute_result.is_err());
        remove_temp_dir(&repository_path);
    }

    #[cfg(unix)]
    #[test]
    fn repository_snapshot_does_not_follow_target_symlinks_outside_root() {
        use std::os::unix::fs::symlink;

        let repository_path = create_temp_dir("repository-fingerprint-symlink");
        let outside_path = create_temp_dir("repository-fingerprint-outside");
        init_git_repo(&repository_path);
        fs::write(outside_path.join("secret.txt"), "outside secret").expect("write outside file");
        symlink(
            outside_path.join("secret.txt"),
            repository_path.join("linked.txt"),
        )
        .expect("create target symlink");

        let snapshot = load_repository_validation_snapshot(RepositorySnapshotInput {
            repository_id: "repo-test".to_string(),
            repository_path: repository_path.to_string_lossy().to_string(),
            artifact_digest: "c".repeat(64),
            relevant_file_paths: vec!["linked.txt".to_string()],
        })
        .expect("capture symlink snapshot");
        let fingerprint = &snapshot.target_file_fingerprints[0];

        assert_eq!(fingerprint.status, "unavailable");
        assert!(fingerprint.content_sha256.is_none());
        remove_temp_dir(&repository_path);
        remove_temp_dir(&outside_path);
    }

    #[test]
    fn generated_patch_dry_run_fails_cleanly_when_target_content_is_missing() {
        let repository_path = create_temp_dir("patch-dry-run-fail");
        init_git_repo(&repository_path);
        let raw_diff = "diff --git a/missing.txt b/missing.txt\n--- a/missing.txt\n+++ b/missing.txt\n@@ -1 +1 @@\n-old\n+new";
        let input =
            test_patch_validation_input(&repository_path, "missing.txt", "modify", raw_diff);

        let result = validate_generated_patch(input);

        assert_eq!(result.status, "dry_run_failed");
        assert!(!repository_path.join("missing.txt").exists());
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn generated_patch_keeps_valid_structure_when_repository_is_not_git() {
        let repository_path = create_temp_dir("patch-dry-run-unavailable");
        let raw_diff = "diff --git a/new-file.txt b/new-file.txt\n--- /dev/null\n+++ b/new-file.txt\n@@ -0,0 +1 @@\n+review only";
        let input =
            test_patch_validation_input(&repository_path, "new-file.txt", "create", raw_diff);

        let result = validate_generated_patch(input);

        assert_eq!(result.status, "valid_structure");
        assert!(!repository_path.join("new-file.txt").exists());
        remove_temp_dir(&repository_path);
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
    fn git_diff_resolves_for_quoted_paths_as_the_status_parser_reports_them() {
        let repository = create_temp_dir("git-diff-quoted-paths");
        init_git_repo(&repository);
        commit_test_file(&repository, "My Notes.md", "old\n");
        commit_test_file(&repository, "café.txt", "old\n");
        fs::write(repository.join("My Notes.md"), "new\n").unwrap();
        fs::write(repository.join("café.txt"), "new\n").unwrap();

        // Changes feeds these paths straight from the status summary into the
        // diff loader. While the parser reported the quoted form, the loader was
        // handed `"My Notes.md"` and git matched no such path, so the diff came
        // back empty. Unquoting has to make the whole chain resolve, not just the
        // verification comparison.
        let summary = load_git_status_summary(
            "repo-diff".to_string(),
            repository.to_string_lossy().to_string(),
        );
        assert_eq!(summary.files.len(), 2);

        for file in &summary.files {
            let diff = load_git_file_diff(
                "repo-diff".to_string(),
                repository.to_string_lossy().to_string(),
                file.path.clone(),
                file.stage.clone(),
                file.kind.clone(),
                file.old_path.clone(),
            );

            assert_eq!(diff.kind, "unstaged", "diff kind for {}", file.path);
            assert_eq!(diff.additions, 1, "additions for {}", file.path);
            assert_eq!(diff.deletions, 1, "deletions for {}", file.path);
            assert!(
                diff.raw_diff.is_some(),
                "raw diff missing for {}",
                file.path
            );
        }

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
    fn bounded_capture_terminates_a_child_that_exceeds_its_deadline() {
        let repository_path = create_temp_dir("bounded-capture-timeout");
        let started_at = Instant::now();

        // Only the fixed apply command had a deadline. Any status or diff read
        // could hang forever, and rollback has to read git status to verify what
        // it restored.
        let output = run_bounded_capture(
            "sleep",
            repository_path.to_str().unwrap(),
            &["30"],
            Duration::from_millis(250),
        );

        assert!(output.is_none());
        assert!(
            started_at.elapsed() < Duration::from_secs(5),
            "the child was not terminated at its deadline"
        );
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn bounded_capture_drains_output_larger_than_a_pipe_buffer() {
        let repository_path = create_temp_dir("bounded-capture-large");
        init_git_repo(&repository_path);
        // Comfortably past a 64 KiB pipe buffer: waiting on the child before
        // draining its stdout would deadlock here.
        for index in 0..4_000 {
            fs::write(repository_path.join(format!("file-{index:05}.txt")), "x\n").unwrap();
        }

        let summary = load_git_status_summary(
            "repo-large".to_string(),
            repository_path.to_string_lossy().to_string(),
        );

        assert_eq!(summary.changed_file_count, 4_000);
        assert_eq!(summary.files.len(), 4_000);
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn bounded_capture_reports_a_failing_command_as_unavailable() {
        let repository_path = create_temp_dir("bounded-capture-fail");

        // Not a git repository: git exits non-zero and the caller must see None
        // rather than empty output.
        assert!(git_output(
            repository_path.to_str().unwrap(),
            &["status", "--porcelain=v1"]
        )
        .is_none());
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn porcelain_paths_are_unquoted_and_unescaped() {
        // git quotes and C-escapes any path containing a space, a non-ASCII
        // byte, a quote, or a backslash. Taking the quoted form literally is
        // what makes a correctly applied patch fail exact-path verification.
        let spaced = parse_porcelain_line(" M \"with space.txt\"").unwrap();
        assert_eq!(spaced.path, "with space.txt");

        let accented = parse_porcelain_line("?? \"caf\\303\\251.txt\"").unwrap();
        assert_eq!(accented.path, "café.txt");

        let quoted_name = parse_porcelain_line(" M \"say \\\"hi\\\".txt\"").unwrap();
        assert_eq!(quoted_name.path, "say \"hi\".txt");

        let backslash = parse_porcelain_line(" M \"back\\\\slash.txt\"").unwrap();
        assert_eq!(backslash.path, "back\\slash.txt");
    }

    #[test]
    fn porcelain_rejects_a_path_with_control_characters() {
        // Unquoting a \t yields a real control character, which the path check
        // rejects. The line is dropped, and the raw status line count turns that
        // drop into a quarantine rather than an invisible omission -- the same
        // mechanism every other rejection uses.
        assert!(parse_porcelain_line(" M \"tab\\there.txt\"").is_none());
    }

    #[test]
    fn porcelain_unquoted_paths_are_unchanged() {
        let plain = parse_porcelain_line(" M plain.txt").unwrap();
        assert_eq!(plain.path, "plain.txt");
        // core.quotepath=false emits raw UTF-8 without quotes.
        let raw_utf8 = parse_porcelain_line("?? café.txt").unwrap();
        assert_eq!(raw_utf8.path, "café.txt");
    }

    #[test]
    fn porcelain_unquotes_both_sides_of_a_rename() {
        let renamed = parse_porcelain_line("R  \"old name.txt\" -> \"new name.txt\"").unwrap();
        assert_eq!(renamed.old_path.as_deref(), Some("old name.txt"));
        assert_eq!(renamed.path, "new name.txt");
    }

    #[test]
    fn porcelain_rejects_a_path_that_is_not_valid_utf8() {
        // \351 is Latin-1 'é': a legal POSIX filename that is not valid UTF-8.
        // Lossy conversion would yield U+FFFD, producing a path that silently
        // does not match -- the exact bug this fix removes, wearing a different
        // hat. Rejecting is only fail-closed because the raw line count makes
        // the dropped line visible; see parse_git_status_lines.
        assert!(parse_porcelain_line("?? \"caf\\351.txt\"").is_none());
    }

    #[test]
    fn porcelain_rejects_malformed_escapes() {
        assert!(parse_porcelain_line("?? \"trailing\\\"").is_none());
        assert!(parse_porcelain_line("?? \"bad\\9.txt\"").is_none());
    }

    #[test]
    fn git_status_reports_a_dropped_line_through_the_changed_file_count() {
        let repository_path = create_temp_dir("git-status-dropped-line");
        init_git_repo(&repository_path);
        // A tab is legal in a POSIX filename. git reports it quoted as "\t",
        // unquoting yields a real control character, and the path check rejects
        // it -- so the line is dropped from `files`. The count must still see it.
        fs::write(repository_path.join("tab\there.txt"), "x\n").expect("write tabbed file");

        let summary = load_git_status_summary(
            "repo-dropped".to_string(),
            repository_path.to_string_lossy().to_string(),
        );

        assert_eq!(summary.files.len(), 0);
        assert_eq!(summary.changed_file_count, 1);
        assert!(!summary.is_clean);
        remove_temp_dir(&repository_path);
    }

    #[test]
    fn git_status_counts_every_line_even_when_one_cannot_be_parsed() {
        // A rejected line must not vanish. filter_map drops it from `files`, so
        // the count has to come from the raw status output; otherwise a changed
        // path the app cannot represent becomes invisible to verification.
        let (files, line_count) = parse_git_status_lines("?? ok.txt\n?? \"caf\\351.txt\"");

        assert_eq!(files.len(), 1);
        assert_eq!(line_count, 2);
    }

    #[test]
    fn post_apply_verification_quarantines_when_a_status_line_was_dropped() {
        let status = GitStatusSummary {
            repository_id: "repo".to_string(),
            repository_path: "/tmp/repo".to_string(),
            branch: Some("main".to_string()),
            head_sha: Some("abc1234".to_string()),
            is_git_repository: true,
            is_clean: false,
            // Two status lines, one of which could not be parsed.
            changed_file_count: 2,
            staged_count: 0,
            unstaged_count: 1,
            untracked_count: 0,
            conflicted_count: 0,
            files: vec![GitChangedFile {
                path: "safe.txt".to_string(),
                old_path: None,
                kind: "modified".to_string(),
                stage: "unstaged".to_string(),
                status_code: " M".to_string(),
            }],
            refreshed_at: "1783532400".to_string(),
        };

        let verification = verify_post_apply_changed_paths(
            "safe.txt",
            "safe.txt",
            &BTreeSet::from(["safe.txt".to_string()]),
            "safe.txt",
            "safe.txt",
            &status,
        );

        assert_eq!(verification.status, "quarantine_required");
    }

    #[test]
    fn safe_relative_path_rejects_control_characters() {
        assert!(!is_safe_relative_path("bad\nname.txt"));
        assert!(!is_safe_relative_path("bad\tname.txt"));
        assert!(!is_safe_relative_path("bad\u{7f}name.txt"));
        // A quote is legal in a filename and must still pass: the quoted-vs-real
        // ambiguity is only resolvable at the parse boundary, not here.
        assert!(is_safe_relative_path("say \"hi\".txt"));
        assert!(is_safe_relative_path("My Notes.md"));
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

    /// End-to-end rollback of a modify patch, through a spaced filename.
    ///
    /// The spaced path is the point: git reports it quoted in porcelain output,
    /// so this exercises the #3 parser on every status read rollback performs.
    #[test]
    fn rollback_restores_the_pre_apply_contents_of_a_spaced_path() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-modify-spaced");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect("roll back the verified apply");

            assert_eq!(result.status, "rolled_back");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_PRE_APPLY_CONTENT,
                "the target must hold exactly its pre-apply bytes"
            );
            // Apply required a clean tree, so the pre-apply content was HEAD's
            // content: restoring it returns the path to clean and it leaves
            // `git status` entirely.
            assert!(result.post_rollback_git_status.is_clean);
            assert!(result
                .post_rollback_verification
                .observed_changed_paths
                .is_empty());
            assert_eq!(artifact_apply_status(&pool).await, "rolled_back");
            assert_eq!(proposal_status(&pool).await, "rolled_back");

            // The destroyed bytes are retained in their own table, never in
            // `patch_apply_backups`.
            let backup_row =
                sqlx::query("SELECT files_json FROM patch_rollback_backups WHERE id = ?")
                    .bind(&result.rollback_backup_id)
                    .fetch_one(&pool)
                    .await
                    .expect("load the pre-rollback backup");
            let stored: String = backup_row.try_get("files_json").unwrap();
            assert!(
                stored.contains("patched line"),
                "the pre-rollback backup must retain the bytes rollback destroyed"
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// Rolling back a create deletes the file: it did not exist before the apply,
    /// so there are no previous contents to restore.
    #[test]
    fn rollback_of_a_create_operation_deletes_the_file() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-create");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_create(&pool, &repository_path).await;
            assert!(repository_path.join("generated.txt").exists());

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect("roll back the created file");

            assert_eq!(result.status, "rolled_back");
            assert!(
                !repository_path.join("generated.txt").exists(),
                "a create rollback must delete the file it created"
            );
            assert!(result.post_rollback_git_status.is_clean);
            remove_temp_dir(&repository_path);
        });
    }

    /// The load-bearing safety rule: rollback must not overwrite user edits made
    /// after the apply.
    #[test]
    fn rollback_refuses_a_target_edited_after_apply() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-drift");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            fs::write(
                repository_path.join(ROLLBACK_TARGET),
                "the user edited this after the apply\n",
            )
            .expect("simulate a user edit after apply");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a drifted target must never be overwritten");

            assert_eq!(error.code, "target_drifted");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                "the user edited this after the apply\n",
                "the refused rollback must not have touched the user's edit"
            );
            assert_eq!(artifact_apply_status(&pool).await, "applied_verified");
            remove_temp_dir(&repository_path);
        });
    }

    /// A deletion is a user edit. Restoring would resurrect a file they removed,
    /// and we cannot tell "the user deleted it" from "something else did".
    #[test]
    fn rollback_refuses_a_target_deleted_after_apply() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-deleted");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            fs::remove_file(repository_path.join(ROLLBACK_TARGET)).expect("delete the target");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a deleted target must not be resurrected");

            assert_eq!(error.code, "target_missing");
            assert!(!repository_path.join(ROLLBACK_TARGET).exists());
            remove_temp_dir(&repository_path);
        });
    }

    /// Apply persists its baseline best-effort, so an artifact can be
    /// `applied_verified` with nothing to compare against. With no baseline no
    /// drift check is possible, and rollback's whole safety rule depends on one.
    #[test]
    fn rollback_refuses_an_artifact_with_no_post_apply_baseline() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-no-baseline");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            let applied = seed_and_apply_modify(&pool, &repository_path).await;
            sqlx::query(
                "UPDATE patch_apply_attempts SET post_apply_evidence_json = NULL WHERE id = ?",
            )
            .bind(&applied.apply_attempt_id)
            .execute(&pool)
            .await
            .expect("simulate apply's fire-and-forget baseline persist failing");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("no baseline means no rollback");

            assert_eq!(error.code, "baseline_unavailable");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// Staging does not alter content, so the drift check passes — but we never
    /// touch the index, and restoring under a staged entry would leave the index
    /// and working tree disagreeing.
    #[test]
    fn rollback_refuses_a_staged_target() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-staged-target");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            git_in(&repository_path, &["add", "--", ROLLBACK_TARGET]);

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a staged target must be refused");

            assert_eq!(error.code, "target_staged");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// If the user committed the applied change, the apply is now history and
    /// writing pre-apply bytes is a new modification rather than an undo.
    #[test]
    fn rollback_refuses_after_head_moved() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-head-moved");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            git_in(&repository_path, &["add", "--", ROLLBACK_TARGET]);
            git_in(
                &repository_path,
                &[
                    "-c",
                    "user.name=AI Workspace Test",
                    "-c",
                    "user.email=test@example.invalid",
                    "commit",
                    "-m",
                    "user committed the applied patch",
                ],
            );

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a moved HEAD must be refused");

            assert_eq!(error.code, "head_changed");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn rollback_refuses_after_the_branch_changed() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-branch-changed");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            // Leaves HEAD and the working tree alone, so only the branch differs.
            git_in(
                &repository_path,
                &["checkout", "-q", "-b", "another-branch"],
            );

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a changed branch must be refused");

            assert_eq!(error.code, "branch_changed");
            remove_temp_dir(&repository_path);
        });
    }

    /// A corrupt backup must never be written over a real file.
    #[test]
    fn rollback_refuses_a_pre_apply_backup_that_fails_its_integrity_check() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-corrupt-backup");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            let applied = seed_and_apply_modify(&pool, &repository_path).await;
            let tampered = json!([{
                "path": ROLLBACK_TARGET,
                "existedBeforeApply": true,
                "contentSha256": sha256_hex(ROLLBACK_PRE_APPLY_CONTENT.as_bytes()),
                "content": "silently corrupted backup bytes\n",
            }]);
            sqlx::query("UPDATE patch_apply_backups SET files_json = ? WHERE id = ?")
                .bind(tampered.to_string())
                .bind(&applied.backup_id)
                .execute(&pool)
                .await
                .expect("corrupt the stored backup content");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a corrupt backup must never be restored");

            assert_eq!(error.code, "backup_corrupt");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT,
                "the refused rollback must not have written corrupt bytes"
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// A second rollback is blocked twice over. This proves the first bar: the
    /// artifact status. The drift check independently refuses too, because after
    /// a rollback the file matches the pre-apply content, not the baseline.
    #[test]
    fn rollback_refuses_a_second_rollback() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-double");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect("first rollback");

            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a rolled-back artifact must never be rolled back again");

            assert_eq!(error.code, "not_applied_verified");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_PRE_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn rollback_refuses_an_artifact_that_was_never_applied() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-never-applied");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            seed_apply_test_records(&pool, &repository_path, "approved").await;
            ensure_patch_apply_tables(&pool)
                .await
                .expect("apply tables");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("only a verified apply can be rolled back");

            assert_eq!(error.code, "not_applied_verified");
            remove_temp_dir(&repository_path);
        });
    }

    /// A quarantined apply wrote paths we cannot account for and have no backup
    /// for. Restoring only the declared target would be a partial undo reported
    /// as a rollback — the false account this product exists to prevent.
    #[test]
    fn rollback_refuses_a_quarantined_apply() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-quarantined");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("quarantine_required");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a quarantined apply must never be rolled back");

            assert_eq!(error.code, "not_applied_verified");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn rollback_requires_the_exact_confirmation_phrase() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-confirmation");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            for phrase in ["roll back", "ROLL  BACK", "ROLLBACK", ""] {
                let error = rollback_applied_patch_artifact_with_pool(
                    &pool,
                    &lock_directory,
                    test_rollback_input(phrase),
                )
                .await
                .expect_err("only the exact phrase may confirm a rollback");
                assert_eq!(error.code, "confirmation_required");
            }
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    #[test]
    fn rollback_refuses_while_the_repository_lock_is_held() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-lock-contention");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            let lock_directory = test_apply_lock_directory(&repository_path);
            let _held = try_repository_file_lock(&lock_directory, "repo-apply")
                .expect("take the repository lock")
                .expect("repository lock available");

            let error = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect_err("a held repository lock must block rollback");

            assert_eq!(error.code, "apply_locked");
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_POST_APPLY_CONTENT
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// An interrupted rollback is undeterminable by definition, so it reconciles
    /// straight to quarantine — no probe, no retry, no re-restore.
    #[test]
    fn interrupted_rollback_reconciles_to_quarantine_required() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-interrupted");
            init_git_repo(&repository_path);
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("rolling_back");
            })
            .await;
            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('rollback-dead', 'proposal-apply', 'artifact-apply', 'approval-apply', 'repo-apply', 'rolling_back', '1783532400')",
            )
            .execute(&pool)
            .await
            .expect("seed an abandoned rollback attempt");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let attempts =
                reconcile_interrupted_patch_apply_attempts_with_pool(&pool, &lock_directory)
                    .await
                    .expect("reconcile the abandoned rollback");

            let reconciled = attempts
                .iter()
                .find(|attempt| attempt.apply_attempt_id == "rollback-dead")
                .expect("the abandoned rollback must be seen by reconciliation");
            assert_eq!(reconciled.status, "quarantine_required");
            assert_eq!(artifact_apply_status(&pool).await, "quarantine_required");

            // And it blocks: an abandoned rollback stops every later operation
            // for the repository until a human clears it with INSPECTED.
            let blocked = apply_approved_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                ApplyApprovedPatchArtifactInput {
                    repository_id: "repo-apply".to_string(),
                    proposed_change_id: "proposal-apply".to_string(),
                    approval_request_id: "approval-apply".to_string(),
                    patch_artifact_id: "artifact-apply".to_string(),
                    confirmation_phrase: APPLY_CONFIRMATION_PHRASE.to_string(),
                },
            )
            .await
            .expect_err("an unresolved rollback must block the repository");
            assert_eq!(blocked.code, "unresolved_apply_attempt");
            remove_temp_dir(&repository_path);
        });
    }

    /// A `rolling_back` row blocks before reconciliation ever runs.
    ///
    /// Distinct from the reconciliation test: this proves the *gate* entry, not
    /// the classifier. Without `rolling_back` in the unresolved-attempt list, a
    /// dead rollback would be a state with no exit and no door — an attempt stuck
    /// mid-write, the target unknown, and the repository still accepting applies
    /// as though nothing were pending.
    #[test]
    fn an_unreconciled_rollback_attempt_blocks_the_repository() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-gate-blocks");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            ensure_patch_apply_tables(&pool)
                .await
                .expect("apply tables");
            sqlx::query(
                "INSERT INTO patch_apply_attempts (id, proposed_change_id, patch_artifact_id, approval_request_id, repository_id, status, started_at) VALUES ('rollback-live', 'proposal-apply', 'artifact-apply', 'approval-apply', 'repo-apply', 'rolling_back', '1783532400')",
            )
            .execute(&pool)
            .await
            .expect("seed an in-flight rollback attempt");

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("an in-flight rollback must block the repository");

            assert_eq!(error.code, "unresolved_apply_attempt");
            assert!(!repository_path.join("generated.txt").exists());
            remove_temp_dir(&repository_path);
        });
    }

    /// An observed path we cannot represent fails the whole comparison closed.
    ///
    /// A path we cannot compare is not a path we may ignore: silently dropping it
    /// would let an unaccountable write pass verification.
    #[test]
    fn rollback_path_sets_fail_closed_on_an_unrepresentable_path() {
        let mut status = post_apply_status(&[("safe.txt", "unstaged")], 0);
        assert!(rollback_status_path_sets(&status).is_some());

        status.files.push(GitChangedFile {
            path: "../escaped.txt".to_string(),
            old_path: None,
            kind: "modified".to_string(),
            stage: "unstaged".to_string(),
            status_code: " M".to_string(),
        });

        assert!(
            rollback_status_path_sets(&status).is_none(),
            "an unsafe observed path must fail the comparison closed"
        );
    }

    /// Unrelated dirty and staged files must not turn a correct rollback into a
    /// quarantine.
    ///
    /// The user may dirty or stage files of their own after the apply. Refusing
    /// on those would quarantine a repository where nothing went wrong, and a
    /// false quarantine is a false account — the failure class #3 removed. So the
    /// post-restore expectation is a delta, not "the tree is clean" and not
    /// "nothing is staged": the target leaves the changed set, and the staged set
    /// is untouched.
    #[test]
    fn rollback_tolerates_unrelated_dirty_and_staged_files() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("rollback-unrelated-dirt");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "other.txt", "tracked\n");
            let pool = create_apply_test_pool().await;
            seed_and_apply_modify(&pool, &repository_path).await;

            // The user's own work, after the apply and nothing to do with it.
            fs::write(repository_path.join("other.txt"), "user edited this\n")
                .expect("dirty an unrelated tracked file");
            fs::write(repository_path.join("unrelated.txt"), "user staged this\n")
                .expect("create an unrelated file");
            git_in(&repository_path, &["add", "--", "unrelated.txt"]);

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = rollback_applied_patch_artifact_with_pool(
                &pool,
                &lock_directory,
                test_rollback_input(ROLLBACK_CONFIRMATION_PHRASE),
            )
            .await
            .expect("unrelated user work must not block a provable rollback");

            assert_eq!(
                result.status, "rolled_back",
                "a correct rollback must not be quarantined by the user's unrelated staged work"
            );
            assert_eq!(
                fs::read_to_string(repository_path.join(ROLLBACK_TARGET)).unwrap(),
                ROLLBACK_PRE_APPLY_CONTENT
            );
            // The user's work is untouched.
            assert_eq!(
                fs::read_to_string(repository_path.join("other.txt")).unwrap(),
                "user edited this\n"
            );
            assert_eq!(
                fs::read_to_string(repository_path.join("unrelated.txt")).unwrap(),
                "user staged this\n"
            );
            assert_eq!(
                result.post_rollback_verification.observed_staged_paths,
                vec!["unrelated.txt".to_string()],
                "the user's staged file must still be staged: rollback never touches the index"
            );
            assert_eq!(
                result.post_rollback_verification.observed_changed_paths,
                vec!["other.txt".to_string(), "unrelated.txt".to_string()]
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// The default for an unrecognised apply state must be refusal.
    ///
    /// **This is the whole point of the allow-list, and the only test here that
    /// tests the shape rather than an arm.** The guard used to enumerate blocked
    /// statuses, so its default was *apply*: a status no arm named fell through
    /// to the write. That is not hypothetical -- it is what `rolled_back` did,
    /// re-applying the patch and returning `applied_verified`.
    ///
    /// The status below is deliberately one no code writes and no enum declares.
    /// Nothing can be added to the guard to make this pass; only inverting it
    /// can. It stands in for whatever status someone adds next.
    #[test]
    fn safe_apply_refuses_an_artifact_with_an_unrecognized_apply_status() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-unknown-status");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("some_future_status");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("an unrecognised apply state must refuse by default");

            assert_eq!(error.code, "apply_state_not_eligible");
            assert!(
                !repository_path.join("generated.txt").exists(),
                "an unrecognised apply state must never reach the write"
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// Every status that is not explicitly eligible refuses.
    ///
    /// `blocked` and `not_applicable` are the argument made concrete. Both are
    /// declared on `PatchApplyStatus`, neither is written by any live path, and
    /// both would have reached the write -- including one literally named
    /// `blocked`.
    ///
    /// `ready_to_apply` is refused deliberately even though its name sounds
    /// eligible. Nothing writes it. Allow-listing an unreachable status because
    /// its name reads well is the enumerate mistake in reverse: it grants
    /// permission speculatively, so if a future path ever writes it, apply
    /// proceeds and nobody re-reviews the decision. Left off, that write fails
    /// closed until someone consciously adds it.
    #[test]
    fn safe_apply_refuses_every_status_that_is_not_explicitly_eligible() {
        tauri::async_runtime::block_on(async {
            for status in ["blocked", "not_applicable", "ready_to_apply"] {
                let repository_path = create_temp_dir(&format!("safe-apply-ineligible-{status}"));
                init_git_repo(&repository_path);
                commit_test_file(&repository_path, "README.md", "fixture\n");
                let pool = create_apply_test_pool().await;
                let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
                mutate_apply_artifact(&pool, |artifacts| {
                    artifacts[0]["applyStatus"] = json!(status);
                })
                .await;

                let lock_directory = test_apply_lock_directory(&repository_path);
                let result =
                    apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input).await;

                assert!(
                    result.is_err(),
                    "{status} must not be eligible for application, but the patch applied: {result:?}"
                );
                assert_eq!(
                    result.unwrap_err().code,
                    "apply_state_not_eligible",
                    "{status} must refuse through the eligibility default"
                );
                assert!(
                    !repository_path.join("generated.txt").exists(),
                    "{status} must never reach the write"
                );
                remove_temp_dir(&repository_path);
            }
        });
    }

    /// A failed apply may be retried, and the guard must keep letting it.
    ///
    /// `apply_failed` is eligible today only by falling through every arm of a
    /// guard that enumerates blocked statuses. Inverting that guard to an
    /// allow-list would silently remove retry if `apply_failed` were left off,
    /// and nothing would catch it -- there is no existing coverage for retry at
    /// all. This pins the behaviour before the shape changes underneath it.
    ///
    /// Retry is safe because it is re-gated rather than replayed: the apply
    /// request re-runs structure validation, a fresh `git apply --check`, and the
    /// full snapshot comparison. The attempt row is `failed`, which is absent
    /// from the unresolved-attempt gate, so the repository does not block either.
    #[test]
    fn safe_apply_allows_a_retry_after_a_failed_attempt() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-retry-after-failure");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            // Exactly the state a rejected `git apply` leaves behind: the artifact
            // marked failed, its validation evidence untouched, the tree unchanged.
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("apply_failed");
                artifacts[0]["applyError"] = json!("Git could not apply the approved patch.");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let result = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect("a failed attempt must remain retryable");

            assert_eq!(result.status, "applied_verified");
            assert_eq!(
                fs::read_to_string(repository_path.join("generated.txt")).unwrap(),
                "safe generated content\n"
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// A rolled-back artifact must be refused by the native apply guard, not
    /// merely rendered differently.
    ///
    /// This is F7's shape. Rollback adds a new terminal state, and the existing
    /// guard enumerates statuses rather than allow-listing them: it blocks
    /// `applying`/`applied`/`applied_verified` and the unresolved trio. A status
    /// it has never heard of falls through every arm and reaches the write. The
    /// UI is not what stops the second application; this guard is.
    #[test]
    fn safe_apply_refuses_an_artifact_that_was_rolled_back() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-rolled-back-artifact");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("rolled_back");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("a rolled-back artifact must never be applied again");

            assert_eq!(error.code, "already_rolled_back");
            assert!(
                !repository_path.join("generated.txt").exists(),
                "the refused apply must not have written the working tree"
            );
            remove_temp_dir(&repository_path);
        });
    }

    /// An in-flight rollback must also refuse a concurrent apply of its artifact.
    #[test]
    fn safe_apply_refuses_an_artifact_with_a_rollback_in_flight() {
        tauri::async_runtime::block_on(async {
            let repository_path = create_temp_dir("safe-apply-rolling-back-artifact");
            init_git_repo(&repository_path);
            commit_test_file(&repository_path, "README.md", "fixture\n");
            let pool = create_apply_test_pool().await;
            let input = seed_apply_test_records(&pool, &repository_path, "approved").await;
            mutate_apply_artifact(&pool, |artifacts| {
                artifacts[0]["applyStatus"] = json!("rolling_back");
            })
            .await;

            let lock_directory = test_apply_lock_directory(&repository_path);
            let error = apply_approved_patch_artifact_with_pool(&pool, &lock_directory, input)
                .await
                .expect_err("an artifact being rolled back must never be applied");

            assert_eq!(error.code, "rollback_in_progress");
            assert!(
                !repository_path.join("generated.txt").exists(),
                "the refused apply must not have written the working tree"
            );
            remove_temp_dir(&repository_path);
        });
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
            acknowledge_patch_apply_attempt,
            apply_approved_patch_artifact,
            rollback_applied_patch_artifact,
            create_openai_plan,
            get_openai_provider_configuration,
            load_git_file_diff,
            load_git_status_summary,
            load_repository_git_metadata,
            load_repository_validation_snapshot,
            preview_repository_file,
            reconcile_interrupted_patch_apply_attempts,
            scan_repository_file_tree,
            test_openai_connection,
            validate_generated_patch
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Developer Workspace");
}
