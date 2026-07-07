# ADR 0004: Implement Provider Abstraction With Mock Adapter First, Then OMP Adapter

## Status

Proposed.

## Context

The product must not be tightly coupled to OMP or any single AI provider.

The MVP needs AI-assisted planning, agent runs, review, and explanation behavior. Those workflows require a provider integration, but the product architecture must preserve provider independence.

The technical spike recommends implementing the internal provider abstraction and a mock provider adapter first, then adding a thin OMP adapter behind the same interface.

## Decision

Implement the provider abstraction before integrating OMP.

Implementation sequence:

1. Define provider request and response types.
2. Implement provider adapter contract.
3. Implement model capability metadata.
4. Implement normalized provider errors.
5. Implement deterministic mock provider adapter.
6. Use mock provider for contract tests and early UI/workflow development.
7. Implement a thin OMP adapter behind the same interface.
8. Add routing intent placeholder.

## Required Boundary

Product workflows, UI components, and agent definitions must not call OMP directly.

All provider calls must flow through:

1. Agent or workflow service.
2. Provider abstraction.
3. Provider adapter.
4. Normalized response or error handling.

Tool calls requested by providers must return to the agent runtime and permission layer before execution.

## Consequences

### Positive

- Forces provider-independent product workflows from the beginning.
- Enables deterministic tests before real provider integration.
- Makes provider failures easier to normalize and display.
- Allows UI and workflow development without network/provider availability.
- Keeps OMP positioned as a runtime adapter, not the product architecture.

### Negative

- Adds upfront abstraction work before real AI behavior is visible.
- Mock behavior may diverge from OMP behavior if contract tests are weak.
- Requires discipline to prevent OMP assumptions from leaking into prompts or workflows.

### Neutral Or Tradeoffs

- The mock adapter is a product development tool, not a fake replacement for provider evaluation.
- The OMP adapter should remain thin even if OMP supports richer workflow behavior.
- More advanced model routing can wait until after the provider boundary is proven.

## Alternatives Considered

### Direct OMP Integration First

Rejected because it risks coupling product workflows to OMP semantics before the internal provider contract exists.

### Integrate Multiple Real Providers Immediately

Rejected because it expands scope before the MVP workflows are stable.

### Mock Only Until Late MVP

Rejected because the product still needs real provider integration early enough to validate planning and agent behavior.

## Implementation Notes

- Add provider contract tests before OMP integration.
- Keep provider-specific code in adapter modules only.
- Normalize provider errors into documented categories.
- Store provider capability metadata.
- Route provider tool calls through the permission layer.
- Use mock provider in tests, story-like UI states, and offline development.

## Related Documents

- [Technical Spikes](../../tasks/research/technical-spikes.md)
- [AI Provider Abstraction RFC](../../rfcs/proposed/0001-ai-provider-abstraction.md)
- [Provider Interface](../../docs/provider-abstraction/provider-interface.md)
- [Provider API Spec](../../specs/ai/provider-api.md)
- [OMP Adapter](../../docs/provider-abstraction/omp-adapter.md)
- [AI Package](../../packages/ai/README.md)
