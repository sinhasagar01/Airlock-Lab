import { describe, expect, it } from "vitest";
import type {
  PatchApplyAttempt,
  ProposedPatchArtifact,
  RepositoryValidationSnapshot,
} from "@ai-dev/ai";
import type { GitStatusSummary } from "@ai-dev/core";
import {
  evaluateRollbackEligibility,
  type RollbackEligibilityContext,
} from "./rollbackEligibility";

const TARGET = "My Notes.md";

function baselineSnapshot(
  overrides: Partial<RepositoryValidationSnapshot> = {},
): RepositoryValidationSnapshot {
  return {
    repositoryId: "repo-1",
    branch: "main",
    headSha: "abc1234",
    isClean: false,
    changedFileCount: 1,
    relevantFilePaths: [TARGET],
    targetFileFingerprints: [
      {
        path: TARGET,
        exists: true,
        status: "captured",
        contentSha256: "f".repeat(64),
      },
    ],
    capturedAt: "1783532400",
    ...overrides,
  };
}

function attempt(
  overrides: Partial<PatchApplyAttempt> = {},
): PatchApplyAttempt {
  return {
    applyAttemptId: "apply-1",
    repositoryId: "repo-1",
    proposedChangeId: "change-1",
    approvalRequestId: "approval-1",
    patchArtifactId: "artifact-1",
    backupId: "backup-1",
    status: "applied_verified",
    startedAt: "1783532400",
    postApplyEvidence: {
      artifactDigest: "a".repeat(64),
      repositorySnapshot: baselineSnapshot(),
      capturedAt: "1783532400",
    },
    message: "applied",
    ...overrides,
  };
}

function artifact(
  overrides: Partial<ProposedPatchArtifact> = {},
): ProposedPatchArtifact {
  return {
    id: "artifact-1",
    proposedChangeId: "change-1",
    filePath: TARGET,
    status: "generated",
    isBinary: false,
    isTooLarge: false,
    applyStatus: "applied_verified",
    ...overrides,
  };
}

function gitStatus(
  overrides: Partial<GitStatusSummary> = {},
): GitStatusSummary {
  return {
    repositoryId: "repo-1",
    repositoryPath: "/tmp/repo",
    branch: "main",
    headSha: "abc1234",
    isGitRepository: true,
    isClean: false,
    changedFileCount: 1,
    stagedCount: 0,
    unstagedCount: 1,
    untrackedCount: 0,
    conflictedCount: 0,
    files: [
      {
        path: TARGET,
        kind: "modified",
        stage: "unstaged",
        statusCode: " M",
      },
    ],
    refreshedAt: "1783532400",
    ...overrides,
  };
}

function context(
  overrides: Partial<RollbackEligibilityContext> = {},
): RollbackEligibilityContext {
  return {
    attempt: attempt(),
    currentGitStatus: gitStatus(),
    currentRepositorySnapshot: null,
    hasDurableStorage: true,
    isNativeRuntime: true,
    operation: "modify",
    repositoryMatches: true,
    ...overrides,
  };
}

