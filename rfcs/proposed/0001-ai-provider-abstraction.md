# RFC 0001: AI Provider Abstraction

## Status

Proposed.

## Summary

The product should use a provider abstraction layer for all AI model and runtime access.

OMP may be an early runtime, but it must be integrated through an adapter. Product workflows, UI, agents, and domain logic must not depend directly on OMP or any other provider SDK.

## Problem

The product is an AI-native engineering workspace, but the AI ecosystem changes quickly.

If the product couples directly to one runtime or model provider, it will become difficult to:

- Add new providers.
- Use local models.
- Compare models.
- Route work by capability.
- Enforce privacy policies.
- Handle provider failures.
- Adopt better models later.

Provider coupling would also make AI behavior harder to test and reason about.

## Goals

- Keep product workflows provider-independent.
- Support OMP as an adapter, not the product architecture.
- Allow future providers to be added.
- Normalize provider requests and responses.
- Normalize tool calls.
- Normalize errors.
- Support model capability metadata.
- Enable future routing and evaluation.

## Non-Goals

- Build advanced routing in the first implementation.
- Support every provider immediately.
- Create a public provider marketplace.
- Hide provider identity from users.

## Proposal

Create an internal provider API that all AI workflows use.

The architecture should include:

- Provider interface.
- Provider adapters.
- Model capability registry.
- Routing intent.
- Normalized request and response shapes.
- Tool call mediation through the agent runtime and permission layer.
- Error normalization.

OMP should be implemented as one provider adapter.

## Required Properties

The provider abstraction must support:

- Text invocation.
- Structured prompt input.
- Context package input.
- Structured output where available.
- Streaming where available.
- Tool calls where available.
- Cancellation where practical.
- Error normalization.
- Capability metadata.

## Tool Call Rule

Provider tool calls must not execute tools directly.

Flow:

1. Provider requests tool call.
2. Adapter normalizes request.
3. Agent runtime validates request.
4. Permission layer approves or denies execution.
5. Tool executes.
6. Tool result returns through runtime.

## Privacy Rule

Provider requests must carry policy metadata.

Policy metadata may include:

- Context sensitivity.
- Allowed providers.
- Local-only requirement.
- Redaction requirement.
- User approval status.

## Alternatives Considered

### Direct OMP Integration

Rejected because it couples product workflows to one runtime.

### Provider-Specific Branches In Workflows

Rejected because product logic would become fragmented and hard to test.

### Delay Provider Abstraction

Rejected because provider independence is a foundational product principle.

## Risks

### Risk: Abstraction Becomes Too Generic

Mitigation: Model capabilities explicitly instead of pretending every provider supports the same features.

### Risk: MVP Slows Down

Mitigation: Build a minimal adapter contract first, not the full routing system.

### Risk: OMP Features Leak Into Product Logic

Mitigation: Keep OMP-specific behavior inside the adapter and capability metadata.

## Open Questions

- Which provider is the first non-OMP adapter?
- Which schema validation approach should be used for structured outputs?
- How much provider usage metadata should be persisted in MVP?

## Related Documents

- [Provider Interface](../../docs/provider-abstraction/provider-interface.md)
- [OMP Adapter](../../docs/provider-abstraction/omp-adapter.md)
- [Provider API Spec](../../specs/ai/provider-api.md)
- [Agent Runtime](../../docs/ai-system/agent-runtime.md)
