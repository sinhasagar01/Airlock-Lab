export type ProviderCapability = {
  id: string;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
};

export type ProviderAdapter = {
  id: string;
  displayName: string;
  capabilities: ProviderCapability[];
  status: "connected" | "disconnected" | "limited";
};

export type AgentRun = {
  id: string;
  title: string;
  taskSummary: string;
  repository: string;
  providerId: string;
  model: string;
  status: "queued" | "running" | "waiting_for_approval" | "completed";
  nextStep: string;
  startedAt: string;
  elapsed: string;
  confidence: "low" | "medium" | "high";
  approvalRequired: boolean;
};

export type AgentRunRecord = {
  run: AgentRun;
  plan: ProposedChangePlan;
  createdAt: string;
};

export type ProposedChangeStepStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "blocked";

export type ProposedChangeStep = {
  id: string;
  title: string;
  description: string;
  status: ProposedChangeStepStatus;
};

export type ProposedAffectedFile = {
  path: string;
  reason: string;
  changeType: "create" | "modify" | "delete" | "unknown";
};

export type ProposedRisk = {
  level: "low" | "medium" | "high";
  title: string;
  description: string;
};

export type ProposedValidationCheck = {
  label: string;
  status: "planned" | "passed" | "failed" | "not_run";
};

export type ProposedChangePlan = {
  id: string;
  runId: string;
  summary: string;
  steps: ProposedChangeStep[];
  affectedFiles: ProposedAffectedFile[];
  risks: ProposedRisk[];
  validation: ProposedValidationCheck[];
  approvalRequired: boolean;
};

export type ProposedChangeStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "applied";

export type ProposedPatchArtifactStatus =
  | "not_generated"
  | "generated"
  | "failed"
  | "unavailable";

export type ProposedChangeFileOperation =
  | "create"
  | "modify"
  | "delete"
  | "rename"
  | "unknown";

export type ProposedChangeFile = {
  id: string;
  path: string;
  oldPath?: string;
  operation: ProposedChangeFileOperation;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  patchArtifactStatus: ProposedPatchArtifactStatus;
};

export type ProposedPatchArtifact = {
  id: string;
  proposedChangeId: string;
  filePath: string;
  status: ProposedPatchArtifactStatus;
  isBinary: boolean;
  isTooLarge: boolean;
  additions?: number;
  deletions?: number;
  rawDiff?: string;
  createdAt?: string;
};

export type PersistedProposedChange = {
  id: string;
  runId: string;
  approvalRequestId?: string;
  repositoryId: string;
  title: string;
  summary: string;
  status: ProposedChangeStatus;
  files: ProposedChangeFile[];
  patchArtifacts: ProposedPatchArtifact[];
  createdAt: string;
  updatedAt: string;
};

export function createProposedPatchArtifactPlaceholder(
  proposedChangeId: string,
  file: ProposedChangeFile,
): ProposedPatchArtifact {
  return {
    id: `${file.id}-patch-artifact`,
    proposedChangeId,
    filePath: file.path,
    status: file.patchArtifactStatus,
    isBinary: false,
    isTooLarge: false,
  };
}

export function ensureProposedPatchArtifacts(
  change: PersistedProposedChange,
): PersistedProposedChange {
  const existingArtifactsByPath = new Map(
    change.patchArtifacts.map((artifact) => [artifact.filePath, artifact]),
  );
  const patchArtifacts = change.files.map((file) => {
    const existingArtifact = existingArtifactsByPath.get(file.path);

    if (existingArtifact) {
      return existingArtifact;
    }

    return createProposedPatchArtifactPlaceholder(change.id, file);
  });

  return {
    ...change,
    files: change.files.map((file) => {
      const artifact = patchArtifacts.find(
        (candidate) => candidate.filePath === file.path,
      );

      return {
        ...file,
        patchArtifactStatus: artifact?.status ?? file.patchArtifactStatus,
      };
    }),
    patchArtifacts,
  };
}

export type ApprovalRequestStatus = "pending" | "approved" | "rejected";

export type ApprovalRisk = "low" | "medium" | "high";

export type ApprovalRequest = {
  id: string;
  title: string;
  repository: string;
  agentRunId: string;
  status: ApprovalRequestStatus;
  risk: ApprovalRisk;
  summary: string;
  files: string[];
  createdAt: string;
};

export type MockAgentRunRequest = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  branch: string;
  task: string;
  contextFilePaths: string[];
  startedAt: string;
  createdAt: string;
};

