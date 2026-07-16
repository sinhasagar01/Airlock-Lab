import type {
  ProposedPatchArtifact,
  RepositoryValidationSnapshot,
} from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import {
  evaluateApplyReadiness,
  summarizeChecks,
  type ApplyReadinessContext,
} from "./applyReadiness";

const validationSnapshot: RepositoryValidationSnapshot = {
  repositoryId: "repo-1",
  branch: "main",
  headSha: "abc1234",
  isClean: true,
  changedFileCount: 0,
  relevantFilePaths: ["src/App.tsx"],
  artifactDigest: "digest-1",
  targetFileFingerprints: [
    {
      path: "src/App.tsx",
      exists: true,
      sizeBytes: 120,
      modifiedAt: "2026-07-14T11:59:00.000Z",
      contentSha256: "f".repeat(64),
      status: "captured",
    },
  ],
  repositorySnapshotDigest: "a".repeat(64),
  capturedAt: "2026-07-14T12:00:00.000Z",
  fingerprintedAt: "2026-07-14T12:00:00.000Z",
};

const readyContext: ApplyReadinessContext = {
  approvalStatus: "approved",
  hasDurableStorage: true,
  hasSelectedRepository: true,
  isNativeRuntime: true,
  repositoryMatches: true,
  currentRepositorySnapshot: validationSnapshot,
  workingTreeState: "clean",
};

