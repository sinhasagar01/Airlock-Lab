# ADR 0001: Record Architecture Decisions

## Status

Proposed.

## Context

This repository is documentation-first and is intended to become the foundation for a long-lived AI-native engineering platform.

The product will involve consequential architecture decisions, including provider abstraction, local indexing, agent runtime design, permissions, persistence, frontend architecture, plugin boundaries, and future integrations.

If these decisions are not recorded, future contributors will lose the reasoning behind the system and may accidentally reverse important constraints.

## Decision

Use Architecture Decision Records for durable technical decisions.

ADRs should be created when a decision:

- Establishes or changes a major architectural boundary.
- Chooses a core technology or runtime.
- Defines a provider, persistence, security, or integration strategy.
- Changes module ownership.
- Introduces a long-term constraint.
- Reverses or supersedes a previous decision.

## ADR Location

ADRs live in:

- `adrs/proposed`
- `adrs/accepted`
- `adrs/superseded`

Rejected proposals should use RFCs unless a rejected decision record is useful for long-term context.

## ADR Required Sections

Each ADR should include:

- Title
- Status
- Context
- Decision
- Consequences
- Alternatives considered
- Related documents

## Status Lifecycle

ADR statuses:

- Proposed
- Accepted
- Superseded

An accepted ADR may later be moved to `adrs/superseded` when replaced by a new accepted ADR.

## Consequences

Positive consequences:

- Architecture reasoning is preserved.
- Future contributors can understand why decisions were made.
- AI agents can use ADRs as authoritative context.
- Major decisions become reviewable artifacts.

Tradeoffs:

- Decisions require documentation discipline.
- Some early ADRs may be revised as the product matures.
- The team must keep ADR status current.

## Alternatives Considered

### Keep Decisions In General Docs

Rejected because major decisions become hard to find and update.

### Use RFCs Only

Rejected because RFCs are better for proposals and discussion, while ADRs are better for finalized durable decisions.

### Do Not Record Decisions Yet

Rejected because this repository is explicitly documentation-first and early architectural constraints matter.

## Related Documents

- [System Overview](../../docs/architecture/system-overview.md)
- [Module Boundaries](../../docs/architecture/module-boundaries.md)
- [Documentation Graph](../../docs/repositories/documentation-graph.md)
- [ADR Template](../../templates/adrs/adr-template.md)