export type MockAgentRunResult = AgentRunRecord & {
  proposedChange: PersistedProposedChange;
  approvalRequest: ApprovalRequest;
};

function createMockRunTitle(task: string) {
  const normalizedTask = task.replace(/\s+/g, " ").trim();

  if (normalizedTask.length <= 68) {
    return normalizedTask;
  }

  return `${normalizedTask.slice(0, 65)}...`;
}

export async function executeMockAgentRun(
  request: MockAgentRunRequest,
): Promise<MockAgentRunResult> {
  const normalizedTask = request.task.trim();

  if (!normalizedTask) {
    throw new Error("A task request is required.");
  }

  const title = createMockRunTitle(normalizedTask);
  const planId = `plan-${request.id}`;
  const proposedChangeId = `proposal-${request.id}`;
  const approvalRequestId = `approval-${request.id}`;
  const contextFilePaths = [...new Set(request.contextFilePaths)]
    .filter((path) => path.trim().length > 0)
    .slice(0, 3);
  const affectedFiles: ProposedAffectedFile[] = contextFilePaths.map((path) => ({
    path,
    reason:
      "Candidate file selected from indexed repository context for mock planning review.",
    changeType: "unknown",
  }));
  const plan: ProposedChangePlan = {
    id: planId,
    runId: request.id,
    summary:
      "The mock provider produced a review-only implementation plan from the submitted task and indexed repository context. No patch content was generated.",
    approvalRequired: true,
    steps: [
      {
        id: `${planId}-context`,
        title: "Review repository context",
        description: `Use indexed facts from ${request.repositoryName} on ${request.branch} without reading outside the selected repository.`,
        status: "completed",
      },
      {
        id: `${planId}-plan`,
        title: "Compose structured mock plan",
        description:
          "Translate the task into a bounded plan, candidate files, risks, and validation checks.",
        status: "completed",
      },
      {
        id: `${planId}-approval`,
        title: "Wait for human approval",
        description:
          "Pause before any future patch generation or file write is allowed.",
        status: "planned",
      },
    ],
    affectedFiles,
    risks: [
      {
        level: contextFilePaths.length > 0 ? "medium" : "low",
        title: "Mock plan requires review",
        description:
          "Candidate files and steps are deterministic mock-provider output and must be reviewed before future execution is connected.",
      },
    ],
    validation: [
      { label: "Review proposed plan", status: "planned" },
      { label: "Confirm repository context", status: "planned" },
      { label: "Approve or reject request", status: "planned" },
    ],
  };
  const files: ProposedChangeFile[] = affectedFiles.map((file, index) => ({
    id: `${proposedChangeId}-file-${index + 1}`,
    path: file.path,
    operation: file.changeType,
    reason: file.reason,
    riskLevel: "medium",
    patchArtifactStatus: "not_generated",
  }));
  const proposedChange = ensureProposedPatchArtifacts({
    id: proposedChangeId,
    runId: request.id,
    approvalRequestId,
    repositoryId: request.repositoryId,
    title,
    summary: plan.summary,
    status: "ready_for_review",
    files,
    patchArtifacts: [],
    createdAt: request.startedAt,
    updatedAt: request.startedAt,
  });
  const approvalRequest: ApprovalRequest = {
    id: approvalRequestId,
    title: `Review ${title}`,
    repository: request.repositoryName,
    agentRunId: request.id,
    status: "pending",
    risk: contextFilePaths.length > 0 ? "medium" : "low",
    summary:
      "Review the mock provider plan before any generated patch or repository write is permitted.",
    files: contextFilePaths,
    createdAt: request.startedAt,
  };
  const run: AgentRun = {
    id: request.id,
    title,
    taskSummary: normalizedTask,
    repository: request.repositoryName,
    providerId: "mock",
    model: "mock-planner-v1",
    status: "waiting_for_approval",
    nextStep: "Review the structured mock plan and approval request.",
    startedAt: request.startedAt,
    elapsed: "<1m",
    confidence: contextFilePaths.length > 0 ? "medium" : "low",
    approvalRequired: true,
  };

  return {
    run,
    plan,
    proposedChange,
    approvalRequest,
    createdAt: request.createdAt,
  };
}

export function createMockProvider(): ProviderAdapter {
  return {
    id: "mock",
    displayName: "Mock Provider",
    status: "connected",
    capabilities: [
      {
        id: "mock-planning",
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsStructuredOutput: true,
      },
    ],
  };
}

