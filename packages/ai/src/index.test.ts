import { describe, expect, it } from "vitest";
import {
  AgentProviderError,
  MAX_GENERATED_PATCH_ARTIFACT_BYTES,
  MAX_GENERATED_PATCH_ARTIFACT_LINES,
  createMockAgentProviderAdapter,
  createOpenAiAgentProviderAdapter,
  computePatchArtifactDigest,
  executeAgentRun,
  executeMockAgentRun,
  ensureProposedPatchArtifactDigests,
  ensureProposedPatchArtifacts,
  validatePatchArtifactStructure,
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
  patchArtifacts: [
    {
      filePath: "src/App.tsx",
      status: "generated",
      isBinary: false,
      rawDiff: [
        "diff --git a/src/App.tsx b/src/App.tsx",
        "--- a/src/App.tsx",
        "+++ b/src/App.tsx",
        "@@ -1 +1 @@",
        "-const provider = 'mock';",
        "+const provider = 'openai';",
      ].join("\n"),
    },
  ],
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
        // Was `false`, which is why apply/verify/rollback could not be reached
        // without a paid OpenAI key. The demo provider now generates exactly one
        // declared fixture patch.
        supportsPatchGeneration: true,
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
      "airlock-demo.md",
      "src/App.tsx",
      "README.md",
    ]);
    // The demo file is generated; the indexed context candidates are not. The
    // provider produces one patch and does not claim to have authored the rest.
    expect(
      result.affectedFiles
        .filter((file) => file.patchArtifactStatus === "not_generated")
        .map((file) => file.path),
    ).toEqual(["src/App.tsx", "README.md"]);
    expect(result.patchArtifacts).toEqual([
      {
        filePath: "airlock-demo.md",
        status: "generated",
        isBinary: false,
        rawDiff: expect.stringContaining("new file mode 100644"),
      },
    ]);
  });
});

