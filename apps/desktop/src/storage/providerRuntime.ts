import { invoke } from "@tauri-apps/api/core";
import type { OpenAiPlanRequest } from "@ai-dev/ai";

export type OpenAiProviderConfiguration = {
  configured: boolean;
  model: string;
  reason?: string;
};

export type OpenAiConnectionStatus =
  | "connected"
  | "not_configured"
  | "authentication_failed"
  | "model_unavailable"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "invalid_configuration";

export type OpenAiConnectionDiagnostic = {
  status: OpenAiConnectionStatus;
  configured: boolean;
  model: string;
  checkedAt: string;
  latencyMs?: number;
  message: string;
};

export async function loadOpenAiProviderConfiguration() {
  return invoke<OpenAiProviderConfiguration>(
    "get_openai_provider_configuration",
  );
}

export async function requestOpenAiPlan(input: OpenAiPlanRequest) {
  return invoke<unknown>("create_openai_plan", { input });
}

export async function testOpenAiConnection() {
  return invoke<OpenAiConnectionDiagnostic>("test_openai_connection");
}
