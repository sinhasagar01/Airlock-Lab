import { invoke } from "@tauri-apps/api/core";
import type {
  GitChangedFile,
  GitChangeKind,
  GitChangeStage,
  GitDiffKind,
  GitDiffLineType,
  GitFileDiff,
  GitStatusSummary,
} from "@ai-dev/core";

type NativeGitChangedFile = {
  path: string;
  old_path?: string | null;
  kind: GitChangeKind;
  stage: GitChangeStage;
  status_code: string;
};

type NativeGitStatusSummary = {
  repository_id: string;
  repository_path: string;
  branch?: string | null;
  head_sha?: string | null;
  is_git_repository: boolean;
  is_clean: boolean;
  changed_file_count: number;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  conflicted_count: number;
  files: NativeGitChangedFile[];
  refreshed_at: string;
};

type NativeGitDiffLine = {
  type: GitDiffLineType;
  content: string;
  old_line_number?: number | null;
  new_line_number?: number | null;
};

type NativeGitFileDiff = {
  repository_id: string;
  repository_path: string;
  file_path: string;
  old_path?: string | null;
  kind: GitDiffKind;
  is_binary: boolean;
  is_too_large: boolean;
  line_count: number;
  additions: number;
  deletions: number;
  raw_diff?: string | null;
  lines: NativeGitDiffLine[];
  refreshed_at: string;
};

function mapChangedFile(file: NativeGitChangedFile): GitChangedFile {
  return {
    path: file.path,
    oldPath: file.old_path ?? undefined,
    kind: file.kind,
    stage: file.stage,
    statusCode: file.status_code,
  };
}

function mapDiffLine(line: NativeGitDiffLine) {
  return {
    type: line.type,
    content: line.content,
    oldLineNumber: line.old_line_number ?? undefined,
    newLineNumber: line.new_line_number ?? undefined,
  };
}

function mapFileDiff(diff: NativeGitFileDiff): GitFileDiff {
  return {
    repositoryId: diff.repository_id,
    repositoryPath: diff.repository_path,
    filePath: diff.file_path,
    oldPath: diff.old_path ?? undefined,
    kind: diff.kind,
    isBinary: diff.is_binary,
    isTooLarge: diff.is_too_large,
    lineCount: diff.line_count,
    additions: diff.additions,
    deletions: diff.deletions,
    rawDiff: diff.raw_diff ?? undefined,
    lines: diff.lines.map(mapDiffLine),
    refreshedAt: diff.refreshed_at,
  };
}

export async function loadGitStatusSummary(
  repositoryId: string,
  repositoryPath: string,
): Promise<GitStatusSummary> {
  const status = await invoke<NativeGitStatusSummary>("load_git_status_summary", {
    repositoryId,
    repositoryPath,
  });

  return {
    repositoryId: status.repository_id,
    repositoryPath: status.repository_path,
    branch: status.branch ?? undefined,
    headSha: status.head_sha ?? undefined,
    isGitRepository: status.is_git_repository,
    isClean: status.is_clean,
    changedFileCount: status.changed_file_count,
    stagedCount: status.staged_count,
    unstagedCount: status.unstaged_count,
    untrackedCount: status.untracked_count,
    conflictedCount: status.conflicted_count,
    files: status.files.map(mapChangedFile),
    refreshedAt: status.refreshed_at,
  };
}

export async function loadGitFileDiff(
  repositoryId: string,
  repositoryPath: string,
  file: GitChangedFile,
): Promise<GitFileDiff> {
  const diff = await invoke<NativeGitFileDiff>("load_git_file_diff", {
    repositoryId,
    repositoryPath,
    filePath: file.path,
    stage: file.stage,
    kind: file.kind,
    oldPath: file.oldPath,
  });

  return mapFileDiff(diff);
}