describe("patch artifact structure validation", () => {
  const file = {
    id: "file-app",
    path: "src/App.tsx",
    operation: "modify" as const,
    reason: "Update the app.",
    riskLevel: "medium" as const,
    patchArtifactStatus: "generated" as const,
  };
  const artifact = {
    id: "artifact-app",
    proposedChangeId: "proposal-app",
    filePath: file.path,
    status: "generated" as const,
    isBinary: false,
    isTooLarge: false,
    rawDiff: validOpenAiPlan.patchArtifacts[0].rawDiff,
  };

  it("accepts one bounded unified diff with matching path and operation", () => {
    expect(validatePatchArtifactStructure(artifact, file)).toMatchObject({
      status: "valid_structure",
    });
  });

  it("rejects traversal, multiple files, and operation mismatches", () => {
    expect(
      validatePatchArtifactStructure(
        { ...artifact, filePath: "../outside.txt" },
        { ...file, path: "../outside.txt" },
      ),
    ).toMatchObject({ status: "invalid_structure" });
    expect(
      validatePatchArtifactStructure(
        {
          ...artifact,
          rawDiff: `${artifact.rawDiff}\ndiff --git a/src/Other.tsx b/src/Other.tsx`,
        },
        file,
      ),
    ).toMatchObject({ status: "invalid_structure" });
    expect(
      validatePatchArtifactStructure(artifact, {
        ...file,
        operation: "create",
      }),
    ).toMatchObject({ status: "invalid_structure" });
  });

  it("enforces binary, size, and line-count boundaries", () => {
    expect(
      validatePatchArtifactStructure({ ...artifact, isBinary: true }, file),
    ).toMatchObject({ status: "unavailable" });
    expect(
      validatePatchArtifactStructure(
        {
          ...artifact,
          rawDiff: `${artifact.rawDiff}\n+${"x".repeat(MAX_GENERATED_PATCH_ARTIFACT_BYTES)}`,
        },
        file,
      ),
    ).toMatchObject({ status: "invalid_structure" });
    expect(
      validatePatchArtifactStructure(
        {
          ...artifact,
          rawDiff: `${artifact.rawDiff}\n${" context\n".repeat(MAX_GENERATED_PATCH_ARTIFACT_LINES)}`,
        },
        file,
      ),
    ).toMatchObject({ status: "invalid_structure" });
  });

  it("normalizes older persisted artifacts to a safe validation state", () => {
    const change = ensureProposedPatchArtifacts({
      id: "proposal-app",
      runId: "run-app",
      repositoryId: "repo-app",
      title: "Update app",
      summary: "Review app changes.",
      status: "ready_for_review",
      files: [file],
      patchArtifacts: [artifact],
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(change.patchArtifacts[0].validationStatus).toBe("not_validated");
  });

  it("computes a normalized SHA-256 digest for patch content", async () => {
    await expect(computePatchArtifactDigest("hello")).resolves.toBe(
      "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    );
    await expect(computePatchArtifactDigest("hello\r\n")).resolves.toBe(
      "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    );
  });

  it("stores digests only for artifacts with retained raw diff content", async () => {
    const change = await ensureProposedPatchArtifactDigests({
      id: "proposal-app",
      runId: "run-app",
      repositoryId: "repo-app",
      title: "Update app",
      summary: "Review app changes.",
      status: "ready_for_review",
      files: [file],
      patchArtifacts: [artifact],
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    });
    const unavailable = await ensureProposedPatchArtifactDigests({
      ...change,
      patchArtifacts: [{ ...artifact, rawDiff: undefined }],
    });

    expect(change.patchArtifacts[0].artifactDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(unavailable.patchArtifacts[0].artifactDigest).toBeUndefined();
  });
});

describe("executeMockAgentRun", () => {
  it("creates a linked run, plan, proposal, and approval", async () => {
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
    // The demo file leads: it is the only file this provider generates a patch
    // for. The indexed context files behind it stay review-only candidates.
    expect(result.plan.affectedFiles.map((file) => file.path)).toEqual([
      "airlock-demo.md",
      "src/App.tsx",
      "README.md",
    ]);
    expect(result.proposedChange.approvalRequestId).toBe(
      result.approvalRequest.id,
    );
    expect(result.approvalRequest.agentRunId).toBe(result.run.id);
    // Three artifacts now: the generated demo patch, plus the two context
    // candidates that remain `not_generated`. The split is the point -- the demo
    // provider generates exactly one patch and does not pretend to author the
    // repository's real files.
    expect(result.proposedChange.patchArtifacts).toHaveLength(3);
    expect(
      result.proposedChange.patchArtifacts.filter(
        (artifact) => artifact.status === "generated",
      ),
    ).toHaveLength(1);
    expect(
      result.proposedChange.patchArtifacts
        .filter((artifact) => artifact.status === "not_generated")
        .map((artifact) => artifact.filePath),
    ).toEqual(["src/App.tsx", "README.md"]);
  });

  // The demo provider's whole reason to produce a patch: without one, apply,
  // post-apply verification, and rollback are unreachable without a paid OpenAI
  // key, so the product cannot demonstrate its own core loop.
  //
  // These bytes are not a guess. They were proven against real git in a
  // disposable repository before this test was written: `git apply --check`
  // ACCEPTS this exact text, `git apply` creates the file, and re-applying it
  // after the file is deleted succeeds again. The same text WITHOUT the
  // `new file mode 100644` line is REJECTED by git --
  // "error: dev/null: No such file or directory" -- because git will not read
  // `--- /dev/null` as a creation without it. That line is load-bearing; do not
  // "tidy" it away.
  it("generates one create patch whose diff git itself accepts", async () => {
    const result = await executeMockAgentRun({
      id: "run-demo",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      task: "Show me the demo",
      context: { branch: "main", indexedFilePaths: ["src/App.tsx"] },
      startedAt: "Today, 12:00",
      createdAt: "2026-07-14T06:30:00.000Z",
    });

    const artifact = result.proposedChange.patchArtifacts.find(
      (candidate) => candidate.filePath === "airlock-demo.md",
    );

    expect(artifact?.status).toBe("generated");
    expect(artifact?.rawDiff).toBe(
      [
        "diff --git a/airlock-demo.md b/airlock-demo.md",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/airlock-demo.md",
        "@@ -0,0 +1,3 @@",
        "+# Airlock demo file",
        "+This file was created by the Airlock demo provider, not a real model.",
        "+It exists to exercise apply and rollback. It is safe to delete.",
        "",
      ].join("\n"),
    );
  });

  it("generates a demo patch that passes the structure validator", async () => {
    const result = await executeMockAgentRun({
      id: "run-demo",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      task: "Show me the demo",
      context: { branch: "main", indexedFilePaths: ["src/App.tsx"] },
      startedAt: "Today, 12:00",
      createdAt: "2026-07-14T06:30:00.000Z",
    });

    const artifact = result.proposedChange.patchArtifacts.find(
      (candidate) => candidate.filePath === "airlock-demo.md",
    );
    const file = result.proposedChange.files.find(
      (candidate) => candidate.path === "airlock-demo.md",
    );

    expect(file?.operation).toBe("create");
    expect(artifact).toBeDefined();
    expect(file).toBeDefined();
    expect(validatePatchArtifactStructure(artifact!, file!)).toMatchObject({
      status: "valid_structure",
    });
  });

  // The demo must survive its own success. After a rollback deletes
  // airlock-demo.md, a fresh run has to produce the same applyable patch --
  // proven against git in a temp repository, and pinned here as determinism:
  // nothing in the patch may depend on run id, time, or previous runs.
  it("produces the identical patch on a second run, so the loop repeats", async () => {
    const run = (id: string) =>
      executeMockAgentRun({
        id,
        repositoryId: "repo-test",
        repositoryName: "workspace",
        task: "Show me the demo",
        context: { branch: "main", indexedFilePaths: ["src/App.tsx"] },
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      });

    const first = await run("run-demo-1");
    const second = await run("run-demo-2");

    const diffOf = (result: Awaited<ReturnType<typeof run>>) =>
      result.proposedChange.patchArtifacts.find(
        (candidate) => candidate.filePath === "airlock-demo.md",
      )?.rawDiff;

    expect(diffOf(first)).toBe(diffOf(second));
    expect(diffOf(second)).toContain("+# Airlock demo file");
  });

  it("still says plainly that it is a demo and not a real model", async () => {
    const result = await executeMockAgentRun({
      id: "run-demo",
      repositoryId: "repo-test",
      repositoryName: "workspace",
      task: "Show me the demo",
      context: { branch: "main", indexedFilePaths: [] },
      startedAt: "Today, 12:00",
      createdAt: "2026-07-14T06:30:00.000Z",
    });

    // The patch is real; the provider is not a model. Both must stay true.
    expect(result.run.providerId).toBe("mock");
    expect(result.proposedChange.summary.toLowerCase()).toContain("demo");
    const artifact = result.proposedChange.patchArtifacts.find(
      (candidate) => candidate.filePath === "airlock-demo.md",
    );
    expect(artifact?.rawDiff).toContain("not a real model");
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
    expect(result.patchArtifacts).toEqual([
      expect.objectContaining({
        filePath: "src/App.tsx",
        status: "generated",
      }),
    ]);
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
    const mismatchedArtifactAdapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({
        ...validOpenAiPlan,
        patchArtifacts: [
          {
            ...validOpenAiPlan.patchArtifacts[0],
            filePath: "src/Other.tsx",
          },
        ],
      }),
    });
    const duplicateFileAdapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({
        ...validOpenAiPlan,
        affectedFiles: [
          validOpenAiPlan.affectedFiles[0],
          validOpenAiPlan.affectedFiles[0],
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
    await expect(
      mismatchedArtifactAdapter.createPlan(input),
    ).rejects.toMatchObject({ code: "invalid_output" });
    await expect(duplicateFileAdapter.createPlan(input)).rejects.toMatchObject({
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
    expect(result.proposedChange.patchArtifacts).toEqual([
      expect.objectContaining({
        filePath: "src/App.tsx",
        status: "generated",
        isBinary: false,
        isTooLarge: false,
        additions: 1,
        deletions: 1,
        rawDiff: validOpenAiPlan.patchArtifacts[0].rawDiff,
      }),
    ]);
    expect(result.proposedChange.files[0].patchArtifactStatus).toBe(
      "generated",
    );
  });

  it("persists binary and unavailable artifact states without fake diff content", async () => {
    const adapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({
        ...validOpenAiPlan,
        affectedFiles: [
          validOpenAiPlan.affectedFiles[0],
          {
            path: "assets/logo.png",
            reason: "Replace the product mark.",
            operation: "modify",
            riskLevel: "low",
          },
        ],
        patchArtifacts: [
          {
            filePath: "src/App.tsx",
            status: "unavailable",
            isBinary: false,
            rawDiff: "",
          },
          {
            filePath: "assets/logo.png",
            status: "generated",
            isBinary: true,
            rawDiff: "",
          },
        ],
      }),
    });
    const result = await executeAgentRun(
      {
        id: "run-artifact-states",
        repositoryId: "repo-test",
        repositoryName: "workspace",
        task: "Prepare review artifacts.",
        context: { branch: "main", indexedFilePaths: [] },
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      },
      adapter,
    );

    expect(result.proposedChange.patchArtifacts).toEqual([
      expect.objectContaining({
        filePath: "src/App.tsx",
        status: "unavailable",
        rawDiff: undefined,
      }),
      expect.objectContaining({
        filePath: "assets/logo.png",
        status: "generated",
        isBinary: true,
        rawDiff: undefined,
      }),
    ]);
  });

  it("stores oversized generated artifacts without retaining inline diff content", async () => {
    const oversizedDiff = [
      "diff --git a/src/App.tsx b/src/App.tsx",
      "--- a/src/App.tsx",
      "+++ b/src/App.tsx",
      "@@ -1 +1 @@",
      `+${"x".repeat(MAX_GENERATED_PATCH_ARTIFACT_BYTES)}`,
    ].join("\n");
    const adapter = createOpenAiAgentProviderAdapter({
      model: "test-model",
      requestPlan: async () => ({
        ...validOpenAiPlan,
        patchArtifacts: [
          {
            ...validOpenAiPlan.patchArtifacts[0],
            rawDiff: oversizedDiff,
          },
        ],
      }),
    });
    const result = await executeAgentRun(
      {
        id: "run-oversized-artifact",
        repositoryId: "repo-test",
        repositoryName: "workspace",
        task: "Prepare an oversized review artifact.",
        context: { branch: "main", indexedFilePaths: [] },
        startedAt: "Today, 12:00",
        createdAt: "2026-07-14T06:30:00.000Z",
      },
      adapter,
    );

    expect(result.proposedChange.patchArtifacts[0]).toMatchObject({
      status: "generated",
      isTooLarge: true,
      rawDiff: undefined,
      additions: undefined,
      deletions: undefined,
    });
  });
});
