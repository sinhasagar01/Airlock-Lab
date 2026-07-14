# AI Package

## Purpose

`packages/ai` owns provider abstraction, model routing, context package interfaces, agent runtime primitives, and AI workflow contracts.

It must keep product workflows independent from OMP or any specific provider.

## Responsibilities

- Provider interface
- Provider adapter contracts
- OMP adapter boundary
- Model capability metadata
- Model routing primitives
- Context package types
- Agent definition types
- Agent run orchestration primitives
- Proposed change plan contracts
- Tool call normalization
- Provider error normalization

## Must Not Own

- UI components
- Product page composition
- Repository filesystem scanning implementation
- Persistence engine implementation
- Git command execution
- Approval UI

## Dependency Rules

Allowed:

- `packages/core`
- Provider SDKs inside adapter modules only
- Shared schema utilities if selected

Avoid:

- Direct UI dependencies
- Direct persistence writes
- Provider-specific logic outside adapters

## MVP Exports

Expected exports:

- `ProviderAdapter`
- `AgentProviderAdapter`
- `AgentProviderId`
- `AgentProviderCapabilities`
- `AgentRunContext`
- `CreateAgentPlanInput`
- `CreateAgentPlanResult`
- `ProviderRequest`
- `ProviderResponse`
- `ModelCapability`
- `RoutingIntent`
- `ContextPackage`
- `AgentDefinition`
- `AgentRunEvent`
- `AgentRun`
- `ProposedChangePlan`
- Provider error categories

## Current Provider Boundary

`AgentProviderAdapter` is the execution contract for structured planning.
Adapters receive a task plus pre-derived indexed repository context and return
a normalized plan result. They do not own persistence, approvals, filesystem
access, Git commands, patch application, or UI state.

`createMockAgentProviderAdapter()` is the only implemented adapter. It supports
plan generation and explicitly reports patch generation, streaming, and tool
use as unsupported. `executeMockAgentRun()` consumes that adapter while
preserving the current durable mock-run workflow.

## Acceptance Criteria

- Agent runtime can call providers through a stable interface.
- OMP can be integrated as an adapter.
- A second provider can be added without changing product workflow contracts.
- Tool calls are normalized and routed through permission-aware application services.
