# OMP Adapter

## Purpose

This document defines how OMP should fit into the product architecture.

OMP is an AI runtime. It is not the product.

The product should integrate OMP through a provider adapter so future providers and runtimes can be added or swapped without rewriting product workflows.

## Architectural Position

OMP should sit behind the provider abstraction.

Product workflows should call:

- Agent runtime
- Provider interface
- Tool and permission layer

They should not call OMP directly.

## Adapter Responsibilities

The OMP adapter should:

- Translate internal provider requests into OMP-compatible calls
- Translate OMP responses into normalized provider responses
- Map OMP tool call behavior into the workspace tool protocol
- Normalize errors
- Report model or runtime capabilities
- Support cancellation where available
- Preserve request and run metadata for audit

## What The Adapter Must Not Own

The OMP adapter must not own:

- Product task behavior
- Agent definitions
- Approval policy
- Tool permission decisions
- Repository indexing
- Change review state
- Documentation workflows
- Model routing strategy outside OMP-specific capabilities

If product logic starts appearing inside the adapter, the boundary is failing.

## Request Mapping

The adapter should map internal request data:

- Request ID
- Agent run ID
- Routing intent
- Messages or structured prompt
- Context package
- Tool definitions
- Output format expectations
- Timeout or cancellation

Into the equivalent OMP runtime request.

Provider-specific details should remain inside the adapter.

## Response Mapping

The adapter should map OMP output into:

- Normalized text output
- Structured output where available
- Tool call requests
- Finish reason
- Usage metadata where available
- Warnings
- Normalized errors
- Runtime metadata

Workflows should not need to understand OMP response internals.

## Tool Calls

OMP tool calls should be mediated by the workspace.

OMP may request a tool call, but execution must pass through:

1. Agent runtime
2. Tool registry
3. Permission policy
4. Approval flow if required
5. Tool execution boundary
6. Tool result normalization

The adapter should never become a hidden path around permissions.

## Capability Reporting

The adapter should expose OMP capabilities in the same shape as other providers.

Capabilities may include:

- Supported models
- Context limits
- Tool call support
- Streaming support
- Structured output support
- Local or remote execution characteristics
- Known limitations

Capability reporting should feed model routing and workflow eligibility.

## Error Handling

OMP-specific errors should be normalized into provider error categories:

- Runtime unavailable
- Authentication or configuration error
- Invalid request
- Context too large
- Tool call unsupported
- Timeout
- Cancellation
- Unknown runtime error

The user-facing product should receive actionable failure messages.

## Configuration

OMP configuration should be stored as provider configuration, not as product-wide hidden assumptions.

Configuration may include:

- Runtime path or endpoint
- Available models
- Default model
- Tool support settings
- Timeout settings
- Logging preferences

Configuration should be inspectable in workspace settings.

## MVP Scope

The MVP OMP adapter should support:

- Basic provider invocation
- Normalized responses
- Basic errors
- Capability metadata
- Tool call mediation if needed
- Cancellation if practical

The MVP should avoid:

- OMP-specific product workflows
- Hard-coding OMP assumptions into agent prompts
- Treating OMP capability as universal capability

## Success Criteria

The OMP adapter is successful when:

- OMP can power early workflows
- Product workflows remain provider-independent
- Tool use remains permissioned
- OMP can be replaced or supplemented later
- OMP-specific limitations are represented as capabilities, not hidden product constraints
