# Frontend State Management

## Status

Draft implementation spec.

## Purpose

This spec defines frontend state ownership for the MVP.

The product has domain state, workflow state, local UI state, async job state, and provider/agent progress state. These must be separated so the UI remains predictable and domain behavior stays testable.

## State Categories

### Domain State

Durable workspace data.

Examples:

- Workspace
- Repository
- Task
- Plan
- Agent run
- Change
- Validation record
- Approval
- Activity event

Domain state should come from application services and persistence, not be invented inside components.

### Workflow State

Current status of active flows.

Examples:

- Repository scan running
- Plan generation running
- Agent run awaiting approval
- Validation command executing
- Change under review

Workflow state should be derived from domain records and job state where possible.

### UI State

Transient presentation state.

Examples:

- Open panel
- Selected tab
- Expanded row
- Dialog open
- Search query
- Sidebar collapsed

UI state may live locally in components or a lightweight UI store.

### Form State

Editable user input before persistence.

Examples:

- Draft task fields
- Edited plan text
- PR draft fields
- Approval revision notes

Form state should validate before committing to domain state.

### Job State

Long-running operation progress.

Examples:

- Repository scan
- Agent run
- Provider invocation
- Validation command

Job state should expose progress events, cancellation where supported, errors, and final status.

## Data Flow

Preferred flow:

1. UI triggers application command.
2. Application service validates command.
3. Domain state or job state changes.
4. Persistence records durable changes.
5. UI subscribes to updated state.
6. Activity event records meaningful transitions.

The UI should avoid directly mutating persisted records.

## Optimistic Updates

Optimistic updates may be used only for low-risk local actions.

Examples:

- Expanding UI sections
- Editing local drafts
- Selecting active repository after persistence succeeds

Avoid optimistic updates for:

- File writes
- Git actions
- Provider calls
- Agent run completion
- Validation results
- Approval decisions

## Error State

Errors should be typed at the service layer and rendered by UI.

Error UI should show:

- What failed
- Whether anything changed
- Suggested recovery
- Link to related run or job where applicable

## Staleness

The UI must show stale state when:

- Repository scan is old
- Git state changed since scan
- Job output references outdated context
- Validation predates latest change

## MVP Acceptance Criteria

- Route views read domain state through application services or hooks.
- Active jobs expose progress and cancellation state where applicable.
- Approval state is durable, not local-only UI state.
- Validation state is separate from change state.
- UI state does not leak into domain records.
