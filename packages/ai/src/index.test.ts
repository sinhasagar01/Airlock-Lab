import { describe, expect, it } from "vitest";
import {
  AgentProviderError,
  createMockAgentProviderAdapter,
  createOpenAiAgentProviderAdapter,
  executeAgentRun,
  executeMockAgentRun,
} from "./index";

const validOpenAiPlan = {
  summary: "Add a bounded provider-backed planning path.",
  steps: [
    {
      title: "Add provider transport",
      description:
        "Connect the validated adapter to the native request boundary.",
    },
  ],
  affectedFiles: [
    {
      path: "src/App.tsx",
      reason: "Wire provider selection into the agent run composer.",
      operation: "modify",
      riskLevel: "medium",
    },
  ],
  risks: [
    {
      level: "medium",
      title: "Provider output requires validation",
      description: "Reject malformed output before persistence.",
    },
  ],
  validation: [{ label: "Run provider contract tests" }],
  approvalRequired: true,
};

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
      task: "Add a repository context summary",
      context: {
        branch: "main",
        indexedFilePaths: ["src/App.tsx", "README.md", "src/App.tsx"],
      },
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
        task: "   ",
        context: { branch: "main", indexedFilePaths: [] },
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      }),
    ).rejects.toThrow("A task request is required.");
  });
});

describe("OpenAI provider adapter", () => {
  it("sends bounded repository context and normalizes valid plan output", async () => {
    let capturedRequest: unknown;
    const adapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async (request) => {
        capturedRequest = request;
        return validOpenAiPlan;
      },
    });
    const result = await adapter.createPlan({
      runId: "run-openai",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      taskTitle: "Add provider planning",
      taskPrompt: "Add provider-backed structured plan generation.",
      context: {
        branch: "main",
        indexedFilePaths: ["src/App.tsx", ".env", "private/id_rsa"],
        indexedFileCount: 42,
        keyFiles: ["package.json", ".env", "private/id_rsa"],
        projectFolders: ["src", "docs", "nested/private"],
        topExtensions: [{ extension: "ts", count: 12 }],
        git: {
          isGitRepository: true,
          isClean: false,
          changedFileCount: 2,
        },
      },
    });

    expect(capturedRequest).toEqual({
      runId: "run-openai",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      taskTitle: "Add provider planning",
      taskPrompt: "Add provider-backed structured plan generation.",
      context: {
        branch: "main",
        indexedFileCount: 42,
        keyFiles: ["package.json"],
        projectFolders: ["src", "docs"],
        topExtensions: [{ extension: "ts", count: 12 }],
        git: {
          isGitRepository: true,
          isClean: false,
          changedFileCount: 2,
        },
      },
    });
    expect(result).toMatchObject({
      providerId: "openai",
      model: "test-model",
      approvalRequired: true,
    });
    expect(result.steps[0].status).toBe("planned");
    expect(result.affectedFiles[0].patchArtifactStatus).toBe("not_generated");
    expect(result.validation[0].status).toBe("planned");
  });

  it("rejects malformed or unsafe output before creating records", async () => {
    const malformedAdapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({ summary: "Incomplete" }),
    });
    const unsafeAdapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({
        ...validOpenAiPlan,
        affectedFiles: [
          {
            ...validOpenAiPlan.affectedFiles[0],
            path: "../outside.txt",
          },
        ],
      }),
    });
    const input = {
      runId: "run-openai",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      taskTitle: "Add provider planning",
      taskPrompt: "Add provider-backed structured plan generation.",
      context: { branch: "main", indexedFilePaths: [] },
    };

    await expect(malformedAdapter.createPlan(input)).rejects.toMatchObject({
      code: "invalid_output",
    });
    await expect(unsafeAdapter.createPlan(input)).rejects.toMatchObject({
      code: "invalid_output",
    });
  });

  it("normalizes provider transport failures without exposing raw errors", async () => {
    const adapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => {
        throw new Error("rate_limit: internal provider payload");
      },
    });

    await expect(
      adapter.createPlan({
        runId: "run-openai",
        repositoryId: "repo-test",
        repositoryName: "workspace",
        taskTitle: "Add provider planning",
        taskPrompt: "Add provider-backed structured plan generation.",
        context: { branch: "main", indexedFilePaths: [] },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AgentProviderError>>({
        code: "rate_limit",
        providerId: "openai",
        retryable: true,
      }),
    );
  });

  it("creates a linked run, proposal, and approval after validation", async () => {
    const adapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => validOpenAiPlan,
    });
    const result = await executeAgentRun(
      {
        id: "run-openai",
        repositoryId: "repo-test",
        repositoryName: "workspace",
        task: "Add provider-backed structured plan generation.",
        context: { branch: "main", indexedFilePaths: [] },
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      },
      adapter,
    );

    expect(result.run).toMatchObject({
      providerId: "openai",
      model: "test-model",
      status: "waiting_for_approval",
    });
    expect(result.proposedChange.approvalRequestId).toBe(
      result.approvalRequest.id,
    );
    expect(result.approvalRequest.agentRunId).toBe(result.run.id);
    expect(
      result.proposedChange.patchArtifacts.every(
        (artifact) => artifact.status === "not_generated",
      ),
    ).toBe(true);
  });
});
