import type { ProposedPatchArtifact } from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import {
  evaluateApplyReadiness,
  type ApplyReadinessContext,
} from "./applyReadiness";

const readyContext: ApplyReadinessContext = {
  approvalStatus: "approved",
  hasSelectedRepository: true,
  repositoryMatches: true,
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
    validationStatus: "dry_run_passed",
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
  it("marks an approved dry-run-passed artifact closer to ready", () => {
    const result = evaluateApplyReadiness(generatedArtifact(), readyContext);

    expect(result.status).toBe("closer_to_ready");
    expect(gateStatus(result, "approval")).toBe("passed");
    expect(gateStatus(result, "dry_run")).toBe("passed");
    expect(gateStatus(result, "staleness")).toBe("future");
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
});
