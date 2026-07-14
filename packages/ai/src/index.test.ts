import { describe, expect, it } from "vitest";
import { executeMockAgentRun } from "./index";

describe("executeMockAgentRun", () => {
  it("creates a linked review-only run, plan, proposal, and approval", async () => {
    const result = await executeMockAgentRun({
      id: "run-test",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      branch: "main",
      task: "Add a repository context summary",
      contextFilePaths: ["src/App.tsx", "README.md", "src/App.tsx"],
      startedAt: "Today, 12:00",
      createdAt: "2026-07-14T06:30:00.000Z",
    });

    expect(result.run).toMatchObject({
      id: "run-test",
      providerId: "mock",
      model: "mock-planner-v1",
      status: "waiting_for_approval",
      approvalRequired: true,
    });
    expect(result.plan.runId).toBe(result.run.id);
    expect(result.plan.affectedFiles.map((file) => file.path)).toEqual([
      "src/App.tsx",
      "README.md",
    ]);
    expect(result.proposedChange.approvalRequestId).toBe(
      result.approvalRequest.id,
    );
    expect(result.approvalRequest.agentRunId).toBe(result.run.id);
    expect(result.proposedChange.patchArtifacts).toHaveLength(2);
    expect(
      result.proposedChange.patchArtifacts.every(
        (artifact) => artifact.status === "not_generated",
      ),
    ).toBe(true);
  });

  it("rejects an empty task without creating review records", async () => {
    await expect(
      executeMockAgentRun({
        id: "run-empty",
        repositoryId: "repo-test",
        repositoryName: "workspace",
        branch: "main",
        task: "   ",
        contextFilePaths: [],
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      }),
    ).rejects.toThrow("A task request is required.");
  });
});
