import { invoke } from "@tauri-apps/api/core";
import type { OpenAiPlanRequest } from "@ai-dev/ai";

export type OpenAiProviderConfiguration = {
  configured: boolean;
  model: string;
  reason?: string;
};

export async function loadOpenAiProviderConfiguration() {
  return invoke<OpenAiProviderConfiguration>(
    "get_openai_provider_configuration",
  );
}

export async function requestOpenAiPlan(input: OpenAiPlanRequest) {
  return invoke<unknown>("create_openai_plan", { input });
}