function generatedArtifact(
  overrides: Partial<ProposedPatchArtifact> = {},
): ProposedPatchArtifact {
  return {
    id: "artifact-1",
    proposedChangeId: "proposal-1",
    filePath: "src/App.tsx",
    status: "generated",
    isBinary: false,
    isTooLarge: false,
    rawDiff:
      "diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-old\n+new",
    artifactDigest: "digest-1",
    validationStatus: "dry_run_passed",
    validatedArtifactDigest: "digest-1",
    validationRepositorySnapshot: validationSnapshot,
    validatedAt: "2026-07-14T12:00:00.000Z",
    dryRunAt: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}

function gateStatus(
  result: ReturnType<typeof evaluateApplyReadiness>,
  id: ReturnType<typeof evaluateApplyReadiness>["gates"][number]["id"],
) {
  return result.gates.find((gate) => gate.id === id)?.status;
}

describe("evaluateApplyReadiness", () => {
  it("marks an approved dry-run-passed native artifact ready to apply", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), readyContext);

    expect(result.status).toBe("ready_to_apply");
    expect(result.canApply).toBe(true);
    expect(gateStatus(result, "native_runtime")).toBe("passed");
    expect(gateStatus(result, "durable_storage")).toBe("passed");
    expect(gateStatus(result, "approval")).toBe("passed");
    expect(gateStatus(result, "dry_run")).toBe("passed");
    expect(gateStatus(result, "artifact_digest")).toBe("passed");
    expect(gateStatus(result, "validation_snapshot")).toBe("passed");
    expect(gateStatus(result, "target_fingerprints")).toBe("passed");
    expect(gateStatus(result, "repository_staleness")).toBe("passed");
  });

  it("blocks browser preview and unavailable durable storage", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), {
      ...readyContext,
      hasDurableStorage: false,
      isNativeRuntime: false,
    });

    expect(result.canApply).toBe(false);
    expect(gateStatus(result, "native_runtime")).toBe("blocked");
    expect(gateStatus(result, "durable_storage")).toBe("blocked");
  });

  it("prevents an applied artifact from being applied twice", () => {
    for (const applyStatus of ["applied", "applied_verified"] as const) {
      const result = evaluateApplyReadiness(
        generatedArtifact({ applyStatus }),
        readyContext,
      );

      expect(result.status).toBe("applied");
      expect(result.canApply).toBe(false);
      expect(gateStatus(result, "apply_state")).toBe("blocked");
    }
  });

  // The shape, not an arm. An unrecognised status must read as blocked rather
  // than "ready to apply", so the surface never invites a click native can only
  // refuse. Nothing can be added to the gate to make this pass; only the
  // allow-list can.
  it("blocks an artifact whose apply state it does not recognise", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({
        applyStatus: "some_future_status" as ProposedPatchArtifact["applyStatus"],
      }),
      readyContext,
    );

    expect(result.canApply).toBe(false);
    expect(gateStatus(result, "apply_state")).toBe("blocked");
  });

  // Refused deliberately despite the name: nothing writes it, and allow-listing
  // an unreachable status because it reads well grants permission speculatively.
  it.each(["blocked", "not_applicable", "ready_to_apply"] as const)(
    "blocks %s, which no code writes and which is not explicitly eligible",
    (applyStatus) => {
      const result = evaluateApplyReadiness(
        generatedArtifact({ applyStatus }),
        readyContext,
      );

      expect(result.canApply).toBe(false);
      expect(gateStatus(result, "apply_state")).toBe("blocked");
    },
  );

  // Mirrors the native retry pin: if this gate drops apply_failed, the surface
  // silently stops offering a retry that native would allow.
  it("allows a retry after an attempt failed without changing the tree", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ applyStatus: "apply_failed" }),
      readyContext,
    );

    expect(gateStatus(result, "apply_state")).toBe("passed");
    expect(result.canApply).toBe(true);
  });

  it("blocks a rolled-back artifact from being applied again", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ applyStatus: "rolled_back" }),
      readyContext,
    );

    expect(result.canApply).toBe(false);
    expect(result.status).toBe("blocked");
    expect(gateStatus(result, "apply_state")).toBe("blocked");
    expect(
      result.gates.find((item) => item.id === "apply_state")?.detail,
    ).toMatch(/permanently ineligible/i);
  });

  it("blocks an artifact whose rollback is in flight", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ applyStatus: "rolling_back" }),
      readyContext,
    );

    expect(result.canApply).toBe(false);
    expect(gateStatus(result, "apply_state")).toBe("blocked");
  });

  it("blocks artifacts with unresolved interrupted apply evidence", () => {
    for (const applyStatus of [
      "interrupted",
      "needs_inspection",
      "quarantine_required",
    ] as const) {
      const result = evaluateApplyReadiness(
        generatedArtifact({ applyStatus }),
        readyContext,
      );

      expect(result.canApply).toBe(false);
      expect(gateStatus(result, "apply_state")).toBe("blocked");
    }
  });

  it("blocks an artifact while approval is pending", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), {
      ...readyContext,
      approvalStatus: "pending",
    });

    expect(result.status).toBe("blocked");
    expect(gateStatus(result, "approval")).toBe("blocked");
  });

  it("blocks an artifact that failed structure validation", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ validationStatus: "invalid_structure" }),
      readyContext,
    );

    expect(result.status).toBe("blocked");
    expect(gateStatus(result, "structure")).toBe("blocked");
    expect(gateStatus(result, "dry_run")).toBe("not_checked");
  });

  it("blocks an artifact whose read-only dry-run failed", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ validationStatus: "dry_run_failed" }),
      readyContext,
    );

    expect(result.status).toBe("blocked");
    expect(gateStatus(result, "structure")).toBe("passed");
    expect(gateStatus(result, "dry_run")).toBe("blocked");
  });

  it("blocks or defers repository gates when no repository is selected", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), {
      ...readyContext,
      hasSelectedRepository: false,
      repositoryMatches: false,
      currentRepositorySnapshot: null,
      workingTreeState: "unknown",
    });

    expect(result.status).toBe("blocked");
    expect(gateStatus(result, "repository")).toBe("blocked");
    expect(gateStatus(result, "working_tree")).toBe("not_checked");
  });

  it("blocks binary, oversized, and protected-path artifacts", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({
        filePath: ".env.production",
        isBinary: true,
        isTooLarge: true,
      }),
      readyContext,
    );

    expect(gateStatus(result, "forbidden_path")).toBe("blocked");
    expect(gateStatus(result, "binary")).toBe("blocked");
    expect(gateStatus(result, "size")).toBe("blocked");
  });

  it("blocks staleness when the artifact digest changed after validation", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({ artifactDigest: "digest-2" }),
      readyContext,
    );

    expect(gateStatus(result, "artifact_digest")).toBe("blocked");
    expect(
      result.gates.find((gate) => gate.id === "artifact_digest")?.detail,
    ).toContain("Patch artifact changed after validation");
  });

  it("blocks staleness when the repository changed after validation", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), {
      ...readyContext,
      currentRepositorySnapshot: {
        ...validationSnapshot,
        headSha: "def5678",
        repositorySnapshotDigest: "b".repeat(64),
      },
    });

    expect(gateStatus(result, "repository_staleness")).toBe("blocked");
    expect(
      result.gates.find((gate) => gate.id === "repository_staleness")?.detail,
    ).toContain("Repository state changed after validation");
  });

  it("leaves staleness unchecked before validation runs", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({
        validationStatus: "not_validated",
        validatedArtifactDigest: undefined,
        validationRepositorySnapshot: undefined,
        validatedAt: undefined,
        dryRunAt: undefined,
      }),
      readyContext,
    );

    expect(gateStatus(result, "artifact_digest")).toBe("not_checked");
    expect(gateStatus(result, "validation_snapshot")).toBe("not_checked");
    expect(gateStatus(result, "target_fingerprints")).toBe("not_checked");
    expect(gateStatus(result, "repository_staleness")).toBe("not_checked");
  });

  it("blocks readiness when a target fingerprint is forbidden", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({
        validationRepositorySnapshot: {
          ...validationSnapshot,
          targetFileFingerprints: [
            {
              path: ".env",
              exists: false,
              status: "forbidden",
              reason: "Policy forbids fingerprinting this path.",
            },
          ],
        },
      }),
      readyContext,
    );

    expect(gateStatus(result, "target_fingerprints")).toBe("blocked");
  });

  it("keeps legacy validation snapshots explicitly unavailable", () => {
    const result = evaluateApplyReadiness(
      generatedArtifact({
        validationRepositorySnapshot: {
          repositoryId: "repo-1",
          branch: "main",
          headSha: "abc1234",
          isClean: true,
          changedFileCount: 0,
          relevantFilePaths: ["src/App.tsx"],
          capturedAt: "2026-07-14T12:00:00.000Z",
        },
      }),
      readyContext,
    );

    expect(gateStatus(result, "target_fingerprints")).toBe("future");
    expect(gateStatus(result, "repository_staleness")).toBe("future");
  });
});

