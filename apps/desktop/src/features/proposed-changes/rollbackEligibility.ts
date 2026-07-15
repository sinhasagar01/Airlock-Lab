import type {
  PatchApplyAttempt,
  ProposedChangeFileOperation,
  ProposedPatchArtifact,
  RepositoryValidationSnapshot,
} from "@ai-dev/ai";
import type { GitStatusSummary } from "@ai-dev/core";

/**
 * Frontend rollback eligibility.
 *
 * This grants no authority. The native command reloads every durable record and
 * re-derives every check, and it is the only thing that decides whether a byte is
 * written. What this exists for is the UX contract: eligibility — *and
 * ineligibility, with the reason* — is shown where the artifact is displayed,
 * before any action.
 *
 * An artifact with no post-apply baseline can never be rolled back. The user has
 * to learn that from the surface rather than by clicking, because a button that
 * exists only to refuse is dishonesty in a smaller box.
 */
export type RollbackBlockReason =
  | "native_runtime_required"
  | "storage_unavailable"
  | "repository_unavailable"
  | "not_applied_verified"
  | "already_rolled_back"
  | "rollback_in_progress"
  | "baseline_unavailable"
  | "target_too_large"
  | "backup_unavailable"
  | "head_changed"
  | "branch_changed"
  | "target_staged";

export type RollbackEligibility = {
  canRollback: boolean;
  /** Nothing can make this artifact rollbackable again; do not offer a button. */
  isPermanentlyIneligible: boolean;
  reason: RollbackBlockReason | null;
  detail: string;
  /** Drives the operation-specific confirmation copy. */
  operation: "create" | "modify";
};

export type RollbackEligibilityContext = {
  attempt: PatchApplyAttempt | null;
  currentGitStatus: GitStatusSummary | null;
  currentRepositorySnapshot: RepositoryValidationSnapshot | null;
  hasDurableStorage: boolean;
  isNativeRuntime: boolean;
  operation: ProposedChangeFileOperation;
  repositoryMatches: boolean;
};

function block(
  reason: RollbackBlockReason,
  detail: string,
  operation: "create" | "modify",
  isPermanentlyIneligible = false,
): RollbackEligibility {
  return {
    canRollback: false,
    isPermanentlyIneligible,
    reason,
    detail,
    operation,
  };
}

