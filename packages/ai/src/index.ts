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
};

export function createMockProvider(): ProviderAdapter {
  return {
    id: "mock",
    displayName: "Mock Provider",
    capabilities: [
      {
        id: "mock-planning",
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsStructuredOutput: true
      }
    ]
  };
}
