import { invoke } from "@tauri-apps/api/core";
import type {
  GitChangedFile,
  GitChangeKind,
  GitChangeStage,
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

function mapChangedFile(file: NativeGitChangedFile): GitChangedFile {
  return {
    path: file.path,
    oldPath: file.old_path ?? undefined,
    kind: file.kind,
    stage: file.stage,
    statusCode: file.status_code,
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
