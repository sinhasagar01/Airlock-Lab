import type { PersistedProposedChange } from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import { agentRuns as mockAgentRuns, mockProposedChanges } from "./appData";
import {
  mergeSeedProposedChanges,
  preserveInMemoryValidation,
  reconcileAgentRunApprovalStatuses,
} from "./seedMerging";

describe("mergeSeedProposedChanges", () => {
  it("repairs the legacy seeded generated artifact without changing saved proposal state", () => {
    const seededChange = mockProposedChanges.find(
      (change) => change.id === "proposal-mvp-shell",
    );

    expect(seededChange).toBeDefined();

    const savedChange = {
      ...seededChange!,
      status: "approved" as const,
      patchArtifacts: seededChange!.patchArtifacts.map((artifact) =>
        artifact.id === "proposal-mvp-shell-ai-patch-artifact"
          ? {
              ...artifact,
              rawDiff:
                "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts\n@@ -1,2 +1,3 @@\n-export type OldPlan = string;\n+export type NewPlan = string;\n+export type PatchArtifact = string;",
              validationStatus: "invalid_structure" as const,
              validationMessage: "Legacy validation result",
              validatedAt: "2026-07-14T12:00:00.000Z",
            }
          : artifact,
      ),
    };

    const [mergedChange] = mergeSeedProposedChanges([savedChange]);
    const migratedArtifact = mergedChange.patchArtifacts.find(
      (artifact) => artifact.id === "proposal-mvp-shell-ai-patch-artifact",
    );

    expect(mergedChange.status).toBe("approved");
    expect(migratedArtifact?.rawDiff).toContain(
      "--- a/packages/ai/src/index.ts\n+++ b/packages/ai/src/index.ts",
    );
    expect(migratedArtifact?.validationStatus).toBe("not_validated");
    expect(migratedArtifact?.validationMessage).toBeUndefined();
    expect(migratedArtifact?.validatedAt).toBeUndefined();
  });

  it("derives completed run state from a persisted approval decision", () => {
    const [run] = mockAgentRuns;

    const [reconciledRun] = reconcileAgentRunApprovalStatuses([run], [
      {
        id: "approval-provider-rfc",
        agentRunId: run.id,
        title: "Review plan",
        repository: run.repository,
        status: "rejected",
        risk: "medium",
        summary: "Review the plan.",
        files: [],
        createdAt: "Today, 10:42",
      },
    ]);

    expect(reconciledRun.status).toBe("completed");
    expect(reconciledRun.nextStep).toBe(
      "Approval rejected. No patch has been applied.",
    );
  });
});

describe("preserveInMemoryValidation", () => {
  function changeWith(
    artifactOverrides: Partial<PersistedProposedChange["patchArtifacts"][number]>,
  ): PersistedProposedChange {
    return {
      id: "proposal-1",
      runId: "run-1",
      approvalRequestId: "approval-1",
      repositoryId: "repo-1",
      title: "Change",
      summary: "Summary",
      status: "ready_for_review",
      files: [],
      patchArtifacts: [
        {
          id: "artifact-1",
          proposedChangeId: "proposal-1",
          filePath: "src/App.tsx",
          status: "generated",
          isBinary: false,
          isTooLarge: false,
          rawDiff: "diff",
          ...artifactOverrides,
        },
      ],
      createdAt: "t",
      updatedAt: "t",
    };
  }

  const validated = changeWith({
    validationStatus: "dry_run_passed",
    validationMessage: "Passed.",
    artifactDigest: "current-digest",
    validatedArtifactDigest: "current-digest",
    validatedAt: "2026-07-16T00:00:00.000Z",
    dryRunAt: "2026-07-16T00:00:00.000Z",
  });

  it("keeps an in-memory validation the reload raced past", () => {
    // The reload read the pre-check row: no validation on the reloaded artifact.
    const reloaded = changeWith({ artifactDigest: "current-digest" });

    const [result] = preserveInMemoryValidation([reloaded], [validated]);
    const artifact = result.patchArtifacts[0];

    expect(artifact.validationStatus).toBe("dry_run_passed");
    expect(artifact.validatedAt).toBe("2026-07-16T00:00:00.000Z");
    expect(artifact.validatedArtifactDigest).toBe("current-digest");
  });

  // Non-vacuous: with nothing to preserve, the reload passes through untouched,
  // so this cannot silently turn every reload into a keep-in-memory.
  it("passes the reload through when the in-memory copy has no validation either", () => {
    const reloaded = changeWith({ validationStatus: "dry_run_failed" });
    const currentUnvalidated = changeWith({});

    const [result] = preserveInMemoryValidation([reloaded], [currentUnvalidated]);

    expect(result.patchArtifacts[0].validationStatus).toBe("dry_run_failed");
  });

  it("does not overwrite a reload that carries its own validation", () => {
    const reloaded = changeWith({
      validationStatus: "dry_run_failed",
      validatedAt: "2026-07-16T01:00:00.000Z",
    });

    const [result] = preserveInMemoryValidation([reloaded], [validated]);

    expect(result.patchArtifacts[0].validationStatus).toBe("dry_run_failed");
    expect(result.patchArtifacts[0].validatedAt).toBe(
      "2026-07-16T01:00:00.000Z",
    );
  });

  // The recomputed current-content digest survives, so a changed artifact that
  // inherits a preserved validated digest still fails the digest gate rather
  // than passing on stale evidence.
  it("leaves the reloaded content digest untouched while preserving the validated digest", () => {
    const reloaded = changeWith({ artifactDigest: "changed-content-digest" });

    const [result] = preserveInMemoryValidation([reloaded], [validated]);
    const artifact = result.patchArtifacts[0];

    expect(artifact.artifactDigest).toBe("changed-content-digest");
    expect(artifact.validatedArtifactDigest).toBe("current-digest");
  });
});