export function evaluateRollbackEligibility(
  artifact: ProposedPatchArtifact,
  context: RollbackEligibilityContext,
): RollbackEligibility {
  const operation = context.operation === "create" ? "create" : "modify";

  // Permanent ineligibility first, so a terminal state is never described as a
  // transient one the user could clear by refreshing.
  if (artifact.applyStatus === "rolled_back") {
    return block(
      "already_rolled_back",
      "This patch was already rolled back. Re-applying it would replay an approval that has been undone, so it needs a fresh proposal and validation cycle.",
      operation,
      true,
    );
  }

  if (artifact.applyStatus === "rolling_back") {
    return block(
      "rollback_in_progress",
      "A rollback of this patch is already in progress.",
      operation,
    );
  }

  if (artifact.applyStatus !== "applied_verified") {
    return block(
      "not_applied_verified",
      artifact.applyStatus === "quarantine_required"
        ? "This apply is quarantined: paths changed that the app could not account for, and there is no backup for them. Restoring only the approved path would undo part of what happened and report it as a rollback."
        : "Only a patch whose application was verified against its exact approved path can be rolled back.",
      operation,
      artifact.applyStatus === "quarantine_required",
    );
  }

  if (!context.isNativeRuntime) {
    return block(
      "native_runtime_required",
      "Rollback is available only through the native desktop command.",
      operation,
    );
  }

  if (!context.hasDurableStorage) {
    return block(
      "storage_unavailable",
      "Native workspace persistence is required to reload the backup and the post-apply baseline.",
      operation,
    );
  }

  if (!context.repositoryMatches) {
    return block(
      "repository_unavailable",
      "Select the repository this patch was applied to before rolling it back.",
      operation,
    );
  }

  // The baseline. Apply persists it best-effort — the snapshot capture is
  // optional and the write is fire-and-forget — so an artifact can be
  // `applied_verified` with nothing to compare against. Without it, drift since
  // the apply cannot be ruled out, and rollback's entire safety rule is "do not
  // overwrite user edits made after apply". This is permanent: the moment to
  // record the baseline has passed.
  // The baseline is native's positive assertion, and this surface consults
  // nothing else. Evidence blobs are deliberately not read: reconstructing
  // eligibility from evidence is the absence-as-signal hole the assertion
  // removes, and it is how a reconciliation-time snapshot once let rollback
  // destroy a crash-window edit and verify the destruction.
  //
  // Apply required a clean tree, so for a modify the pre-apply contents are
  // exactly what was committed at apply time — the permanent refusals say so
  // rather than gesturing at "your own backups".
  const manualRecoveryHint =
    operation === "modify"
      ? " Apply required a clean working tree, so the file's pre-apply contents are exactly what was committed as of the apply — Git history can restore them manually."
      : " The file did not exist before the apply, so deleting it restores the pre-apply state manually.";
  const baseline = context.attempt?.rollbackBaseline;

  if (!baseline) {
    return block(
      "baseline_unavailable",
      `This patch was applied before undo baselines were recorded, and nothing usable was kept. It can never be rolled back from here.${manualRecoveryHint}`,
      operation,
      true,
    );
  }

  if (baseline.status !== "recorded") {
    // An oversized target is refused for its true reason (proven, roadmap
    // #4c): the pre-rollback backup cannot store a file past the 256 KiB
    // bound, which would be true even with a perfect baseline.
    if (baseline.reason === "target_too_large") {
      return block(
        "target_too_large",
        "This file exceeded the 256 KiB rollback backup limit when the patch was applied. Rollback must back up a file before overwriting it and cannot store this one, so this patch can never be rolled back from here.",
        operation,
        true,
      );
    }

    // A reconciled outcome's snapshot is reconciliation-time, not apply-time:
    // an edit made in the crash window would be inside its hash, invisible to
    // the drift check.
    if (baseline.reason === "reconciled_outcome") {
      return block(
        "baseline_unavailable",
        `This apply was interrupted and its outcome was reconciled later, so the file's contents immediately after the apply were never recorded. Edits made before reconciliation cannot be ruled out, and this patch can never be rolled back from here.${manualRecoveryHint}`,
        operation,
        true,
      );
    }

    return block(
      "baseline_unavailable",
      `No record of this file's contents immediately after the apply was kept, so edits made since then cannot be ruled out. This patch can never be rolled back from here.${manualRecoveryHint}`,
      operation,
      true,
    );
  }

  if (!baseline.contentSha256 || !baseline.branch || !baseline.headSha) {
    return block(
      "baseline_unavailable",
      `The recorded undo baseline is incomplete, so edits made since the apply cannot be ruled out. This patch can never be rolled back from here.${manualRecoveryHint}`,
      operation,
      true,
    );
  }

  if (!context.attempt?.backupId) {
    return block(
      "backup_unavailable",
      "The pre-apply backup this rollback would restore from is unavailable.",
      operation,
      true,
    );
  }

  // Live repository state. Native re-checks all of it and is authoritative; this
  // only spares the user a click that could only ever refuse.
  const currentHeadSha =
    context.currentGitStatus?.headSha ??
    context.currentRepositorySnapshot?.headSha;
  const currentBranch =
    context.currentGitStatus?.branch ?? context.currentRepositorySnapshot?.branch;

  if (currentHeadSha && currentHeadSha !== baseline?.headSha) {
    return block(
      "head_changed",
      "HEAD moved after this patch was applied. The apply is now part of your history, so writing the previous contents back would be a new change rather than an undo.",
      operation,
    );
  }

  if (currentBranch && currentBranch !== baseline?.branch) {
    return block(
      "branch_changed",
      `This patch was applied on ${baseline?.branch ?? "another branch"}. Switch back to it before rolling back.`,
      operation,
    );
  }

  const targetIsStaged = context.currentGitStatus?.files.some(
    (file) =>
      (file.path === artifact.filePath ||
        file.oldPath === artifact.filePath) &&
      (file.stage === "staged" || file.stage === "both"),
  );

  if (targetIsStaged) {
    return block(
      "target_staged",
      "The file is staged. Unstage it first — rollback changes working-tree files only and never touches the Git index.",
      operation,
    );
  }

  return {
    canRollback: true,
    isPermanentlyIneligible: false,
    reason: null,
    detail:
      operation === "create"
        ? "This patch created the file, so rolling back deletes it."
        : "This patch modified the file, so rolling back restores its pre-apply contents.",
    operation,
  };
}
