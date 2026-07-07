# Milestone 03: MVP Specs

## Status

Draft.

## Purpose

Convert the product, architecture, AI, UX, and implementation foundations into buildable MVP specifications.

This milestone is the bridge between documentation strategy and implementation.

## Goals

- Define the MVP workspace behavior.
- Define repository registration and indexing behavior.
- Define agent run behavior.
- Define provider API behavior.
- Define context protocol behavior.
- Define frontend app shell behavior.
- Define frontend component, routing, and state responsibilities.
- Define backend service, persistence, and job system responsibilities.
- Define initial package ownership.

## Scope

Included:

- Product specs.
- AI specs.
- Frontend specs.
- Backend specs.
- Package responsibility docs.
- Acceptance criteria for MVP implementation.

Excluded:

- Runtime code.
- Package setup.
- Dependency installation.
- UI implementation.
- Provider adapter implementation.
- Persistence implementation.

## Deliverables

- `specs/product/workspace-spec.md`
- `specs/product/repository-spec.md`
- `specs/product/agent-spec.md`
- `specs/ai/provider-api.md`
- `specs/ai/context-protocol.md`
- `specs/frontend/app-shell.md`
- `specs/frontend/component-architecture.md`
- `specs/frontend/state-management.md`
- `specs/frontend/routing.md`
- `specs/backend/api-design.md`
- `specs/backend/persistence.md`
- `specs/backend/job-system.md`
- `packages/core/README.md`
- `packages/ui/README.md`
- `packages/ai/README.md`
- `packages/indexing/README.md`

## Acceptance Criteria

- MVP product objects are specified.
- Repository indexing behavior is specified.
- Agent run lifecycle is specified.
- Provider abstraction API is specified.
- Context package protocol is specified.
- App shell and route structure are specified.
- Local persistence record types are specified.
- Job lifecycle is specified.
- Package ownership boundaries are specified.

## Dependencies

- Milestone 00: Repository Bootstrap.
- Milestone 01: Product Foundation.
- Milestone 02: Architecture Foundation.

## Completion Signal

Implementation can begin without needing to invent core product, architecture, or workflow behavior during coding.

