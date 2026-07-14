import { invoke } from "@tauri-apps/api/core";
import type { GitStatusSummary } from "@ai-dev/core";
import type {
  PatchApplyAttempt,
  PostApplyPathVerification,
} from "@ai-dev/ai";

export const APPLY_PATCH_CONFIRMATION = "APPLY PATCH";

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
  files: Array<{
    path: string;
    old_path?: string | null;
    kind: GitStatusSummary["files"][number]["kind"];
    stage: GitStatusSummary["files"][number]["stage"];
    status_code: string;
  }>;
  refreshed_at: string;
};

type NativeApplyPatchResult = {
  status: "applied_verified" | "quarantine_required";
  applyAttemptId: string;
  proposedChangeId: string;
  patchArtifactId: string;
  backupId: string;
  appliedAt: string;
  postApplyGitStatus: NativeGitStatusSummary;
  postApplyVerification: PostApplyPathVerification;
  message: string;
};

export type ApplyPatchResult = Omit<
  NativeApplyPatchResult,
  "postApplyGitStatus"
> & {
  postApplyGitStatus: GitStatusSummary;
};

export class PatchApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PatchApplicationError";
  }
}

function normalizeNativeError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return new PatchApplicationError(candidate.code, candidate.message);
    }
  }

  return new PatchApplicationError(
    "native_apply_unavailable",
    "The native patch application command is unavailable. No patch was applied.",
  );
}

function normalizeGitStatus(status: NativeGitStatusSummary): GitStatusSummary {
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
    files: status.files.map((file) => ({
      path: file.path,
      oldPath: file.old_path ?? undefined,
      kind: file.kind,
      stage: file.stage,
      statusCode: file.status_code,
    })),
    refreshedAt: status.refreshed_at,
  };
}

export async function applyApprovedPatchArtifact(
  repositoryId: string,
  proposedChangeId: string,
  approvalRequestId: string,
  patchArtifactId: string,
  confirmationPhrase: string,
): Promise<ApplyPatchResult> {
  try {
    const result = await invoke<NativeApplyPatchResult>(
      "apply_approved_patch_artifact",
      {
        input: {
          repositoryId,
          proposedChangeId,
          approvalRequestId,
          patchArtifactId,
          confirmationPhrase,
        },
      },
    );

    return {
      ...result,
      postApplyGitStatus: normalizeGitStatus(result.postApplyGitStatus),
    };
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

export async function reconcileInterruptedPatchApplyAttempts(): Promise<
  PatchApplyAttempt[]
> {
  try {
    const attempts = await invoke<PatchApplyAttempt[]>(
      "reconcile_interrupted_patch_apply_attempts",
    );

    if (!Array.isArray(attempts)) {
      throw new PatchApplicationError(
        "invalid_reconciliation_result",
        "Native apply reconciliation returned an invalid result.",
      );
    }

    return attempts;
  } catch (error) {
    if (error instanceof PatchApplicationError) {
      throw error;
    }
    throw normalizeNativeError(error);
  }
}