// The checks line is a projection of THIS evaluator, not of the durable
// validationStatus. Every case here shares its inputs with an evaluateApplyReadiness
// case above; summarizeChecks only changes the level of detail.
describe("summarizeChecks", () => {
  it("passes when structure, dry-run, and every freshness gate pass", () => {
    const summary = summarizeChecks(
      evaluateApplyReadiness(generatedArtifact(), readyContext),
    );

    expect(summary.status).toBe("passed");
    expect(summary.reason).toContain("read-only Git dry-run passed");
  });

  // The critical property, in pure form. The artifact's durable validationStatus
  // is "dry_run_passed" -- a naive line that read it would say "passed". The
  // repository has moved under the artifact, so the evaluator blocks staleness
  // and the projection must report failed with the staleness reason.
  it("fails on staleness even though the durable status still says dry_run_passed", () => {
    const artifact = generatedArtifact();
    expect(artifact.validationStatus).toBe("dry_run_passed");

    const summary = summarizeChecks(
      evaluateApplyReadiness(artifact, {
        ...readyContext,
        currentRepositorySnapshot: {
          ...validationSnapshot,
          headSha: "def5678",
          repositorySnapshotDigest: "b".repeat(64),
        },
      }),
    );

    expect(summary.status).toBe("failed");
    expect(summary.reason).toBe(
      "Repository state changed after validation. Re-run validation before future apply.",
    );
  });

  it("fails when the read-only dry-run failed", () => {
    const summary = summarizeChecks(
      evaluateApplyReadiness(
        generatedArtifact({ validationStatus: "dry_run_failed" }),
        readyContext,
      ),
    );

    expect(summary.status).toBe("failed");
    expect(summary.reason).toBe("The read-only Git applicability check failed.");
  });

  it("is incomplete before validation has run", () => {
    const summary = summarizeChecks(
      evaluateApplyReadiness(
        generatedArtifact({
          validationStatus: "not_validated",
          validatedArtifactDigest: undefined,
          validationRepositorySnapshot: undefined,
          validatedAt: undefined,
          dryRunAt: undefined,
        }),
        readyContext,
      ),
    );

    expect(summary.status).toBe("incomplete");
    expect(summary.reason).toBe(
      "Run structure validation before evaluating this gate.",
    );
  });
});
