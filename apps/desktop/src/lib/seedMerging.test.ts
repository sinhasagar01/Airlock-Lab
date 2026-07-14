import { describe, expect, it } from "vitest";
import { agentRuns as mockAgentRuns, mockProposedChanges } from "./appData";
import {
  mergeSeedProposedChanges,
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