export function createMockApprovalRequests(): ApprovalRequest[] {
  return [
    {
      id: "approval-provider-rfc",
      title: "Approve provider abstraction patch plan",
      repository: "AI-Developer-Workspace",
      agentRunId: "run-mvp-shell",
      status: "pending",
      risk: "medium",
      summary:
        "Review the proposed provider adapter sequence before implementation touches shared AI package contracts.",
      files: [
        "packages/ai/src/index.ts",
        "docs/specs/provider-api.md",
        "docs/rfcs/provider-abstraction.md",
      ],
      createdAt: "Today, 10:42",
    },
    {
      id: "approval-indexing-job",
      title: "Approve indexing job persistence follow-up",
      repository: "AI-Developer-Workspace",
      agentRunId: "run-index-refresh",
      status: "pending",
      risk: "low",
      summary:
        "Confirm the stub indexing job flow before it begins recording file-tree facts.",
      files: [
        "packages/indexing/src/index.ts",
        "apps/desktop/src/storage/indexingJobStore.ts",
      ],
      createdAt: "Today, 10:46",
    },
  ];
}

export function createMockAgentRuns(): AgentRun[] {
  return [
    {
      id: "run-mvp-shell",
      title: "Draft app shell implementation plan",
      taskSummary:
        "Prepare the desktop app shell plan for repository-aware navigation, approval surfaces, and local-first implementation boundaries.",
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      model: "mock-planner-v1",
      status: "waiting_for_approval",
      nextStep: "Review proposed file edits before execution.",
      startedAt: "Today, 10:34",
      elapsed: "8m",
      confidence: "medium",
      approvalRequired: true,
    },
    {
      id: "run-index-refresh",
      title: "Refresh repository context index",
      taskSummary:
        "Refresh repository facts so future agent runs can use indexed file paths, documentation, and package boundaries.",
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      model: "mock-context-v1",
      status: "running",
      nextStep: "Collect package boundaries and document references.",
      startedAt: "Today, 10:46",
      elapsed: "3m",
      confidence: "high",
      approvalRequired: true,
    },
  ];
}

export function createMockProposedChangePlans(): ProposedChangePlan[] {
  return [
    {
      id: "plan-mvp-shell",
      runId: "run-mvp-shell",
      summary:
        "Refine the desktop shell contract, keep implementation bounded to UI/data wiring, and require human review before any file edits are applied.",
      approvalRequired: true,
      steps: [
        {
          id: "step-review-shell",
          title: "Review current shell structure",
          description:
            "Inspect navigation, repository context, approval queue, and file-preview surfaces before changing shared UI behavior.",
          status: "completed",
        },
        {
          id: "step-compose-plan",
          title: "Compose implementation plan",
          description:
            "Prepare a scoped plan that identifies UI contracts, affected modules, safety boundaries, and verification checks.",
          status: "completed",
        },
        {
          id: "step-await-approval",
          title: "Wait for human approval",
          description:
            "Pause before executing edits so the proposed plan can be reviewed against repository state and risk.",
          status: "planned",
        },
      ],
      affectedFiles: [
        {
          path: "apps/desktop/src/App.tsx",
          reason: "Primary shell and run-detail composition lives here today.",
          changeType: "modify",
        },
        {
          path: "packages/ai/src/index.ts",
          reason:
            "Agent run and proposed plan contracts need reusable typed shapes.",
          changeType: "modify",
        },
        {
          path: "apps/desktop/src/App.test.tsx",
          reason:
            "Smoke coverage should confirm run detail, proposed plan, and approval handoff are visible.",
          changeType: "modify",
        },
      ],
      risks: [
        {
          level: "medium",
          title: "Shared shell regression",
          description:
            "Agent run detail touches the existing six-tab shell and must preserve navigation, approvals, indexing, and preview state.",
        },
        {
          level: "low",
          title: "Mock plan overreach",
          description:
            "The plan must stay honest about missing real diffs and avoid implying that file edits have been generated.",
        },
      ],
      validation: [
        {
          label: "Typecheck workspace packages",
          status: "planned",
        },
        {
          label: "Run desktop smoke tests",
          status: "planned",
        },
        {
          label: "Build desktop bundle",
          status: "planned",
        },
      ],
    },
    {
      id: "plan-index-refresh",
      runId: "run-index-refresh",
      summary:
        "Refresh repository context from indexed facts and report what package boundaries, docs, and file categories are available.",
      approvalRequired: true,
      steps: [
        {
          id: "step-load-index",
          title: "Load indexed facts",
          description:
            "Read persisted file facts for the selected repository without scanning outside the repository boundary.",
          status: "completed",
        },
        {
          id: "step-derive-context",
          title: "Derive context summary",
          description:
            "Summarize folders, key files, and extension counts for future agent context.",
          status: "in_progress",
        },
      ],
      affectedFiles: [
        {
          path: "packages/indexing/src/index.ts",
          reason: "Repository intelligence helpers derive context from facts.",
          changeType: "modify",
        },
      ],
      risks: [
        {
          level: "low",
          title: "Incomplete context",
          description:
            "Index facts may not include package metadata until a safe reader exists.",
        },
      ],
      validation: [
        {
          label: "Confirm indexed facts render",
          status: "planned",
        },
      ],
    },
  ];
}