describe("evaluateRollbackEligibility", () => {
  it("allows rollback of a verified apply with a complete baseline", () => {
    const result = evaluateRollbackEligibility(artifact(), context());

    expect(result.canRollback).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.operation).toBe("modify");
  });

  // The UX contract's load-bearing case: apply persists the baseline
  // best-effort, so this artifact is permanently un-rollbackable and the user
  // must learn that from the surface rather than by clicking.
  it("permanently refuses an artifact whose apply recorded no baseline", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({
        attempt: attempt({ postApplyEvidence: undefined }),
      }),
    );

    expect(result.canRollback).toBe(false);
    expect(result.reason).toBe("baseline_unavailable");
    expect(result.isPermanentlyIneligible).toBe(true);
    expect(result.detail).toMatch(/can never be rolled back/i);
  });

  // Proven by construction (roadmap #4c): an ordinary apply can grow a file
  // past the 256 KiB bound, the baseline truthfully records `too_large`, and
  // the old copy said "no record was kept" — which was false. The honest
  // obstacle is the pre-rollback backup: it cannot store a file past the bound,
  // and that would be true even with a perfect baseline.
  it("refuses an oversized target for the backup bound, not a recording failure", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({
        attempt: attempt({
          postApplyEvidence: {
            artifactDigest: "a".repeat(64),
            repositorySnapshot: baselineSnapshot({
              targetFileFingerprints: [
                { path: TARGET, exists: true, status: "too_large" },
              ],
            }),
            capturedAt: "1783532400",
          },
        }),
      }),
    );

    expect(result.reason).toBe("target_too_large");
    expect(result.isPermanentlyIneligible).toBe(true);
    expect(result.detail).toMatch(/256 KiB/);
    expect(result.detail).not.toMatch(/no record/i);
  });

  it("permanently refuses when the baseline fingerprint carries no hash", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({
        attempt: attempt({
          postApplyEvidence: {
            artifactDigest: "a".repeat(64),
            // `unavailable` genuinely means the recording is unusable — the
            // generic refusal is honest here, unlike for `too_large`.
            repositorySnapshot: baselineSnapshot({
              targetFileFingerprints: [
                { path: TARGET, exists: true, status: "unavailable" },
              ],
            }),
            capturedAt: "1783532400",
          },
        }),
      }),
    );

    expect(result.reason).toBe("baseline_unavailable");
    expect(result.isPermanentlyIneligible).toBe(true);
  });

  it("permanently refuses a rolled-back artifact", () => {
    const result = evaluateRollbackEligibility(
      artifact({ applyStatus: "rolled_back" }),
      context(),
    );

    expect(result.canRollback).toBe(false);
    expect(result.reason).toBe("already_rolled_back");
    expect(result.isPermanentlyIneligible).toBe(true);
  });

  it("refuses while a rollback is already in flight", () => {
    const result = evaluateRollbackEligibility(
      artifact({ applyStatus: "rolling_back" }),
      context(),
    );

    expect(result.reason).toBe("rollback_in_progress");
    expect(result.isPermanentlyIneligible).toBe(false);
  });

  // Restoring the declared target would undo the accountable half and leave the
  // rest, then report it as a rollback.
  it("permanently refuses a quarantined apply and names why", () => {
    const result = evaluateRollbackEligibility(
      artifact({ applyStatus: "quarantine_required" }),
      context(),
    );

    expect(result.reason).toBe("not_applied_verified");
    expect(result.isPermanentlyIneligible).toBe(true);
    expect(result.detail).toMatch(/could not account for/i);
  });

  it.each([
    ["applying", "not_applied_verified"],
    ["apply_failed", "not_applied_verified"],
    ["interrupted", "not_applied_verified"],
    ["needs_inspection", "not_applied_verified"],
    ["ready_to_apply", "not_applied_verified"],
  ] as const)("refuses an artifact in %s state", (applyStatus, reason) => {
    expect(
      evaluateRollbackEligibility(artifact({ applyStatus }), context()).reason,
    ).toBe(reason);
  });

  it("refuses once HEAD has moved past the apply", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({ currentGitStatus: gitStatus({ headSha: "def5678" }) }),
    );

    expect(result.reason).toBe("head_changed");
    expect(result.isPermanentlyIneligible).toBe(false);
  });

  it("refuses once the branch has changed", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({ currentGitStatus: gitStatus({ branch: "other" }) }),
    );

    expect(result.reason).toBe("branch_changed");
  });

  it("refuses a staged target", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({
        currentGitStatus: gitStatus({
          files: [
            { path: TARGET, kind: "modified", stage: "staged", statusCode: "M " },
          ],
        }),
      }),
    );

    expect(result.reason).toBe("target_staged");
    expect(result.detail).toMatch(/never touches the Git index/i);
  });

  it("refuses outside the native runtime", () => {
    expect(
      evaluateRollbackEligibility(
        artifact(),
        context({ isNativeRuntime: false }),
      ).reason,
    ).toBe("native_runtime_required");
  });

  it("refuses when the backup reference is missing", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({ attempt: attempt({ backupId: undefined }) }),
    );

    expect(result.reason).toBe("backup_unavailable");
    expect(result.isPermanentlyIneligible).toBe(true);
  });

  // The two acts are different and must not share one sentence.
  it("reports the create operation so the copy can say it deletes the file", () => {
    const result = evaluateRollbackEligibility(
      artifact(),
      context({ operation: "create" }),
    );

    expect(result.canRollback).toBe(true);
    expect(result.operation).toBe("create");
    expect(result.detail).toMatch(/deletes it/i);
  });
});
