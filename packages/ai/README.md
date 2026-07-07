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
- `ProviderRequest`
- `ProviderResponse`
- `ModelCapability`
- `RoutingIntent`
- `ContextPackage`
- `AgentDefinition`
- `AgentRunEvent`
- Provider error categories

## Acceptance Criteria

- Agent runtime can call providers through a stable interface.
- OMP can be integrated as an adapter.
- A second provider can be added without changing product workflow contracts.
- Tool calls are normalized and routed through permission-aware application services.
