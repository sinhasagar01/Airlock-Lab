# Workspace Spec

## Status

Draft MVP spec.

## Purpose

This spec defines the MVP workspace behavior for the AI-native software engineering product.

The workspace is the durable container for repositories, product tasks, plans, agent runs, changes, validations, approvals, documents, and activity.

## References

- [Product Vision](../../docs/vision/product-vision.md)
- [MVP Scope](../../docs/product/mvp-scope.md)
- [System Overview](../../docs/architecture/system-overview.md)
- [Workspace Model](../../docs/architecture/workspace-model.md)
- [Information Architecture](../../docs/ux/information-architecture.md)

## MVP Goals

The workspace must allow a single expert user to:

- Open a local workspace.
- Register one or more local repositories.
- See recent workspace activity.
- Create structured product tasks.
- Generate and approve technical plans.
- Start bounded agent runs.
- Review proposed changes.
- Record validation state.
- Track approvals.
- Preserve durable project context.

## Non-Goals

The MVP does not include:

- Team collaboration.
- Organization administration.
- Cloud sync.
- Hosted workspaces.
- Production monitoring.
- Deployment automation.
- Multi-user permissions.

## Core Objects

### Workspace

### Required Fields

- `id`
- `name`
- `createdAt`
- `updatedAt`
- `settings`
- `activeRepositoryId`

### Requirements

- A user must be able to create or open one local workspace.
- Workspace state must persist locally.
- Workspace state must not depend on a cloud account.
- The active workspace must be visible in the app shell.

### Repository Registration

### Required Fields

- `id`
- `workspaceId`
- `name`
- `path`
- `status`
- `createdAt`
- `lastScannedAt`

### Requirements

- A workspace must support multiple registered repositories.
- A repository must point to a local filesystem path.
- The app must show the active repository.
- Repository registration must not automatically send source code to an AI provider.

### Task

### Required Fields

- `id`
- `workspaceId`
- `repositoryId`
- `title`
- `problem`
- `goal`
- `scope`
- `nonGoals`
- `acceptanceCriteria`
- `openQuestions`
- `status`
- `createdAt`
- `updatedAt`

### Statuses

- `draft`
- `scoped`
- `planned`
- `approved_for_implementation`
- `in_progress`
- `in_review`
- `completed`
- `archived`

### Requirements

- A user must be able to create a task manually.
- A user must be able to draft task fields with AI assistance.
- A task must be editable before approval.
- A task must link to plans, agent runs, changes, validations, documents, and decisions.

### Plan

### Required Fields

- `id`
- `taskId`
- `summary`
- `approach`
- `affectedAreas`
- `assumptions`
- `risks`
- `validationPlan`
- `status`
- `createdAt`
- `updatedAt`

### Statuses

- `draft`
- `needs_clarification`
- `ready_for_approval`
- `approved`
- `superseded`
- `rejected`

### Requirements

- A plan must be generated from task and repository context.
- A plan must show affected areas, assumptions, risks, and validation plan.
- A user must approve a plan before implementation begins.
- A plan must remain inspectable after agent runs begin.

### Approval

### Required Fields

- `id`
- `workspaceId`
- `targetType`
- `targetId`
- `action`
- `scope`
- `preview`
- `risks`
- `status`
- `createdAt`
- `resolvedAt`

### Statuses

- `pending`
- `approved`
- `denied`
- `cancelled`

### Requirements

- Approval must be required before implementation begins.
- Approval must be required before file writes.
- Approval must be required before scope expansion.
- Approval must be required before Git writes or external side effects.
- Approval records must remain visible in activity history.

### Activity Event

### Required Fields

- `id`
- `workspaceId`
- `actorType`
- `eventType`
- `targetType`
- `targetId`
- `summary`
- `createdAt`

### Requirements

- The workspace must record meaningful workflow events.
- Activity must link back to relevant objects.
- Activity must include user and AI/agent actions.

## Primary MVP Flow

1. User opens workspace.
2. User registers or selects repository.
3. Workspace shows repository overview and recent activity.
4. User creates product task.
5. AI drafts task details if requested.
6. User approves or edits task scope.
7. AI generates technical plan.
8. User approves plan.
9. User starts agent run.
10. Agent run requests required approvals.
11. Agent produces proposed change.
12. User reviews diff, risk, and validation.
13. User accepts, revises, or rejects change.
14. Workspace records outcome.

## UI Requirements

- The active workspace and repository must be visible.
- Pending approvals must be globally reachable.
- Recent activity must be visible from workspace home.
- Task, plan, agent run, and change detail views must be linkable.
- The user must be able to return to active work from anywhere.

## Persistence Requirements

- Workspace data must persist locally.
- Persistence must support future migration.
- The system must separate durable workspace state from transient UI state.
- Provider-specific data must not leak into core workspace records.

## Acceptance Criteria

- A new workspace can be opened and persisted locally.
- A local repository can be registered.
- A task can be created and edited.
- A plan can be linked to a task.
- A plan can require approval before implementation.
- An approval can be approved or denied.
- Activity events are recorded for major workflow steps.
- The workspace can be reopened with prior objects intact.