export function createMockPersistedProposedChanges(): PersistedProposedChange[] {
  const changes: PersistedProposedChange[] = [
    {
      id: "proposal-mvp-shell",
      runId: "run-mvp-shell",
      approvalRequestId: "approval-provider-rfc",
      repositoryId: "repo-workspace",
      title: "Draft app shell implementation plan",
      summary:
        "Durable proposal record for reviewing the app shell plan before any implementation writes are permitted.",
      status: "ready_for_review",
      files: [
        {
          id: "proposal-mvp-shell-app",
          path: "apps/desktop/src/App.tsx",
          operation: "modify",
          reason: "Primary shell and run-detail composition lives here today.",
          riskLevel: "medium",
          patchArtifactStatus: "not_generated",
        },
        {
          id: "proposal-mvp-shell-ai",
          path: "packages/ai/src/index.ts",
          operation: "modify",
          reason:
            "Agent run and proposed plan contracts need reusable typed shapes.",
          riskLevel: "medium",
          patchArtifactStatus: "generated",
        },
        {
          id: "proposal-mvp-shell-test",
          path: "apps/desktop/src/App.test.tsx",
          operation: "modify",
          reason:
            "Smoke coverage should confirm run detail, proposed plan, and approval handoff are visible.",
          riskLevel: "low",
          patchArtifactStatus: "not_generated",
        },
        {
          id: "proposal-mvp-shell-provider-docs",
          path: "docs/specs/provider-api.md",
          operation: "modify",
          reason:
            "Provider API docs need review before adapter sequence work begins.",
          riskLevel: "low",
          patchArtifactStatus: "failed",
        },
        {
          id: "proposal-mvp-shell-provider-rfc",
          path: "docs/rfcs/provider-abstraction.md",
          operation: "modify",
          reason:
            "Provider abstraction RFC should remain linked to the approval review.",
          riskLevel: "low",
          patchArtifactStatus: "unavailable",
        },
      ],
      patchArtifacts: [
        {
          id: "proposal-mvp-shell-ai-patch-artifact",
          proposedChangeId: "proposal-mvp-shell",
          filePath: "packages/ai/src/index.ts",
          status: "generated",
          isBinary: false,
          isTooLarge: false,
          additions: 2,
          deletions: 1,
          rawDiff:
            "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts\n@@ -1,2 +1,3 @@\n-export type OldPlan = string;\n+export type NewPlan = string;\n+export type PatchArtifact = string;",
          createdAt: "Today, 10:44",
        },
        {
          id: "proposal-mvp-shell-provider-docs-patch-artifact",
          proposedChangeId: "proposal-mvp-shell",
          filePath: "docs/specs/provider-api.md",
          status: "failed",
          isBinary: false,
          isTooLarge: false,
          createdAt: "Today, 10:45",
        },
        {
          id: "proposal-mvp-shell-provider-rfc-patch-artifact",
          proposedChangeId: "proposal-mvp-shell",
          filePath: "docs/rfcs/provider-abstraction.md",
          status: "unavailable",
          isBinary: false,
          isTooLarge: false,
        },
      ],
      createdAt: "Today, 10:42",
      updatedAt: "Today, 10:42",
    },
    {
      id: "proposal-index-refresh",
      runId: "run-index-refresh",
      approvalRequestId: "approval-indexing-job",
      repositoryId: "repo-workspace",
      title: "Refresh repository context index",
      summary:
        "Durable proposal record for indexing persistence follow-up work before file writes or generated diffs exist.",
      status: "ready_for_review",
      files: [
        {
          id: "proposal-index-refresh-indexing",
          path: "packages/indexing/src/index.ts",
          operation: "modify",
          reason: "Repository intelligence helpers derive context from facts.",
          riskLevel: "low",
          patchArtifactStatus: "not_generated",
        },
      ],
      patchArtifacts: [],
      createdAt: "Today, 10:46",
      updatedAt: "Today, 10:46",
    },
  ];

  return changes.map(ensureProposedPatchArtifacts);
}
