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
