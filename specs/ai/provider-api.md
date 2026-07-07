# Provider API

## Status

Draft MVP spec.

## Purpose

This spec defines the internal provider API used by product workflows and agent runtime to call AI providers.

The API must keep product behavior independent from OMP or any other provider.

## References

- [Provider Interface](../../docs/provider-abstraction/provider-interface.md)
- [OMP Adapter](../../docs/provider-abstraction/omp-adapter.md)
- [Multi-Provider Strategy](../../docs/provider-abstraction/multi-provider-strategy.md)
- [Model Routing](../../docs/provider-abstraction/model-routing.md)

## Core Rule

Only provider adapters may call provider-specific SDKs or runtimes.

Product workflows, UI, and agent logic must call the internal provider API.

## Provider Adapter Contract

An adapter must expose:

- Provider identity
- Model capability metadata
- Invocation method
- Streaming method where supported
- Cancellation support where practical
- Error normalization
- Tool call normalization where supported

## Provider Request

### Required Fields

- `requestId`
- `workspaceId`
- `agentRunId`
- `routingIntent`
- `modelPreference`
- `messages`
- `contextPackage`
- `outputFormat`
- `tools`
- `policy`
- `stream`
- `timeoutMs`

### Requirements

- Request shape must be provider-independent.
- Context must be passed as a structured package.
- Tool definitions must be declared before provider invocation.
- Policy metadata must include provider restrictions and sensitivity where available.

## Provider Response

### Required Fields

- `requestId`
- `providerId`
- `modelId`
- `status`
- `content`
- `structuredOutput`
- `toolCalls`
- `usage`
- `finishReason`
- `warnings`
- `error`

### Statuses

- `completed`
- `tool_call_requested`
- `cancelled`
- `failed`

### Requirements

- Responses must be normalized.
- Tool call requests must not execute tools directly.
- Structured output failures must be explicit.
- Provider warnings should be propagated to the agent run.

## Message Shape

Messages should support:

- Role
- Content
- Attachments or context references where needed
- Metadata

Roles may include:

- `system`
- `user`
- `assistant`
- `tool`

Provider adapters may map these to provider-specific formats internally.

## Tool Calls

Tool call flow:

1. Provider returns normalized tool call request.
2. Agent runtime validates tool request.
3. Permission layer checks action.
4. User approval is requested when needed.
5. Tool executes.
6. Tool result is returned to provider through the runtime.

Provider adapters must not bypass this flow.

## Capability Metadata

Model capability records should include:

- `providerId`
- `modelId`
- `displayName`
- `supportsStreaming`
- `supportsToolCalling`
- `supportsStructuredOutput`
- `contextWindow`
- `supportedModalities`
- `bestFor`
- `costTier`
- `latencyTier`
- `privacyTier`

## Error Categories

Provider errors must normalize to:

- `authentication_error`
- `rate_limit`
- `timeout`
- `provider_unavailable`
- `invalid_request`
- `context_too_large`
- `tool_call_unsupported`
- `structured_output_failed`
- `safety_refusal`
- `cancelled`
- `unknown`

## MVP Requirements

- At least one provider adapter must implement this contract.
- OMP must be integrated through an adapter.
- Product code must not import provider-specific APIs.
- Provider errors must be visible in agent run state.
- Capability metadata must exist even if simple.

## Acceptance Criteria

- Agent runtime can invoke a provider through the internal API.
- Provider response is normalized.
- Provider errors are categorized.
- Tool call requests are mediated by the agent runtime.
- A second provider could be added without changing product workflow code.
