use std::{
    env, fs,
    io::Write,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const MAX_INDEXED_FILES: usize = 5_000;
const MAX_PREVIEW_BYTES: u64 = 256 * 1024;
const MAX_DIFF_BYTES: usize = 512 * 1024;
const MAX_PROVIDER_TASK_BYTES: usize = 1_200;
const MAX_PROVIDER_KEY_FILES: usize = 20;
const MAX_PROVIDER_FOLDERS: usize = 20;
const MAX_PROVIDER_EXTENSIONS: usize = 12;
const MAX_GENERATED_PATCH_BYTES: usize = 64 * 1024;
const MAX_GENERATED_PATCH_LINES: usize = 4_000;
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryValidationSnapshot {
    repository_id: String,
    branch: Option<String>,
    head_sha: Option<String>,
    is_clean: bool,
    changed_file_count: usize,
    relevant_file_paths: Vec<String>,
    captured_at: String,
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
    input: &PatchValidationInput,
    canonical_repository_path: &str,
) -> RepositoryValidationSnapshot {
    let head_sha = git_output(canonical_repository_path, &["rev-parse", "--short", "HEAD"]);
    let branch = git_output(canonical_repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| head_sha.as_ref().map(|commit| format!("detached {commit}")));
    let status_output =
        git_output(canonical_repository_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let changed_file_count = status_output.lines().count();
    let mut relevant_file_paths = if input.relevant_file_paths.is_empty() {
        vec![input.file_path.clone()]
    } else {
        input.relevant_file_paths.clone()
    };
    relevant_file_paths.sort();
    relevant_file_paths.dedup();

    RepositoryValidationSnapshot {
        repository_id: input.repository_id.clone(),
        branch,
        head_sha,
        is_clean: changed_file_count == 0,
        changed_file_count,
        relevant_file_paths,
        captured_at: now_unix_seconds(),
    }
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
    let Some(first_hunk_index) = lines.iter().position(|line| line.starts_with("@@ ")) else {
        return Err("The artifact must contain a unified diff hunk.".to_string());
    };
    let metadata_lines = &lines[..first_hunk_index];
    let old_headers: Vec<&str> = metadata_lines
        .iter()
        .copied()
        .filter(|line| line.starts_with("--- "))
        .collect();
    let new_headers: Vec<&str> = metadata_lines
        .iter()
        .copied()
        .filter(|line| line.starts_with("+++ "))
        .collect();

    if diff_headers.len() != 1
        || diff_headers[0] != expected_diff_header
        || old_headers.len() != 1
        || new_headers.len() != 1
    {
        return Err("The artifact must contain one matching single-file unified diff.".to_string());
    }

    let expected_old_header = format!("--- a/{}", input.file_path);
    let expected_new_header = format!("+++ b/{}", input.file_path);
    let old_header = old_headers[0];
    let new_header = new_headers[0];
    let operation_matches = match input.operation.as_str() {
        "create" => old_header == "--- /dev/null" && new_header == expected_new_header,
        "delete" => old_header == expected_old_header && new_header == "+++ /dev/null",
        "modify" => old_header == expected_old_header && new_header == expected_new_header,
        "unknown" => {
            (old_header == expected_old_header || old_header == "--- /dev/null")
                && (new_header == expected_new_header || new_header == "+++ /dev/null")
        }
        _ => false,
    };

    if !operation_matches {
        return Err("The patch headers do not match the proposed file operation.".to_string());
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

    let head_sha = git_output(
        &canonical_repository_path,
        &["rev-parse", "--short", "HEAD"],
    );
    let branch = git_output(&canonical_repository_path, &["branch", "--show-current"])
        .filter(|value| !value.is_empty())
        .or_else(|| head_sha.as_ref().map(|commit| format!("detached {commit}")));
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
        head_sha,
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

    let (_, canonical_repository_path) = match canonical_selected_git_root(&input.repository_path) {
        Ok(root) => root,
        Err(_) => {
            return patch_validation_result(
                &input,
                "valid_structure",
                "Patch structure is valid, but the selected Git repository is unavailable for dry-run.",
            );
        }
    };
    let repository_snapshot =
        capture_repository_validation_snapshot(&input, &canonical_repository_path);

    let mut child = match Command::new("git")
        .args(["apply", "--check", "--whitespace=nowarn", "-"])
        .current_dir(canonical_repository_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(_) => {
            return patch_validation_result_with_snapshot(
                &input,
                "valid_structure",
                "Patch structure is valid, but the native Git dry-run is unavailable.",
                repository_snapshot,
                false,
            );
        }
    };

    let raw_diff = input.raw_diff.as_deref().unwrap_or_default();
    let patch_for_git = if raw_diff.ends_with('\n') {
        raw_diff.to_string()
    } else {
        format!("{raw_diff}\n")
    };
    let write_result = child
        .stdin
        .take()
        .ok_or(())
        .and_then(|mut stdin| stdin.write_all(patch_for_git.as_bytes()).map_err(|_| ()));

    if write_result.is_err() {
        let _ = child.kill();
        let _ = child.wait();
        return patch_validation_result_with_snapshot(
            &input,
            "valid_structure",
            "Patch structure is valid, but the native Git dry-run could not read the proposal.",
            repository_snapshot,
            false,
        );
    }

    match child.wait() {
        Ok(status) if status.success() => patch_validation_result_with_snapshot(
            &input,
            "dry_run_passed",
            "Git reports that the patch can apply to the current working tree without writing it.",
            repository_snapshot,
            true,
        ),
        Ok(_) => patch_validation_result_with_snapshot(
            &input,
            "dry_run_failed",
            "Git reports that the patch does not apply cleanly to the current working tree.",
            repository_snapshot,
            true,
        ),
        Err(_) => patch_validation_result_with_snapshot(
            &input,
            "valid_structure",
            "Patch structure is valid, but the native Git dry-run did not complete.",
            repository_snapshot,
            false,
        ),
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
            artifact_digest: Some("sha256:test-digest".to_string()),
            relevant_file_paths: vec![file_path.to_string()],
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
            Some("sha256:test-digest")
        );
        assert!(result.dry_run_at.is_some());
        let snapshot = result
            .repository_snapshot
            .expect("validation should capture a repository snapshot");
        assert_eq!(snapshot.repository_id, "repo-test");
        assert!(snapshot.is_clean);
        assert_eq!(snapshot.changed_file_count, 0);
        assert_eq!(snapshot.relevant_file_paths, vec!["new-file.txt"]);
        assert!(!repository_path.join("new-file.txt").exists());
        assert_eq!(status_before, status_after);
        remove_temp_dir(&repository_path);
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
            create_openai_plan,
            get_openai_provider_configuration,
            load_git_file_diff,
            load_git_status_summary,
            load_repository_git_metadata,
            preview_repository_file,
            scan_repository_file_tree,
            test_openai_connection,
            validate_generated_patch
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Developer Workspace");
}
