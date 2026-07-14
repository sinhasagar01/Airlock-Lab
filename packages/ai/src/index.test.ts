import { describe, expect, it } from "vitest";
import {
  createMockAgentProviderAdapter,
  executeMockAgentRun,
} from "./index";

describe("AgentProviderAdapter", () => {
  it("normalizes mock planning behind the provider contract", async () => {
    const adapter = createMockAgentProviderAdapter();

    expect(adapter).toMatchObject({
      id: "mock",
      name: "Mock Provider",
      capabilities: {
        supportsPlanGeneration: true,
        supportsPatchGeneration: false,
        supportsStreaming: false,
        supportsToolUse: false,
      },
    });

    const result = await adapter.createPlan({
      runId: "run-contract",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      taskTitle: "Add a repository context summary",
      taskPrompt: "Add a repository context summary",
      context: {
        branch: "main",
        indexedFilePaths: ["src/App.tsx", "README.md", "src/App.tsx"],
      },
    });

    expect(result).toMatchObject({
      providerId: "mock",
      model: "mock-planner-v1",
      approvalRequired: true,
    });
    expect(result.steps).toHaveLength(3);
    expect(result.affectedFiles.map((file) => file.path)).toEqual([
      "src/App.tsx",
      "README.md",
    ]);
    expect(
      result.affectedFiles.every(
        (file) => file.patchArtifactStatus === "not_generated",
      ),
    ).toBe(true);
  });
});

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
