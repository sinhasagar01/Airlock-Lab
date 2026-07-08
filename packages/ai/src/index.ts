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
  repository: string;
  providerId: string;
  status: "queued" | "running" | "waiting_for_approval" | "completed";
  nextStep: string;
};

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
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      status: "waiting_for_approval",
      nextStep: "Review proposed file edits before execution.",
    },
    {
      id: "run-index-refresh",
      title: "Refresh repository context index",
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      status: "running",
      nextStep: "Collect package boundaries and document references.",
    },
  ];
}
