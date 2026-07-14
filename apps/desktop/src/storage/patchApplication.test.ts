import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyApprovedPatchArtifact,
  PatchApplicationError,
  reconcileInterruptedPatchApplyAttempts,
} from "./patchApplication";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("applyApprovedPatchArtifact", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("passes durable IDs and confirmation without accepting patch content", async () => {
    vi.mocked(invoke).mockResolvedValue({
      status: "applied_verified",
      applyAttemptId: "attempt-1",
      proposedChangeId: "proposal-1",
      patchArtifactId: "artifact-1",
      backupId: "backup-1",
      appliedAt: "1783532500",
      postApplyGitStatus: {
        repository_id: "repo-1",
        repository_path: "/workspace",
        branch: "main",
        head_sha: "abc1234",
        is_git_repository: true,
        is_clean: false,
        changed_file_count: 1,
        staged_count: 0,
        unstaged_count: 1,
        untracked_count: 0,
        conflicted_count: 0,
        files: [
          {
            path: "src/App.tsx",
            kind: "modified",
            stage: "unstaged",
            status_code: " M",
          },
        ],
        refreshed_at: "1783532500",
      },
      postApplyVerification: {
        status: "applied_verified",
        expectedPaths: ["src/App.tsx"],
        observedChangedPaths: ["src/App.tsx"],
        unexpectedPaths: [],
        missingExpectedPaths: [],
        verifiedAt: "1783532500",
        message: "Applied and verified safely.",
      },
      message: "Applied and verified safely.",
    });

    const result = await applyApprovedPatchArtifact(
      "repo-1",
      "proposal-1",
      "approval-1",
      "artifact-1",
      "APPLY PATCH",
    );

    expect(invoke).toHaveBeenCalledWith("apply_approved_patch_artifact", {
      input: {
        repositoryId: "repo-1",
        proposedChangeId: "proposal-1",
        approvalRequestId: "approval-1",
        patchArtifactId: "artifact-1",
        confirmationPhrase: "APPLY PATCH",
      },
    });
    expect(JSON.stringify(vi.mocked(invoke).mock.calls[0])).not.toContain(
      "rawDiff",
    );
    expect(result.postApplyGitStatus.files[0].statusCode).toBe(" M");
  });

  it("loads reconciliation records without repository paths or patch input", async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        applyAttemptId: "attempt-1",
        repositoryId: "repo-1",
        proposedChangeId: "proposal-1",
        approvalRequestId: "approval-1",
        patchArtifactId: "artifact-1",
        backupId: "backup-1",
        status: "needs_inspection",
        startedAt: "1783532400",
        completedAt: "1783532500",
        sanitizedError: "Manual inspection is required.",
        currentGitStatusChanged: true,
        message: "Manual inspection is required.",
      },
    ]);

    const attempts = await reconcileInterruptedPatchApplyAttempts();

    expect(invoke).toHaveBeenCalledWith(
      "reconcile_interrupted_patch_apply_attempts",
    );
    expect(attempts[0]).toEqual(
      expect.objectContaining({
        applyAttemptId: "attempt-1",
        status: "needs_inspection",
      }),
    );
    expect(JSON.stringify(vi.mocked(invoke).mock.calls[0])).not.toContain(
      "rawDiff",
    );
  });

  it("preserves typed native errors and sanitizes unknown failures", async () => {
    vi.mocked(invoke).mockRejectedValueOnce({
      code: "stale_repository",
      message:
        "Repository state changed after validation. Re-run validation before applying.",
    });

    await expect(
      applyApprovedPatchArtifact(
        "repo-1",
        "proposal-1",
        "approval-1",
        "artifact-1",
        "APPLY PATCH",
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "stale_repository",
        message:
          "Repository state changed after validation. Re-run validation before applying.",
      }),
    );

    vi.mocked(invoke).mockRejectedValueOnce({
      code: "git_apply_timeout",
      message:
        "Git patch application exceeded 15 seconds and was terminated. The backup was preserved and manual inspection is required.",
    });
    await expect(
      applyApprovedPatchArtifact(
        "repo-1",
        "proposal-1",
        "approval-1",
        "artifact-1",
        "APPLY PATCH",
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "git_apply_timeout",
        message: expect.stringContaining("manual inspection is required"),
      }),
    );

    vi.mocked(invoke).mockRejectedValueOnce(
      new Error("private native path and stderr"),
    );
    try {
      await applyApprovedPatchArtifact(
        "repo-1",
        "proposal-1",
        "approval-1",
        "artifact-1",
        "APPLY PATCH",
      );
      throw new Error("Expected the native apply wrapper to reject.");
    } catch (error) {
      expect(error).toBeInstanceOf(PatchApplicationError);
      expect((error as Error).message).not.toContain("private native path");
    }
  });
});
